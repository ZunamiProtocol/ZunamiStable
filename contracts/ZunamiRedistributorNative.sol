// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/utils/Context.sol';
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import '@openzeppelin/contracts/utils/math/Math.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import './interfaces/IRedistributor.sol';
import './interfaces/IZunamiNative.sol';

//import "hardhat/console.sol";

contract ZunamiRedistributorNative is IRedistributor, Context, ReentrancyGuard {
    using Math for uint256;

    uint8 public constant DEFAULT_DECIMALS = 18;
    uint256 public constant DEFAULT_DECIMALS_FACTOR = uint256(10)**DEFAULT_DECIMALS;

    address public constant ETH_MOCK_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    IZunamiNative public immutable zunami;

    event Redistributed(address pool, uint256 value);

    constructor(address _zunami) {
        require(_zunami != address(0), 'Zero zunami');
        zunami = IZunamiNative(_zunami);
    }

    receive() external payable {
        // receive ETH after unwrap
    }

    function requestRedistribution(uint256 nominal) external nonReentrant() {
        SafeERC20.safeTransferFrom(IERC20(zunami), _msgSender(), address(this), nominal);
        zunami.delegateWithdrawal(nominal, [uint256(0), 0, 0, 0, 0]);
    }

    function redistribute() external nonReentrant() {
        uint256[5] memory balances = tokensBalances();
        require(balances[0] > 0 || balances[1] > 0 || balances[2] > 0 || balances[3] > 0 || balances[4] > 0, 'Zero tokens balances');

        uint256 lastZunamiPid = zunami.poolCount() - 1;
        uint256 zunamiTotalSupply = zunami.totalSupply();

        for (uint256 i = 0; i <= lastZunamiPid; i++) {
            IZunamiNative.PoolInfo memory info = zunami.poolInfo(i);
            if (info.lpShares > 0) {
                uint256[5] memory poolBalances = calcBalancesProportion(
                    balances,
                    info.lpShares.mulDiv(DEFAULT_DECIMALS_FACTOR, zunamiTotalSupply)
                );
                _transferBalances(address(info.strategy), poolBalances);
                uint256 deposited = info.strategy.deposit{value: poolBalances[0]}(poolBalances);
                emit Redistributed(address(info.strategy), deposited);
            }
        }
    }

    function _transferBalances(address receiver, uint256[5] memory balances) internal {
        for (uint256 i = 0; i < 5; i++) {
            if (balances[i] > 0) {
                safeTransferNative(IERC20(zunami.tokens(i)), receiver, balances[i]);
            }
        }
    }

    function tokensBalances() public view returns (uint256[5] memory balances) {
        return [
            balanceOfNative(IERC20(zunami.tokens(0))),
            balanceOfNative(IERC20(zunami.tokens(1))),
            balanceOfNative(IERC20(zunami.tokens(2))),
            balanceOfNative(IERC20(zunami.tokens(3))),
            balanceOfNative(IERC20(zunami.tokens(4)))
        ];
    }

    function calcBalancesProportion(uint256[5] memory balances, uint256 proportion)
        public
        pure
        returns (uint256[5] memory)
    {
        return [
            balances[0].mulDiv(proportion, DEFAULT_DECIMALS_FACTOR),
            balances[1].mulDiv(proportion, DEFAULT_DECIMALS_FACTOR),
            balances[2].mulDiv(proportion, DEFAULT_DECIMALS_FACTOR),
            balances[3].mulDiv(proportion, DEFAULT_DECIMALS_FACTOR),
            balances[4].mulDiv(proportion, DEFAULT_DECIMALS_FACTOR)
        ];
    }

    function balanceOfNative(IERC20 token_) internal view returns (uint256) {
        if (address(token_) == address(0)) return 0;
        if (address(token_) == ETH_MOCK_ADDRESS) {
            return address(this).balance;
        } else {
            return token_.balanceOf(address(this));
        }
    }

    function safeTransferNative(
        IERC20 token,
        address receiver,
        uint256 amount
    ) internal {
        if (address(token) == ETH_MOCK_ADDRESS) {
            receiver.call{ value: amount }(''); // don't fail if user contract doesn't accept ETH
        } else {
            SafeERC20.safeTransfer(token, receiver,amount);
        }
    }
}
