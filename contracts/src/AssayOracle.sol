// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ASCBase} from "@gluwa/asc-contracts/contracts/readability/ASCBase.sol";
import {EvmV1Decoder} from "@gluwa/asc-contracts/contracts/common/EvmV1Decoder.sol";

/**
 * @title AssayOracle
 * @notice Proves ERC-8004 events from Ethereum Sepolia onto Creditcoin and records
 *         the facts Assay underwrites on.
 *
 * @dev The five checks, in order, on every proof:
 *        1. transaction type is valid
 *        2. the transaction succeeded              (T4: inclusion is not success)
 *        3. the event we want is present
 *        4. the emitter is one of the two registries below   (T5: the security model)
 *        5. only then, business logic
 *
 *      Replay (T6) is handled by ASCBase, which keeps `processedQueries` and
 *      reverts before this contract's handler runs. Do not add a second guard.
 *
 *      The source block height is not visible here. ASCBase does not pass it to
 *      the handler and the decoded transaction does not carry it. Provenance
 *      rides on `queryId`, which commits to chain key, block height and tx
 *      index, and is emitted with every record.
 */
contract AssayOracle is ASCBase {
    /// @notice What the caller is asking this contract to read out of a proved transaction.
    enum Action {
        RecordRegistration,
        RecordFeedback
    }

    error InvalidAction(uint8 action);

    /**
     * @notice The only emitters Assay will believe. Hardcoded on purpose.
     * @dev Event signatures are public, so anyone can deploy a contract that emits
     *      an identical event with invented values and prove it to us. Trust comes
     *      from *who* emitted a log, never from what it says. These two lines are
     *      the most important in the project.
     */
    address public constant IDENTITY_REGISTRY = 0x8004A818BFB912233c491871b3d84c89A494BD9e;
    address public constant REPUTATION_REGISTRY = 0x8004B663056A597Dffe9eCcC1965A193B7388713;

    /// keccak256("Registered(uint256,string,address)")
    bytes32 public constant REGISTERED_SIG = 0xca52e62c367d81bb2e328eb795f7c7ba24afb478408a26c0e201d155c449bc4a;

    /// keccak256("NewFeedback(uint256,address,uint64,int128,uint8,string,string,string,string,string,bytes32)")
    bytes32 public constant NEW_FEEDBACK_SIG = 0x6a4a61743519c9d648a14e6493f47dbe3ff1aa29e7785c96c8326a205e58febc;

    struct AgentRecord {
        bool proven;
        address owner;
        uint64 provenAtBlock;
        uint32 feedbackCount;
    }

    /// @dev One proved NewFeedback. `value` is signed and scaled by `valueDecimals`.
    struct FeedbackRecord {
        address client;
        int128 value;
        uint8 valueDecimals;
        uint64 feedbackIndex;
        bytes32 tag1Hash;
    }

    mapping(uint256 => AgentRecord) public agents;
    mapping(uint256 => FeedbackRecord[]) internal _feedback;

    /// @dev (agentId, client, feedbackIndex) seen. One emission cannot be recorded twice.
    mapping(uint256 => mapping(address => mapping(uint64 => bool))) public feedbackRecorded;

    event AgentProven(uint256 indexed agentId, address indexed owner, bytes32 indexed queryId);
    event FeedbackProven(
        uint256 indexed agentId,
        address indexed client,
        bytes32 indexed queryId,
        uint64 feedbackIndex,
        int128 value,
        uint8 valueDecimals,
        bytes32 tag1Hash
    );

    function feedbackCount(uint256 agentId) external view returns (uint256) {
        return _feedback[agentId].length;
    }

    function feedbackAt(uint256 agentId, uint256 index) external view returns (FeedbackRecord memory) {
        return _feedback[agentId][index];
    }

    function _processAndEmitEvent(uint8 action, bytes32 queryId, bytes memory encodedTransaction) internal override {
        if (action == uint8(Action.RecordRegistration)) {
            _recordRegistration(queryId, encodedTransaction);
        } else if (action == uint8(Action.RecordFeedback)) {
            _recordFeedback(queryId, encodedTransaction);
        } else {
            revert InvalidAction(action);
        }
    }

    /// @dev Checks 1 to 3, shared by both handlers.
    function _logsFor(bytes memory encodedTransaction, bytes32 signature)
        internal
        pure
        returns (EvmV1Decoder.LogEntry[] memory logs)
    {
        uint8 txType = EvmV1Decoder.getTransactionType(encodedTransaction);
        require(EvmV1Decoder.isValidTransactionType(txType), "Unsupported transaction type");

        EvmV1Decoder.ReceiptFields memory receipt = EvmV1Decoder.decodeReceiptFields(encodedTransaction);
        require(receipt.receiptStatus == 1, "Transaction did not succeed");

        logs = EvmV1Decoder.getLogsByEventSignature(receipt, signature);
        require(logs.length > 0, "Event not found");
    }

    function _recordRegistration(bytes32 queryId, bytes memory encodedTransaction) internal {
        EvmV1Decoder.LogEntry[] memory logs = _logsFor(encodedTransaction, REGISTERED_SIG);

        uint256 recorded;
        for (uint256 i = 0; i < logs.length; i++) {
            EvmV1Decoder.LogEntry memory log = logs[i];

            // Check 4. Anything not from the Identity Registry is someone else's event.
            if (log.address_ != IDENTITY_REGISTRY) continue;
            require(log.topics.length == 3, "Registered: bad topics");

            uint256 agentId = uint256(log.topics[1]);
            address owner = address(uint160(uint256(log.topics[2])));

            AgentRecord storage record = agents[agentId];
            if (!record.proven) {
                record.proven = true;
                record.owner = owner;
                record.provenAtBlock = uint64(block.number);
                emit AgentProven(agentId, owner, queryId);
            }
            recorded++;
        }
        require(recorded > 0, "No Registered event from the Identity Registry");
    }

    function _recordFeedback(bytes32 queryId, bytes memory encodedTransaction) internal {
        EvmV1Decoder.LogEntry[] memory logs = _logsFor(encodedTransaction, NEW_FEEDBACK_SIG);

        uint256 recorded;
        for (uint256 i = 0; i < logs.length; i++) {
            EvmV1Decoder.LogEntry memory log = logs[i];

            // Check 4.
            if (log.address_ != REPUTATION_REGISTRY) continue;
            require(log.topics.length == 4, "NewFeedback: bad topics");

            uint256 agentId = uint256(log.topics[1]);
            address client = address(uint160(uint256(log.topics[2])));
            bytes32 tag1Hash = log.topics[3];

            // Feedback is only meaningful against an identity we have already proved.
            require(agents[agentId].proven, "Agent identity not proved yet");

            // Only the leading static fields are decoded. The trailing strings and
            // hash are left encoded: the head slots are read in order, so this
            // reads feedbackIndex, value and valueDecimals and ignores the rest.
            // Verified against real Sepolia logs before this was written.
            (uint64 feedbackIndex, int128 value, uint8 valueDecimals) =
                abi.decode(log.data, (uint64, int128, uint8));

            if (feedbackRecorded[agentId][client][feedbackIndex]) continue;
            feedbackRecorded[agentId][client][feedbackIndex] = true;

            _feedback[agentId].push(
                FeedbackRecord({
                    client: client,
                    value: value,
                    valueDecimals: valueDecimals,
                    feedbackIndex: feedbackIndex,
                    tag1Hash: tag1Hash
                })
            );
            agents[agentId].feedbackCount += 1;

            emit FeedbackProven(agentId, client, queryId, feedbackIndex, value, valueDecimals, tag1Hash);
            recorded++;
        }
        require(recorded > 0, "No new NewFeedback event from the Reputation Registry");
    }
}
