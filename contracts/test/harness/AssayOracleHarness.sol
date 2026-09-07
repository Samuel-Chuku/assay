// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {AssayOracle} from "../../src/AssayOracle.sol";
import {INativeQueryVerifier} from "@gluwa/asc-contracts/contracts/write-ability/common/INativeQueryVerifier.sol";

/// @dev Exposes AssayOracle's internal handlers so the five checks can be tested
///      without a live precompile and a real proof.
contract AssayOracleHarness is AssayOracle {
    function exposeRecordRegistration(bytes32 queryId, bytes memory encodedTransaction) external {
        _recordRegistration(queryId, encodedTransaction);
    }

    function exposeRecordFeedback(bytes32 queryId, bytes memory encodedTransaction) external {
        _recordFeedback(queryId, encodedTransaction);
    }

    function exposeComputeQueryId(
        uint64 chainKey,
        uint64 blockHeight,
        bytes32 merkleRoot,
        INativeQueryVerifier.MerkleProofEntry[] calldata siblings
    ) external view returns (bytes32) {
        return _computeQueryId(chainKey, blockHeight, merkleRoot, siblings);
    }

    function exposeMarkQueryProcessed(bytes32 queryId) external {
        processedQueries[queryId] = true;
    }

    function exposeProcessAction(uint8 action, bytes32 queryId, bytes memory encodedTransaction) external {
        _processAndEmitEvent(action, queryId, encodedTransaction);
    }
}
