// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '../interfaces/IZunamiStrategyNative.sol';

contract ZunamiStrategyNativeMock is IZunamiStrategyNative {
    address[5] public tokens;

    constructor(address[5] memory _tokens) {
        tokens = _tokens;
    }

    function deposit(uint256[5] memory amounts) external payable returns (uint256) {
        require(address(this).balance >= amounts[0]);
        require(IERC20(tokens[1]).balanceOf(address(this)) >= amounts[1]);
        require(IERC20(tokens[2]).balanceOf(address(this)) >= amounts[2]);

        return amounts[0] + amounts[1] + amounts[2];
    }
}
