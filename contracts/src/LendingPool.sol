// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/**
 * @title LendingPool
 * @notice Humans deposit tCTC, receive shares, earn the interest agents pay and
 *         eat the losses agents cause, both pro rata.
 *
 * @dev Deliberately trivial mechanics. Rule 6: the complexity budget belongs to
 *      the proof path and the underwriter, not here. One asset, the native
 *      currency. No interest-rate curve, no governance, no tranches.
 *
 *      Accounting rests on one identity:
 *
 *          totalAssets = liquid balance + principal currently out on loan
 *
 *      A draw moves value from the first term to the second and leaves the total
 *      untouched, so share price does not move. A repayment returns principal
 *      and adds interest on top, so the total rises and every share is worth
 *      more. A write-off drops the second term with nothing coming back, so the
 *      total falls and every share is worth less. That is the whole model.
 */
contract LendingPool {
    address public immutable OWNER;

    /// @notice The only contract allowed to move money out of the pool.
    address public creditLine;

    mapping(address => uint256) public shares;
    uint256 public totalShares;

    /// @notice Principal drawn and not yet repaid or written off.
    uint256 public totalDeployed;

    /**
     * @dev A pool whose first deposit is dust can be manipulated by donating
     *      directly to it, which distorts the share price for everyone after.
     *      A floor on the opening deposit is the cheap defence.
     */
    uint256 public constant MIN_INITIAL_DEPOSIT = 1e15;

    bool private _entered;

    event Deposited(address indexed lender, uint256 amount, uint256 sharesMinted);
    event Withdrawn(address indexed lender, uint256 amount, uint256 sharesBurned);
    event Lent(address indexed to, uint256 amount);
    event Repaid(uint256 principal, uint256 interest);
    event LossRecorded(uint256 principal);
    event CreditLineSet(address indexed creditLine);

    error NotOwner();
    error NotCreditLine();
    error Reentrant();

    modifier onlyOwner() {
        if (msg.sender != OWNER) revert NotOwner();
        _;
    }

    modifier onlyCreditLine() {
        if (msg.sender != creditLine) revert NotCreditLine();
        _;
    }

    modifier nonReentrant() {
        if (_entered) revert Reentrant();
        _entered = true;
        _;
        _entered = false;
    }

    constructor() {
        OWNER = msg.sender;
    }

    /// @notice Set once. The pool is useless until it knows who may lend from it.
    function setCreditLine(address creditLine_) external onlyOwner {
        require(creditLine == address(0), "Credit line already set");
        require(creditLine_ != address(0), "Credit line cannot be the zero address");
        creditLine = creditLine_;
        emit CreditLineSet(creditLine_);
    }

    /// @notice Liquid balance plus principal out on loan.
    function totalAssets() public view returns (uint256) {
        return address(this).balance + totalDeployed;
    }

    /// @notice What a lender's shares are currently worth.
    function balanceOf(address lender) external view returns (uint256) {
        if (totalShares == 0) return 0;
        return (shares[lender] * totalAssets()) / totalShares;
    }

    function deposit() external payable nonReentrant {
        require(msg.value > 0, "Deposit must be greater than 0");

        // msg.value is already in the balance, so price the deposit against the
        // pool as it stood before this call.
        uint256 assetsBefore = totalAssets() - msg.value;

        uint256 minted;
        if (totalShares == 0) {
            require(msg.value >= MIN_INITIAL_DEPOSIT, "First deposit below minimum");
            minted = msg.value;
        } else {
            require(assetsBefore > 0, "Pool is insolvent");
            minted = (msg.value * totalShares) / assetsBefore;
            require(minted > 0, "Deposit too small to mint a share");
        }

        shares[msg.sender] += minted;
        totalShares += minted;

        emit Deposited(msg.sender, msg.value, minted);
    }

    function withdraw(uint256 shareAmount) external nonReentrant {
        require(shareAmount > 0, "Withdraw must be greater than 0");
        require(shares[msg.sender] >= shareAmount, "Not enough shares");

        uint256 amount = (shareAmount * totalAssets()) / totalShares;
        require(amount <= address(this).balance, "Not enough liquidity, capital is out on loan");

        shares[msg.sender] -= shareAmount;
        totalShares -= shareAmount;

        emit Withdrawn(msg.sender, amount, shareAmount);

        (bool sent,) = msg.sender.call{value: amount}("");
        require(sent, "Transfer failed");
    }

    /// @notice Move principal out to a borrowing agent. Credit line only.
    function lend(address to, uint256 amount) external onlyCreditLine nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(amount <= address(this).balance, "Not enough liquidity");

        totalDeployed += amount;
        emit Lent(to, amount);

        (bool sent,) = to.call{value: amount}("");
        require(sent, "Transfer failed");
    }

    /**
     * @notice Take a repayment. Anything above `principal` is interest and
     *         accrues to every share.
     */
    function repay(uint256 principal) external payable onlyCreditLine {
        require(principal <= totalDeployed, "Principal exceeds deployed");
        require(msg.value >= principal, "Repayment below principal");

        totalDeployed -= principal;
        emit Repaid(principal, msg.value - principal);
    }

    /// @notice Write off principal that will not come back. Losses land pro rata.
    function recordLoss(uint256 principal) external onlyCreditLine {
        require(principal <= totalDeployed, "Principal exceeds deployed");

        totalDeployed -= principal;
        emit LossRecorded(principal);
    }
}
