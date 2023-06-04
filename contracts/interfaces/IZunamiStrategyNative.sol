// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IZunamiStrategyNative {
    function deposit(uint256[5] memory amounts) external returns (uint256);
}
