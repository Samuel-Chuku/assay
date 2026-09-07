// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";

import {AssayOracle} from "../src/AssayOracle.sol";
import {AssayOracleHarness} from "./harness/AssayOracleHarness.sol";
import {EvmV1Decoder} from "@gluwa/asc-contracts/contracts/common/EvmV1Decoder.sol";
import {INativeQueryVerifier} from "@gluwa/asc-contracts/contracts/write-ability/common/INativeQueryVerifier.sol";

/// @dev Stand-in for the Creditcoin block-prover precompile (0xFD2) in unit tests.
/// adapted-from-examples: bridge/test/ASCMinterSecurity.t.sol
contract MockNativeQueryVerifier {
    function calculateTxIndex(INativeQueryVerifier.MerkleProof calldata) external pure returns (uint64) {
        return 0;
    }

    function verifyAndEmit(
        uint64,
        uint64,
        bytes calldata,
        INativeQueryVerifier.MerkleProof calldata,
        INativeQueryVerifier.ContinuityProof calldata
    ) external pure returns (bool) {
        return false;
    }
}

contract AssayOracleTest is Test {
    AssayOracleHarness internal oracle;

    address internal constant VERIFIER_PRECOMPILE = 0x0000000000000000000000000000000000000FD2;
    address internal constant IDENTITY = 0x8004A818BFB912233c491871b3d84c89A494BD9e;
    address internal constant REPUTATION = 0x8004B663056A597Dffe9eCcC1965A193B7388713;

    /// A contract emitting byte-identical events with invented values.
    address internal constant IMPOSTOR = address(0xBAD);

    address internal owner = address(0xA9E);
    address internal client = address(0xC11E);
    uint256 internal constant AGENT_ID = 10128;

    function setUp() public {
        MockNativeQueryVerifier mock = new MockNativeQueryVerifier();
        vm.etch(VERIFIER_PRECOMPILE, address(mock).code);
        oracle = new AssayOracleHarness();
    }

    // ---------------------------------------------------------------- T5 ----
    // Emitter binding. The single most important behaviour in the project.

    function test_registration_rejectsImpostorEmitter() public {
        bytes memory encoded = _registeredTx(IMPOSTOR, AGENT_ID, owner, 1);
        vm.expectRevert("No Registered event from the Identity Registry");
        oracle.exposeRecordRegistration(bytes32(uint256(1)), encoded);
    }

    function test_feedback_rejectsImpostorEmitter() public {
        _proveAgent();
        bytes memory encoded = _feedbackTx(IMPOSTOR, AGENT_ID, client, 1, 100, 2, 1);
        vm.expectRevert("No new NewFeedback event from the Reputation Registry");
        oracle.exposeRecordFeedback(bytes32(uint256(2)), encoded);
    }

    function test_registration_acceptsRealRegistry() public {
        bytes memory encoded = _registeredTx(IDENTITY, AGENT_ID, owner, 1);
        oracle.exposeRecordRegistration(bytes32(uint256(3)), encoded);

        (bool proven, address recordedOwner,, uint32 count) = oracle.agents(AGENT_ID);
        assertTrue(proven, "agent should be proven");
        assertEq(recordedOwner, owner, "owner mismatch");
        assertEq(count, 0, "no feedback yet");
    }

    /// An impostor log sitting alongside a genuine one must not be recorded.
    function test_registration_ignoresImpostorLogBesideGenuineOne() public {
        bytes memory encoded = _twoRegisteredLogsTx(IMPOSTOR, 999, address(0xDEAD), IDENTITY, AGENT_ID, owner);
        oracle.exposeRecordRegistration(bytes32(uint256(4)), encoded);

        (bool provenReal,,,) = oracle.agents(AGENT_ID);
        (bool provenFake,,,) = oracle.agents(999);
        assertTrue(provenReal, "genuine agent should be proven");
        assertFalse(provenFake, "impostor agent must not be proven");
    }

    // ---------------------------------------------------------------- T4 ----
    // Inclusion is not success.

    function test_rejectsRevertedTransaction() public {
        bytes memory encoded = _registeredTx(IDENTITY, AGENT_ID, owner, 0);
        vm.expectRevert("Transaction did not succeed");
        oracle.exposeRecordRegistration(bytes32(uint256(5)), encoded);
    }

    // ---------------------------------------------------------------- T6 ----
    // Replay, handled by ASCBase.

    function test_replayedQueryIdRejected() public {
        uint64 chainKey = 1;
        uint64 blockHeight = 11653892;
        bytes32 merkleRoot = bytes32(uint256(42));
        INativeQueryVerifier.MerkleProofEntry[] memory siblings = new INativeQueryVerifier.MerkleProofEntry[](0);

        bytes32 queryId = oracle.exposeComputeQueryId(chainKey, blockHeight, merkleRoot, siblings);
        oracle.exposeMarkQueryProcessed(queryId);

        vm.expectRevert("Query already processed");
        oracle.execute(0, chainKey, blockHeight, "", merkleRoot, siblings, bytes32(0), new bytes32[](0));
    }

    // ------------------------------------------------------------ feedback --

    function test_feedback_decodesValuesFromRealLayout() public {
        _proveAgent();
        bytes memory encoded = _feedbackTx(REPUTATION, AGENT_ID, client, 7, -250, 2, 1);
        oracle.exposeRecordFeedback(bytes32(uint256(6)), encoded);

        assertEq(oracle.feedbackCount(AGENT_ID), 1);
        AssayOracle.FeedbackRecord memory f = oracle.feedbackAt(AGENT_ID, 0);
        assertEq(f.client, client, "client");
        assertEq(f.feedbackIndex, 7, "index");
        assertEq(f.value, -250, "value must survive as signed");
        assertEq(f.valueDecimals, 2, "decimals");
    }

    function test_feedback_requiresProvenIdentityFirst() public {
        bytes memory encoded = _feedbackTx(REPUTATION, AGENT_ID, client, 1, 100, 2, 1);
        vm.expectRevert("Agent identity not proved yet");
        oracle.exposeRecordFeedback(bytes32(uint256(7)), encoded);
    }

    function test_feedback_sameEntryNotCountedTwice() public {
        _proveAgent();
        bytes memory encoded = _feedbackTx(REPUTATION, AGENT_ID, client, 1, 100, 2, 1);
        oracle.exposeRecordFeedback(bytes32(uint256(8)), encoded);

        vm.expectRevert("No new NewFeedback event from the Reputation Registry");
        oracle.exposeRecordFeedback(bytes32(uint256(9)), encoded);

        assertEq(oracle.feedbackCount(AGENT_ID), 1, "must not double count");
    }

    function test_invalidActionReverts() public {
        vm.expectRevert(abi.encodeWithSelector(AssayOracle.InvalidAction.selector, uint8(9)));
        oracle.exposeProcessAction(9, bytes32(uint256(10)), "");
    }

    // ------------------------------------------------------------- helpers --

    function _proveAgent() internal {
        oracle.exposeRecordRegistration(bytes32(uint256(100)), _registeredTx(IDENTITY, AGENT_ID, owner, 1));
    }

    function _wrap(EvmV1Decoder.LogEntryTuple[] memory logs, uint8 status) internal pure returns (bytes memory) {
        bytes[] memory chunks = new bytes[](3);
        chunks[0] = abi.encode(uint64(0), uint64(21_000), address(0x1), false, address(0x2), uint256(0), bytes(""));
        chunks[1] = abi.encode(uint128(1), uint256(27), bytes32(0), bytes32(0));
        chunks[2] = abi.encode(status, uint64(21_000), logs, bytes(""));
        return abi.encode(uint8(0), chunks);
    }

    function _registeredLog(address emitter, uint256 agentId, address agentOwner)
        internal
        view
        returns (EvmV1Decoder.LogEntryTuple memory)
    {
        bytes32[] memory topics = new bytes32[](3);
        topics[0] = oracle.REGISTERED_SIG();
        topics[1] = bytes32(agentId);
        topics[2] = bytes32(uint256(uint160(agentOwner)));
        return EvmV1Decoder.LogEntryTuple({address_: emitter, topics: topics, data: abi.encode("ipfs://card")});
    }

    function _registeredTx(address emitter, uint256 agentId, address agentOwner, uint8 status)
        internal
        view
        returns (bytes memory)
    {
        EvmV1Decoder.LogEntryTuple[] memory logs = new EvmV1Decoder.LogEntryTuple[](1);
        logs[0] = _registeredLog(emitter, agentId, agentOwner);
        return _wrap(logs, status);
    }

    function _twoRegisteredLogsTx(
        address emitterA,
        uint256 agentA,
        address ownerA,
        address emitterB,
        uint256 agentB,
        address ownerB
    ) internal view returns (bytes memory) {
        EvmV1Decoder.LogEntryTuple[] memory logs = new EvmV1Decoder.LogEntryTuple[](2);
        logs[0] = _registeredLog(emitterA, agentA, ownerA);
        logs[1] = _registeredLog(emitterB, agentB, ownerB);
        return _wrap(logs, 1);
    }

    /// Mirrors the real NewFeedback layout: three indexed topics, and data that
    /// begins with feedbackIndex, value and valueDecimals before four strings
    /// and a hash. The contract decodes only the leading three.
    function _feedbackTx(
        address emitter,
        uint256 agentId,
        address clientAddress,
        uint64 feedbackIndex,
        int128 value,
        uint8 valueDecimals,
        uint8 status
    ) internal view returns (bytes memory) {
        bytes32[] memory topics = new bytes32[](4);
        topics[0] = oracle.NEW_FEEDBACK_SIG();
        topics[1] = bytes32(agentId);
        topics[2] = bytes32(uint256(uint160(clientAddress)));
        topics[3] = keccak256(bytes("delivery"));

        bytes memory data = abi.encode(
            feedbackIndex,
            value,
            valueDecimals,
            "delivery",
            "onTime",
            "https://agent.example/endpoint",
            "ipfs://feedback",
            bytes32(uint256(0xFEED))
        );

        EvmV1Decoder.LogEntryTuple[] memory logs = new EvmV1Decoder.LogEntryTuple[](1);
        logs[0] = EvmV1Decoder.LogEntryTuple({address_: emitter, topics: topics, data: data});
        return _wrap(logs, status);
    }
}
