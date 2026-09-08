// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {LendingPool} from "../src/LendingPool.sol";

contract LendingPoolTest is Test {
    LendingPool internal pool;

    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal agent = address(0xA9E);
    address internal line = address(0x11E);

    function setUp() public {
        pool = new LendingPool();
        pool.setCreditLine(line);

        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(line, 100 ether);
    }

    function test_setCreditLineOnlyOnce() public {
        vm.expectRevert("Credit line already set");
        pool.setCreditLine(address(0xFEE));
    }

    function test_firstDepositMintsOneForOne() public {
        vm.prank(alice);
        pool.deposit{value: 10 ether}();

        assertEq(pool.shares(alice), 10 ether, "shares");
        assertEq(pool.totalAssets(), 10 ether, "assets");
        assertEq(pool.balanceOf(alice), 10 ether, "value");
    }

    function test_firstDepositBelowMinimumRejected() public {
        vm.prank(alice);
        vm.expectRevert("First deposit below minimum");
        pool.deposit{value: 1000}();
    }

    function test_secondDepositPricedAgainstExistingAssets() public {
        vm.prank(alice);
        pool.deposit{value: 10 ether}();
        vm.prank(bob);
        pool.deposit{value: 10 ether}();

        assertEq(pool.shares(bob), 10 ether, "equal deposit, equal shares");
        assertEq(pool.balanceOf(alice), 10 ether, "alice unchanged");
    }

    function test_withdrawReturnsProportionalValue() public {
        vm.prank(alice);
        pool.deposit{value: 10 ether}();

        uint256 before = alice.balance;
        vm.prank(alice);
        pool.withdraw(4 ether);

        assertEq(alice.balance - before, 4 ether, "withdrawn");
        assertEq(pool.shares(alice), 6 ether, "shares left");
    }

    // --------------------------------------------------------- the identity --
    // totalAssets = liquid balance + principal out on loan

    function test_lendMovesValueWithoutChangingShareValue() public {
        vm.prank(alice);
        pool.deposit{value: 10 ether}();

        vm.prank(line);
        pool.lend(agent, 4 ether);

        assertEq(address(pool).balance, 6 ether, "liquid falls");
        assertEq(pool.totalDeployed(), 4 ether, "deployed rises");
        assertEq(pool.totalAssets(), 10 ether, "total unchanged");
        assertEq(pool.balanceOf(alice), 10 ether, "share value unchanged");
    }

    function test_lendOnlyByCreditLine() public {
        vm.prank(alice);
        pool.deposit{value: 10 ether}();

        vm.prank(alice);
        vm.expectRevert(LendingPool.NotCreditLine.selector);
        pool.lend(agent, 1 ether);
    }

    function test_interestRaisesShareValueForEveryone() public {
        vm.prank(alice);
        pool.deposit{value: 10 ether}();
        vm.prank(bob);
        pool.deposit{value: 10 ether}();

        vm.prank(line);
        pool.lend(agent, 8 ether);

        // repay principal plus 2 ether of interest
        vm.prank(line);
        pool.repay{value: 10 ether}(8 ether);

        assertEq(pool.totalDeployed(), 0, "principal returned");
        assertEq(pool.totalAssets(), 22 ether, "interest added");
        assertEq(pool.balanceOf(alice), 11 ether, "alice gains half");
        assertEq(pool.balanceOf(bob), 11 ether, "bob gains half");
    }

    function test_lossFallsOnEveryoneProRata() public {
        vm.prank(alice);
        pool.deposit{value: 10 ether}();
        vm.prank(bob);
        pool.deposit{value: 30 ether}();

        vm.prank(line);
        pool.lend(agent, 8 ether);
        vm.prank(line);
        pool.recordLoss(8 ether);

        assertEq(pool.totalAssets(), 32 ether, "assets written down");
        // alice holds a quarter of the pool, so eats a quarter of the loss
        assertEq(pool.balanceOf(alice), 8 ether, "alice down 2");
        assertEq(pool.balanceOf(bob), 24 ether, "bob down 6");
    }

    function test_withdrawBlockedWhenCapitalIsOutOnLoan() public {
        vm.prank(alice);
        pool.deposit{value: 10 ether}();

        vm.prank(line);
        pool.lend(agent, 9 ether);

        vm.prank(alice);
        vm.expectRevert("Not enough liquidity, capital is out on loan");
        pool.withdraw(10 ether);
    }

    function test_depositorAfterLossBuysInAtTheLowerPrice() public {
        vm.prank(alice);
        pool.deposit{value: 10 ether}();

        vm.prank(line);
        pool.lend(agent, 5 ether);
        vm.prank(line);
        pool.recordLoss(5 ether);

        // pool is now worth 5 ether against 10 ether of shares
        vm.prank(bob);
        pool.deposit{value: 5 ether}();

        assertEq(pool.shares(bob), 10 ether, "twice the shares for the same money");
        assertEq(pool.balanceOf(bob), 5 ether, "but the same value");
        assertEq(pool.balanceOf(alice), 5 ether, "alice keeps her loss");
    }
}
