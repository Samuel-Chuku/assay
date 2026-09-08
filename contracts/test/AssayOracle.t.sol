// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";

import {AssayOracle} from "../src/AssayOracle.sol";
import {AssayOracleHarness} from "./harness/AssayOracleHarness.sol";
import {ProofFixtures, MockNativeQueryVerifier} from "./harness/ProofFixtures.sol";
import {INativeQueryVerifier} from "@gluwa/asc-contracts/contracts/write-ability/common/INativeQueryVerifier.sol";

contract AssayOracleTest is Test, ProofFixtures {
    AssayOracleHarness internal oracle;

    address internal constant VERIFIER_PRECOMPILE = 0x0000000000000000000000000000000000000FD2;

    address internal owner = address(0xA9E);
    address internal client = address(0xC11E);
    address internal newOwner = address(0xB0B);
    address internal walletA = address(0xDA1);
    uint256 internal constant AGENT_ID = 10128;

    function setUp() public {
        MockNativeQueryVerifier mock = new MockNativeQueryVerifier();
        vm.etch(VERIFIER_PRECOMPILE, address(mock).code);
        oracle = new AssayOracleHarness();
    }

    /// The fixtures declare the signatures independently. If either side drifts,
    /// fail here rather than let the tests agree with themselves.
    function test_fixtureSignaturesMatchContract() public view {
        assertEq(FIXTURE_REGISTERED_SIG, oracle.REGISTERED_SIG(), "Registered");
        assertEq(FIXTURE_NEW_FEEDBACK_SIG, oracle.NEW_FEEDBACK_SIG(), "NewFeedback");
        assertEq(FIXTURE_TRANSFER_SIG, oracle.TRANSFER_SIG(), "Transfer");
        assertEq(FIXTURE_METADATA_SET_SIG, oracle.METADATA_SET_SIG(), "MetadataSet");
        assertEq(FIXTURE_AGENT_WALLET_KEY_HASH, oracle.AGENT_WALLET_KEY_HASH(), "agentWallet key");
        assertEq(IDENTITY, oracle.IDENTITY_REGISTRY(), "identity registry");
        assertEq(REPUTATION, oracle.REPUTATION_REGISTRY(), "reputation registry");
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
        oracle.exposeRecordRegistration(bytes32(uint256(3)), _registeredTx(IDENTITY, AGENT_ID, owner, 1));

        AssayOracle.AgentRecord memory record = oracle.getAgent(AGENT_ID);
        assertTrue(record.proven, "agent should be proven");
        assertEq(record.owner, owner, "owner mismatch");
        assertEq(record.currentOwner, owner, "current owner mismatch");
        assertEq(record.feedbackCount, 0, "no feedback yet");
    }

    /// An impostor log sitting alongside a genuine one must not be recorded.
    function test_registration_ignoresImpostorLogBesideGenuineOne() public {
        bytes memory encoded = _twoRegisteredLogsTx(IMPOSTOR, 999, address(0xDEAD), IDENTITY, AGENT_ID, owner);
        oracle.exposeRecordRegistration(bytes32(uint256(4)), encoded);

        assertTrue(oracle.getAgent(AGENT_ID).proven, "genuine agent should be proven");
        assertFalse(oracle.getAgent(999).proven, "impostor agent must not be proven");
    }

    // ---------------------------------------------------------------- T4 ----

    function test_rejectsRevertedTransaction() public {
        bytes memory encoded = _registeredTx(IDENTITY, AGENT_ID, owner, 0);
        vm.expectRevert("Transaction did not succeed");
        oracle.exposeRecordRegistration(bytes32(uint256(5)), encoded);
    }

    // ---------------------------------------------------------------- T6 ----

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
        oracle.exposeRecordFeedback(bytes32(uint256(6)), _feedbackTx(REPUTATION, AGENT_ID, client, 7, -250, 2, 1));

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

    // ---------------------------------------------------------------- T8 ----
    // Identity is a transferable ERC-721.

    function test_transfer_rejectsImpostorErc721() public {
        _proveAgent();
        // Any ERC-721 anywhere emits a byte-identical Transfer.
        bytes memory encoded = _transferTx(IMPOSTOR, owner, newOwner, AGENT_ID);
        vm.expectRevert("No Transfer event from the Identity Registry");
        oracle.exposeRecordIdentityTransfer(bytes32(uint256(20)), encoded);
    }

    function test_transfer_incrementsOwnerChanges() public {
        _proveAgent();
        assertEq(oracle.getAgent(AGENT_ID).ownerChanges, 0, "starts at zero");

        oracle.exposeRecordIdentityTransfer(bytes32(uint256(21)), _transferTx(IDENTITY, owner, newOwner, AGENT_ID));

        AssayOracle.AgentRecord memory record = oracle.getAgent(AGENT_ID);
        assertEq(record.ownerChanges, 1, "one change");
        assertEq(record.currentOwner, newOwner, "current owner updated");
        assertEq(record.owner, owner, "owner at first proof must not move");
    }

    /// The mint at registration is not a change of hands.
    function test_transfer_mintDoesNotCountAsChange() public {
        _proveAgent();
        oracle.exposeRecordIdentityTransfer(bytes32(uint256(22)), _transferTx(IDENTITY, address(0), owner, AGENT_ID));
        assertEq(oracle.getAgent(AGENT_ID).ownerChanges, 0, "mint must not count");
    }

    /// Proofs can arrive in any order, so the counter must never regress.
    function test_transfer_counterIsMonotonic() public {
        _proveAgent();
        oracle.exposeRecordIdentityTransfer(bytes32(uint256(23)), _transferTx(IDENTITY, owner, newOwner, AGENT_ID));
        // an older transfer proved afterwards
        oracle.exposeRecordIdentityTransfer(bytes32(uint256(24)), _transferTx(IDENTITY, newOwner, owner, AGENT_ID));
        assertEq(oracle.getAgent(AGENT_ID).ownerChanges, 2, "must count up, never back");
    }

    function test_transfer_requiresProvenIdentity() public {
        bytes memory encoded = _transferTx(IDENTITY, owner, newOwner, AGENT_ID);
        vm.expectRevert("Agent identity not proved yet");
        oracle.exposeRecordIdentityTransfer(bytes32(uint256(25)), encoded);
    }

    // ---------------------------------------------------------------- T9 ----

    function test_wallet_recordsChange() public {
        _proveAgent();
        oracle.exposeRecordWalletChange(bytes32(uint256(30)), _walletTx(IDENTITY, AGENT_ID, abi.encodePacked(walletA)));

        AssayOracle.AgentRecord memory record = oracle.getAgent(AGENT_ID);
        assertEq(record.walletChanges, 1, "one change");
        assertEq(record.paymentWallet, walletA, "wallet recorded");
    }

    function test_wallet_ignoresOtherMetadataKeys() public {
        _proveAgent();
        bytes memory encoded = _metadataTx(IDENTITY, AGENT_ID, keccak256(bytes("somethingElse")), "value");
        vm.expectRevert("No agentWallet MetadataSet event from the Identity Registry");
        oracle.exposeRecordWalletChange(bytes32(uint256(31)), encoded);
        assertEq(oracle.getAgent(AGENT_ID).walletChanges, 0, "unrelated metadata must not count");
    }

    /// A transfer clears the wallet by emitting this same event with an empty value.
    function test_wallet_unsetIsAChange() public {
        _proveAgent();
        oracle.exposeRecordWalletChange(bytes32(uint256(32)), _walletTx(IDENTITY, AGENT_ID, abi.encodePacked(walletA)));
        oracle.exposeRecordWalletChange(bytes32(uint256(33)), _walletTx(IDENTITY, AGENT_ID, ""));

        AssayOracle.AgentRecord memory record = oracle.getAgent(AGENT_ID);
        assertEq(record.walletChanges, 2, "unset counts");
        assertEq(record.paymentWallet, address(0), "wallet cleared");
    }

    function test_wallet_rejectsImpostorEmitter() public {
        _proveAgent();
        bytes memory encoded = _walletTx(IMPOSTOR, AGENT_ID, abi.encodePacked(address(0xBAD1)));
        vm.expectRevert("No agentWallet MetadataSet event from the Identity Registry");
        oracle.exposeRecordWalletChange(bytes32(uint256(34)), encoded);
    }

    // ------------------------------------------------------------- helpers --

    function _proveAgent() internal {
        oracle.exposeRecordRegistration(bytes32(uint256(100)), _registeredTx(IDENTITY, AGENT_ID, owner, 1));
    }

}
