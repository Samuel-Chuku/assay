// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

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

/**
 * @dev Builds the `encodedTransaction` blobs the decoder expects, so tests can
 *      exercise the real handlers without a live proof.
 *
 *      The signature constants are declared here independently of AssayOracle on
 *      purpose. AssayOracle.t.sol asserts they match, so if either drifts the
 *      tests say so instead of silently agreeing with themselves.
 */
contract ProofFixtures {
    address internal constant IDENTITY = 0x8004A818BFB912233c491871b3d84c89A494BD9e;
    address internal constant REPUTATION = 0x8004B663056A597Dffe9eCcC1965A193B7388713;

    /// A contract emitting byte-identical events with invented values.
    address internal constant IMPOSTOR = address(0xBAD);

    bytes32 internal constant FIXTURE_REGISTERED_SIG =
        0xca52e62c367d81bb2e328eb795f7c7ba24afb478408a26c0e201d155c449bc4a;
    bytes32 internal constant FIXTURE_NEW_FEEDBACK_SIG =
        0x6a4a61743519c9d648a14e6493f47dbe3ff1aa29e7785c96c8326a205e58febc;
    bytes32 internal constant FIXTURE_TRANSFER_SIG =
        0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef;
    bytes32 internal constant FIXTURE_METADATA_SET_SIG =
        0x2c149ed548c6d2993cd73efe187df6eccabe4538091b33adbd25fafdb8a1468b;
    bytes32 internal constant FIXTURE_AGENT_WALLET_KEY_HASH =
        0x2ac6109326e720d1435c0db66f7e35eda7839f52b6f1f5520a60788e132b4e39;

    function _wrap(EvmV1Decoder.LogEntryTuple[] memory logs, uint8 status) internal pure returns (bytes memory) {
        bytes[] memory chunks = new bytes[](3);
        chunks[0] = abi.encode(uint64(0), uint64(21_000), address(0x1), false, address(0x2), uint256(0), bytes(""));
        chunks[1] = abi.encode(uint128(1), uint256(27), bytes32(0), bytes32(0));
        chunks[2] = abi.encode(status, uint64(21_000), logs, bytes(""));
        return abi.encode(uint8(0), chunks);
    }

    function _registeredLog(address emitter, uint256 agentId, address agentOwner)
        internal
        pure
        returns (EvmV1Decoder.LogEntryTuple memory)
    {
        bytes32[] memory topics = new bytes32[](3);
        topics[0] = FIXTURE_REGISTERED_SIG;
        topics[1] = bytes32(agentId);
        topics[2] = bytes32(uint256(uint160(agentOwner)));
        return EvmV1Decoder.LogEntryTuple({address_: emitter, topics: topics, data: abi.encode("ipfs://card")});
    }

    function _registeredTx(address emitter, uint256 agentId, address agentOwner, uint8 status)
        internal
        pure
        returns (bytes memory)
    {
        EvmV1Decoder.LogEntryTuple[] memory logs = new EvmV1Decoder.LogEntryTuple[](1);
        logs[0] = _registeredLog(emitter, agentId, agentOwner);
        return _wrap(logs, status);
    }

    /// Two Registered logs in one transaction, so a genuine log can be tested
    /// alongside an impostor's.
    function _twoRegisteredLogsTx(
        address emitterA,
        uint256 agentA,
        address ownerA,
        address emitterB,
        uint256 agentB,
        address ownerB
    ) internal pure returns (bytes memory) {
        EvmV1Decoder.LogEntryTuple[] memory logs = new EvmV1Decoder.LogEntryTuple[](2);
        logs[0] = _registeredLog(emitterA, agentA, ownerA);
        logs[1] = _registeredLog(emitterB, agentB, ownerB);
        return _wrap(logs, 1);
    }

    function _transferTx(address emitter, address from, address to, uint256 agentId)
        internal
        pure
        returns (bytes memory)
    {
        bytes32[] memory topics = new bytes32[](4);
        topics[0] = FIXTURE_TRANSFER_SIG;
        topics[1] = bytes32(uint256(uint160(from)));
        topics[2] = bytes32(uint256(uint160(to)));
        topics[3] = bytes32(agentId);

        EvmV1Decoder.LogEntryTuple[] memory logs = new EvmV1Decoder.LogEntryTuple[](1);
        logs[0] = EvmV1Decoder.LogEntryTuple({address_: emitter, topics: topics, data: ""});
        return _wrap(logs, 1);
    }

    function _metadataTx(address emitter, uint256 agentId, bytes32 keyHash, bytes memory value)
        internal
        pure
        returns (bytes memory)
    {
        bytes32[] memory topics = new bytes32[](3);
        topics[0] = FIXTURE_METADATA_SET_SIG;
        topics[1] = bytes32(agentId);
        topics[2] = keyHash;

        EvmV1Decoder.LogEntryTuple[] memory logs = new EvmV1Decoder.LogEntryTuple[](1);
        logs[0] = EvmV1Decoder.LogEntryTuple({
            address_: emitter,
            topics: topics,
            data: abi.encode("agentWallet", value)
        });
        return _wrap(logs, 1);
    }

    function _walletTx(address emitter, uint256 agentId, bytes memory value) internal pure returns (bytes memory) {
        return _metadataTx(emitter, agentId, FIXTURE_AGENT_WALLET_KEY_HASH, value);
    }

    /// Mirrors the real NewFeedback layout: three indexed topics, then data that
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
    ) internal pure returns (bytes memory) {
        bytes32[] memory topics = new bytes32[](4);
        topics[0] = FIXTURE_NEW_FEEDBACK_SIG;
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
