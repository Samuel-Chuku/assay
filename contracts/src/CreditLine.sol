// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {LendingPool} from "./LendingPool.sol";
import {AssayOracle} from "./AssayOracle.sol";

/**
 * @title CreditLine
 * @notice One credit line per ERC-8004 agent, keyed on agentId rather than on an
 *         address, because the address can change and the identity cannot.
 *
 * @dev Mechanics are deliberately plain: one collateral type, a fixed rate, no
 *      curves, no liquidation auction. The judgment lives in the underwriter and
 *      the trust lives in the proof path.
 *
 *      Freezing is the interesting part. A line is bound to an identity that is
 *      a transferable NFT (T8) whose payment wallet can be swapped (T9). Both
 *      surface as monotonic counters on AssayOracle, snapshotted here when the
 *      line is offered. If either counter has moved, the evidence underwriting
 *      rested on no longer describes the borrower, and the line freezes.
 *
 *      Freezing is one-way. Rule 7, fail closed: a line that has drifted from
 *      its evidence is not re-underwritten automatically, and a legitimate
 *      rotation means a fresh offer.
 */
contract CreditLine {
    enum State {
        None,
        Offered,
        Active,
        Frozen,
        Repaid,
        Defaulted
    }

    enum FreezeReason {
        NotFrozen,
        IdentityTransferred,
        PaymentWalletChanged,
        EvidenceStale
    }

    struct Line {
        State state;
        address borrower;
        uint256 limit;
        uint256 collateralRequired;
        uint256 collateralPosted;
        uint256 principalOutstanding;
        uint256 interestOwed;
        uint256 totalDrawn;
        uint16 interestBps;
        uint64 expiryBlock;
        uint32 ownerChangesAtOffer;
        uint32 walletChangesAtOffer;
        FreezeReason freezeReason;
        /// @dev Hash of the underwriter's written reasoning, bound on chain.
        bytes32 reasoningHash;
    }

    address public immutable OWNER;
    LendingPool public immutable POOL;
    AssayOracle public immutable ORACLE;

    /// @notice How old the newest proof may be before the line stops trusting it.
    uint64 public immutable EVIDENCE_MAX_AGE_BLOCKS;

    /// @notice The address permitted to offer lines. The underwriter operator.
    address public underwriter;

    mapping(uint256 => Line) internal _lines;

    bool private _entered;

    event UnderwriterSet(address indexed underwriter);
    event LineOffered(
        uint256 indexed agentId,
        address indexed borrower,
        uint256 limit,
        uint256 collateralRequired,
        uint16 interestBps,
        uint64 expiryBlock,
        bytes32 reasoningHash
    );
    event LineAccepted(uint256 indexed agentId, address indexed borrower, uint256 collateralPosted);
    event Drawn(uint256 indexed agentId, uint256 amount, uint256 principalOutstanding);
    event RepaidLine(uint256 indexed agentId, uint256 principal, uint256 interest, uint256 principalOutstanding);
    event LineClosed(uint256 indexed agentId, uint256 collateralReturned);
    event LineFrozen(uint256 indexed agentId, FreezeReason reason);
    event LineDefaulted(uint256 indexed agentId, uint256 recovered, uint256 writtenOff);

    error NotOwner();
    error NotUnderwriter();
    error NotBorrower();
    error WrongState(State actual);
    error Reentrant();

    modifier onlyOwner() {
        if (msg.sender != OWNER) revert NotOwner();
        _;
    }

    modifier onlyUnderwriter() {
        if (msg.sender != underwriter) revert NotUnderwriter();
        _;
    }

    modifier nonReentrant() {
        if (_entered) revert Reentrant();
        _entered = true;
        _;
        _entered = false;
    }

    constructor(LendingPool pool, AssayOracle oracle, uint64 evidenceMaxAgeBlocks) {
        OWNER = msg.sender;
        POOL = pool;
        ORACLE = oracle;
        EVIDENCE_MAX_AGE_BLOCKS = evidenceMaxAgeBlocks;
    }

    function setUnderwriter(address underwriter_) external onlyOwner {
        require(underwriter_ != address(0), "Underwriter cannot be the zero address");
        underwriter = underwriter_;
        emit UnderwriterSet(underwriter_);
    }

    function getLine(uint256 agentId) external view returns (Line memory) {
        return _lines[agentId];
    }

    /**
     * @notice The freeze reason that is live right now, whether or not anyone has
     *         written it down yet.
     * @dev A trigger fires the moment the evidence moves, but the state only
     *      records it when someone calls `freezeIfTriggered`. Readers should show
     *      this, so the dashboard never claims a line is healthy while a draw
     *      would already be refused.
     */
    function pendingFreezeReason(uint256 agentId) external view returns (FreezeReason) {
        Line storage line = _lines[agentId];
        if (line.state != State.Active) return line.freezeReason;
        return _currentFreezeReason(agentId, line);
    }

    /**
     * @notice Offer a line on an agent whose identity has been proved.
     * @dev The borrower is whoever the oracle currently has as owner. Lending to
     *      anyone else would bind the debt to a party the evidence says nothing
     *      about.
     */
    function offer(
        uint256 agentId,
        uint256 limit,
        uint256 collateralRequired,
        uint16 interestBps,
        uint64 expiryBlock,
        bytes32 reasoningHash
    ) external onlyUnderwriter {
        Line storage line = _lines[agentId];
        if (line.state != State.None) revert WrongState(line.state);

        require(limit > 0, "Limit must be greater than 0");
        require(expiryBlock > block.number, "Expiry must be in the future");
        require(reasoningHash != bytes32(0), "Reasoning hash required");

        AssayOracle.AgentRecord memory record = ORACLE.getAgent(agentId);
        require(record.proven, "Agent identity not proved");
        require(_stalenessReason(record) == FreezeReason.NotFrozen, "Evidence is stale");

        line.state = State.Offered;
        line.borrower = record.currentOwner;
        line.limit = limit;
        line.collateralRequired = collateralRequired;
        line.interestBps = interestBps;
        line.expiryBlock = expiryBlock;
        line.ownerChangesAtOffer = record.ownerChanges;
        line.walletChangesAtOffer = record.walletChanges;
        line.reasoningHash = reasoningHash;

        emit LineOffered(
            agentId, record.currentOwner, limit, collateralRequired, interestBps, expiryBlock, reasoningHash
        );
    }

    /// @notice The borrower accepts by posting the required collateral.
    function accept(uint256 agentId) external payable {
        Line storage line = _lines[agentId];
        if (line.state != State.Offered) revert WrongState(line.state);
        if (msg.sender != line.borrower) revert NotBorrower();
        require(msg.value == line.collateralRequired, "Collateral must match exactly");

        line.collateralPosted = msg.value;
        line.state = State.Active;

        emit LineAccepted(agentId, msg.sender, msg.value);
    }

    function draw(uint256 agentId, uint256 amount) external nonReentrant {
        Line storage line = _lines[agentId];
        if (line.state != State.Active) revert WrongState(line.state);
        if (msg.sender != line.borrower) revert NotBorrower();
        require(amount > 0, "Amount must be greater than 0");
        require(block.number <= line.expiryBlock, "Line has expired");

        // Re-check the evidence at every draw, never only at underwriting.
        //
        // This refuses rather than freezing. A revert would roll back a freeze
        // written in the same call, so persisting it here would be theatre: the
        // state change cannot survive the very revert that protects the pool.
        // Refusing is what keeps the money safe; `freezeIfTriggered` is what
        // writes the freeze down, and `pendingFreezeReason` reports it to
        // readers in the meantime.
        if (_currentFreezeReason(agentId, line) != FreezeReason.NotFrozen) {
            revert("Line frozen, evidence changed");
        }

        require(line.totalDrawn + amount <= line.limit, "Draw exceeds limit");

        line.totalDrawn += amount;
        line.principalOutstanding += amount;
        line.interestOwed += (amount * line.interestBps) / 10_000;

        emit Drawn(agentId, amount, line.principalOutstanding);

        POOL.lend(line.borrower, amount);
    }

    /**
     * @notice Repay. Principal first, interest last.
     * @dev A frozen line can still be repaid. Freezing stops new credit, it does
     *      not trap the borrower's money or the pool's.
     */
    function repay(uint256 agentId) external payable nonReentrant {
        Line storage line = _lines[agentId];
        if (line.state != State.Active && line.state != State.Frozen) revert WrongState(line.state);
        require(msg.value > 0, "Repayment must be greater than 0");

        uint256 principalPortion = msg.value > line.principalOutstanding ? line.principalOutstanding : msg.value;
        uint256 interestPortion = msg.value - principalPortion;
        require(interestPortion <= line.interestOwed, "Repayment exceeds amount owed");

        line.principalOutstanding -= principalPortion;
        line.interestOwed -= interestPortion;

        emit RepaidLine(agentId, principalPortion, interestPortion, line.principalOutstanding);

        POOL.repay{value: msg.value}(principalPortion);

        if (line.principalOutstanding == 0 && line.interestOwed == 0) {
            _close(agentId, line);
        }
    }

    /// @notice Anyone may call this. Acting on public evidence should not need permission.
    function freezeIfTriggered(uint256 agentId) external returns (bool frozen) {
        Line storage line = _lines[agentId];
        if (line.state != State.Active) revert WrongState(line.state);

        FreezeReason reason = _currentFreezeReason(agentId, line);
        if (reason == FreezeReason.NotFrozen) return false;

        _freeze(agentId, line, reason);
        return true;
    }

    /**
     * @notice After expiry, settle what is still owed against the collateral and
     *         write the remainder off against the pool.
     */
    function markDefaulted(uint256 agentId) external nonReentrant {
        Line storage line = _lines[agentId];
        if (line.state != State.Active && line.state != State.Frozen) revert WrongState(line.state);
        require(block.number > line.expiryBlock, "Line has not expired yet");
        require(line.principalOutstanding > 0, "Nothing outstanding");

        uint256 principal = line.principalOutstanding;
        uint256 collateral = line.collateralPosted;
        uint256 recovered = collateral >= principal ? principal : collateral;
        uint256 writtenOff = principal - recovered;
        uint256 returnable = collateral - recovered;

        line.principalOutstanding = 0;
        line.interestOwed = 0;
        line.collateralPosted = 0;
        line.state = State.Defaulted;

        emit LineDefaulted(agentId, recovered, writtenOff);

        if (recovered > 0) POOL.repay{value: recovered}(recovered);
        if (writtenOff > 0) POOL.recordLoss(writtenOff);
        if (returnable > 0) {
            (bool sent,) = line.borrower.call{value: returnable}("");
            require(sent, "Collateral return failed");
        }
    }

    // ------------------------------------------------------------ internal --

    function _close(uint256 agentId, Line storage line) internal {
        uint256 collateral = line.collateralPosted;
        line.collateralPosted = 0;
        line.state = State.Repaid;

        emit LineClosed(agentId, collateral);

        if (collateral > 0) {
            (bool sent,) = line.borrower.call{value: collateral}("");
            require(sent, "Collateral return failed");
        }
    }

    function _freeze(uint256 agentId, Line storage line, FreezeReason reason) internal {
        line.state = State.Frozen;
        line.freezeReason = reason;
        emit LineFrozen(agentId, reason);
    }

    /**
     * @dev Every reason a line should stop extending credit, in one place.
     *      Counters only ever climb, so any difference from the snapshot proves
     *      the world moved after underwriting, whatever order proofs arrived in.
     */
    function _currentFreezeReason(uint256 agentId, Line storage line) internal view returns (FreezeReason) {
        AssayOracle.AgentRecord memory record = ORACLE.getAgent(agentId);

        if (record.ownerChanges != line.ownerChangesAtOffer) return FreezeReason.IdentityTransferred;
        if (record.walletChanges != line.walletChangesAtOffer) return FreezeReason.PaymentWalletChanged;
        return _stalenessReason(record);
    }

    function _stalenessReason(AssayOracle.AgentRecord memory record) internal view returns (FreezeReason) {
        if (record.lastEvidenceBlock == 0) return FreezeReason.EvidenceStale;
        if (block.number - record.lastEvidenceBlock > EVIDENCE_MAX_AGE_BLOCKS) return FreezeReason.EvidenceStale;
        return FreezeReason.NotFrozen;
    }

    receive() external payable {
        revert("Send through accept or repay");
    }
}
