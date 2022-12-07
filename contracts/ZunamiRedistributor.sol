// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Context.sol";
import '@openzeppelin/contracts/utils/math/Math.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import "./interfaces/IRedistributor.sol";
import "./interfaces/IZunami.sol";

contract ZunamiRedistributor is IRedistributor, Context {
    using Math for uint256;

    uint8 public constant DEFAULT_DECIMALS = 18;
    uint256 public constant DEFAULT_DECIMALS_FACTOR = uint256(10)**DEFAULT_DECIMALS;

    IZunami public zunami;

    constructor(address _zunami) {
        require(_zunami != address(0), 'Zero zunami');
        zunami = IZunami(_zunami);
    }

    function requestRedistribution(
        uint256 nominal
    ) external {
        SafeERC20.safeTransferFrom(IERC20(zunami), _msgSender(), address(this), nominal);
        SafeERC20.safeApprove(IERC20(zunami), address(zunami), nominal);
        zunami.delegateWithdrawal(nominal, [uint256(0),0,0]);
    }

    function redistribute() external {
        uint256[3] memory balances = tokensBalances();
        require(balances[0] > 0 || balances[1] > 0 || balances[2] > 0,"Zero tokens balances");

        uint256 lastZunamiPid = zunami.poolCount() - 1;
        uint256 zunamiTotalSupply = zunami.totalSupply();

        IERC20[3] memory tokens = zunami.tokens();
        for(uint256 i = 0; i <= lastZunamiPid; i++) {
            IZunami.PoolInfo memory info = zunami.poolInfo(i);
            if(info.lpShares > 0) {
                uint256[3] memory poolBalances = calcBalancesProportion(balances, info.lpShares.mulDiv(DEFAULT_DECIMALS_FACTOR, zunamiTotalSupply));
                _transferBalances(address(info.strategy), tokens, poolBalances);
                info.strategy.deposit(poolBalances);
            }
        }
    }

    function _transferBalances(address receiver, IERC20[3] memory tokens, uint256[3] memory balances) internal {
        for(uint256 i = 0; i < 3; i++) {
            if(balances[i] > 0) {
                SafeERC20.safeTransfer(tokens[i], receiver, balances[i]);
            }
        }
    }

    function tokensBalances() public view returns(uint256[3] memory) {
        IERC20[3] memory tokens = zunami.tokens();
        return [
            tokens[0].balanceOf(address(this)),
            tokens[1].balanceOf(address(this)),
            tokens[2].balanceOf(address(this))
        ];
    }

    function calcBalancesProportion(uint256[3] memory balances, uint256 proportion) public view returns(uint256[3] memory) {
        return [
            balances[0].mulDiv(proportion, DEFAULT_DECIMALS_FACTOR),
            balances[1].mulDiv(proportion, DEFAULT_DECIMALS_FACTOR),
            balances[2].mulDiv(proportion, DEFAULT_DECIMALS_FACTOR)
        ];
    }
}
