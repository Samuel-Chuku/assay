// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";

import {CreditLine} from "../src/CreditLine.sol";
import {LendingPool} from "../src/LendingPool.sol";
import {AssayOracle} from "../src/AssayOracle.sol";
import {AssayOracleHarness} from "./harness/AssayOracleHarness.sol";
import {ProofFixtures, MockNativeQueryVerifier} from "./harness/ProofFixtures.sol";

contract CreditLineTest is Test, ProofFixtures {
    AssayOracleHarness internal oracle;
    LendingPool internal pool;
    CreditLine internal credit;

    address internal constant VERIFIER_PRECOMPILE = 0x0000000000000000000000000000000000000FD2;

    address internal underwriter = address(0x0DD5);
    address internal lender = address(0xA11CE);
    address internal borrower = address(0xA9E);
    address internal buyer = address(0xB0B);
    address internal walletA = address(0xDA1);

    uint256 internal constant AGENT_ID = 10128;
    uint64 internal constant EVIDENCE_MAX_AGE = 1000;
    uint64 internal constant EXPIRY = 10_000;

    bytes32 internal constant REASONING = keccak256("the underwriter's written judgment");

    uint256 private _queryNonce;

    function setUp() public {
        MockNativeQueryVerifier mock = new MockNativeQueryVerifier();
        vm.etch(VERIFIER_PRECOMPILE, address(mock).code);

        oracle = new AssayOracleHarness();
        pool = new LendingPool();
        credit = new CreditLine(pool, AssayOracle(address(oracle)), EVIDENCE_MAX_AGE);

        pool.setCreditLine(address(credit));
        credit.setUnderwriter(underwriter);

        vm.deal(lender, 100 ether);
        vm.deal(borrower, 100 ether);

        vm.prank(lender);
        pool.deposit{value: 50 ether}();

        _proveRegistration();
    }

    // ------------------------------------------------------- the happy path --

    function test_offerDrawRepayClosesTheLine() public {
        _offer(10 ether, 2 ether, 500);

        vm.prank(borrower);
        credit.accept{value: 2 ether}(AGENT_ID);
        assertEq(uint8(credit.getLine(AGENT_ID).state), uint8(CreditLine.State.Active), "active");

        vm.prank(borrower);
        credit.draw(AGENT_ID, 4 ether);

        CreditLine.Line memory line = credit.getLine(AGENT_ID);
        assertEq(line.principalOutstanding, 4 ether, "principal out");
        assertEq(line.interestOwed, 0.2 ether, "5 percent of the draw");
        assertEq(pool.totalDeployed(), 4 ether, "pool tracks the principal");

        uint256 collateralBefore = borrower.balance;
        vm.prank(borrower);
        credit.repay{value: 4.2 ether}(AGENT_ID);

        line = credit.getLine(AGENT_ID);
        assertEq(uint8(line.state), uint8(CreditLine.State.Repaid), "repaid");
        assertEq(line.principalOutstanding, 0, "nothing owed");
        assertEq(borrower.balance, collateralBefore - 4.2 ether + 2 ether, "collateral returned");
        assertEq(pool.totalAssets(), 50.2 ether, "lenders keep the interest");
    }

    function test_partialRepaymentReducesPrincipalFirst() public {
        _activeLine();
        vm.prank(borrower);
        credit.draw(AGENT_ID, 4 ether);

        vm.prank(borrower);
        credit.repay{value: 1 ether}(AGENT_ID);

        CreditLine.Line memory line = credit.getLine(AGENT_ID);
        assertEq(line.principalOutstanding, 3 ether, "principal first");
        assertEq(line.interestOwed, 0.2 ether, "interest untouched");
        assertEq(uint8(line.state), uint8(CreditLine.State.Active), "still active");
    }

    // ------------------------------------------------------- state machine --

    function test_offerRequiresUnderwriter() public {
        vm.expectRevert(CreditLine.NotUnderwriter.selector);
        credit.offer(AGENT_ID, 10 ether, 2 ether, 500, EXPIRY, REASONING);
    }

    function test_offerRequiresProvenIdentity() public {
        vm.prank(underwriter);
        vm.expectRevert("Agent identity not proved");
        credit.offer(999, 10 ether, 2 ether, 500, EXPIRY, REASONING);
    }

    function test_offerRequiresWrittenReasoning() public {
        vm.prank(underwriter);
        vm.expectRevert("Reasoning hash required");
        credit.offer(AGENT_ID, 10 ether, 2 ether, 500, EXPIRY, bytes32(0));
    }

    function test_cannotOfferTwice() public {
        _offer(10 ether, 2 ether, 500);
        vm.prank(underwriter);
        vm.expectRevert(abi.encodeWithSelector(CreditLine.WrongState.selector, CreditLine.State.Offered));
        credit.offer(AGENT_ID, 10 ether, 2 ether, 500, EXPIRY, REASONING);
    }

    function test_onlyBorrowerAccepts() public {
        _offer(10 ether, 2 ether, 500);
        vm.deal(buyer, 10 ether);
        vm.prank(buyer);
        vm.expectRevert(CreditLine.NotBorrower.selector);
        credit.accept{value: 2 ether}(AGENT_ID);
    }

    function test_collateralMustMatchExactly() public {
        _offer(10 ether, 2 ether, 500);
        vm.prank(borrower);
        vm.expectRevert("Collateral must match exactly");
        credit.accept{value: 1 ether}(AGENT_ID);
    }

    function test_drawCannotExceedLimit() public {
        _activeLine();
        vm.prank(borrower);
        vm.expectRevert("Draw exceeds limit");
        credit.draw(AGENT_ID, 11 ether);
    }

    function test_drawAfterExpiryRejected() public {
        _activeLine();
        vm.roll(EXPIRY + 1);
        vm.prank(borrower);
        vm.expectRevert("Line has expired");
        credit.draw(AGENT_ID, 1 ether);
    }

    function test_cannotDrawBeforeAccepting() public {
        _offer(10 ether, 2 ether, 500);
        vm.prank(borrower);
        vm.expectRevert(abi.encodeWithSelector(CreditLine.WrongState.selector, CreditLine.State.Offered));
        credit.draw(AGENT_ID, 1 ether);
    }

    // ------------------------------------------------------------- default --

    function test_defaultSeizesCollateralAndWritesOffTheRest() public {
        _activeLine();
        vm.prank(borrower);
        credit.draw(AGENT_ID, 5 ether);

        vm.roll(EXPIRY + 1);
        credit.markDefaulted(AGENT_ID);

        CreditLine.Line memory line = credit.getLine(AGENT_ID);
        assertEq(uint8(line.state), uint8(CreditLine.State.Defaulted), "defaulted");
        assertEq(pool.totalDeployed(), 0, "nothing left deployed");
        // 2 of the 5 recovered from collateral, 3 written off against the pool
        assertEq(pool.totalAssets(), 47 ether, "lenders eat 3");
    }

    function test_defaultBeforeExpiryRejected() public {
        _activeLine();
        vm.prank(borrower);
        credit.draw(AGENT_ID, 1 ether);

        vm.expectRevert("Line has not expired yet");
        credit.markDefaulted(AGENT_ID);
    }

    // -------------------------------------------------------- freeze: T8 ----

    function test_identityTransferFreezesTheLine() public {
        _activeLine();

        oracle.exposeRecordIdentityTransfer(_nextQuery(), _transferTx(IDENTITY, borrower, buyer, AGENT_ID));

        // The trigger is live immediately, before anyone records it.
        assertEq(
            uint8(credit.pendingFreezeReason(AGENT_ID)),
            uint8(CreditLine.FreezeReason.IdentityTransferred),
            "trigger is live"
        );

        // A draw is refused. It does not write the freeze, because the revert
        // that protects the pool would roll that write back.
        vm.prank(borrower);
        vm.expectRevert("Line frozen, evidence changed");
        credit.draw(AGENT_ID, 1 ether);
        assertEq(uint8(credit.getLine(AGENT_ID).state), uint8(CreditLine.State.Active), "not yet recorded");

        // Recording it is a separate, permissionless call.
        assertTrue(credit.freezeIfTriggered(AGENT_ID), "should freeze");

        CreditLine.Line memory line = credit.getLine(AGENT_ID);
        assertEq(uint8(line.state), uint8(CreditLine.State.Frozen), "frozen");
        assertEq(uint8(line.freezeReason), uint8(CreditLine.FreezeReason.IdentityTransferred), "reason");
    }

    // -------------------------------------------------------- freeze: T9 ----

    function test_walletChangeFreezesTheLine() public {
        _activeLine();

        oracle.exposeRecordWalletChange(_nextQuery(), _walletTx(IDENTITY, AGENT_ID, abi.encodePacked(walletA)));

        assertTrue(credit.freezeIfTriggered(AGENT_ID), "should freeze");

        CreditLine.Line memory line = credit.getLine(AGENT_ID);
        assertEq(uint8(line.state), uint8(CreditLine.State.Frozen), "frozen");
        assertEq(uint8(line.freezeReason), uint8(CreditLine.FreezeReason.PaymentWalletChanged), "reason");
    }

    // ------------------------------------------------ freeze: stale evidence --

    function test_staleEvidenceFreezesTheLine() public {
        _activeLine();

        vm.roll(block.number + EVIDENCE_MAX_AGE + 1);

        assertTrue(credit.freezeIfTriggered(AGENT_ID), "should freeze");
        assertEq(
            uint8(credit.getLine(AGENT_ID).freezeReason),
            uint8(CreditLine.FreezeReason.EvidenceStale),
            "reason"
        );
    }

    function test_freezeIfTriggeredIsPermissionlessAndQuietWhenNothingChanged() public {
        _activeLine();
        vm.prank(buyer);
        assertFalse(credit.freezeIfTriggered(AGENT_ID), "nothing to freeze");
        assertEq(uint8(credit.getLine(AGENT_ID).state), uint8(CreditLine.State.Active), "still active");
    }

    /// Freezing stops new credit. It must not trap anyone's money.
    function test_frozenLineCanStillBeRepaid() public {
        _activeLine();
        vm.prank(borrower);
        credit.draw(AGENT_ID, 4 ether);

        oracle.exposeRecordIdentityTransfer(_nextQuery(), _transferTx(IDENTITY, borrower, buyer, AGENT_ID));
        credit.freezeIfTriggered(AGENT_ID);

        vm.prank(borrower);
        credit.repay{value: 4.2 ether}(AGENT_ID);

        assertEq(uint8(credit.getLine(AGENT_ID).state), uint8(CreditLine.State.Repaid), "repaid while frozen");
    }

    function test_frozenLineCannotDraw() public {
        _activeLine();
        oracle.exposeRecordWalletChange(_nextQuery(), _walletTx(IDENTITY, AGENT_ID, abi.encodePacked(walletA)));
        credit.freezeIfTriggered(AGENT_ID);

        vm.prank(borrower);
        vm.expectRevert(abi.encodeWithSelector(CreditLine.WrongState.selector, CreditLine.State.Frozen));
        credit.draw(AGENT_ID, 1 ether);
    }

    /// A line must not be offered on evidence that is already too old.
    function test_offerRejectedOnStaleEvidence() public {
        vm.roll(block.number + EVIDENCE_MAX_AGE + 1);
        vm.prank(underwriter);
        vm.expectRevert("Evidence is stale");
        credit.offer(AGENT_ID, 10 ether, 2 ether, 500, EXPIRY, REASONING);
    }

    // ------------------------------------------------------------- helpers --

    function _nextQuery() internal returns (bytes32) {
        _queryNonce += 1;
        return bytes32(_queryNonce);
    }

    function _proveRegistration() internal {
        oracle.exposeRecordRegistration(_nextQuery(), _registeredTx(IDENTITY, AGENT_ID, borrower, 1));
    }

    function _offer(uint256 limit, uint256 collateral, uint16 bps) internal {
        vm.prank(underwriter);
        credit.offer(AGENT_ID, limit, collateral, bps, EXPIRY, REASONING);
    }

    function _activeLine() internal {
        _offer(10 ether, 2 ether, 500);
        vm.prank(borrower);
        credit.accept{value: 2 ether}(AGENT_ID);
    }
}
