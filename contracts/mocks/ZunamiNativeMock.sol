// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '../interfaces/IZunamiNative.sol';
import '../interfaces/IZunamiStrategyNative.sol';

contract ZunamiNativeMock is ERC20, IZunamiNative {
    PoolInfo[] internal _poolInfo;

    address[5] public tokens;

    constructor(address[5] memory _tokens) ERC20('Zunami Native Test', 'ZLPNT') {
        tokens = _tokens;
    }

    receive() external payable {
        // receive ETH after unwrap
    }

    function addPool(address _strategyAddr) external {
        _poolInfo.push(
            PoolInfo({
                strategy: IZunamiStrategyNative(_strategyAddr),
                startTime: block.timestamp,
                lpShares: 0
            })
        );
    }

    function setLpShares(uint256 pid, uint256 lpShares) external {
        _poolInfo[pid].lpShares = lpShares;
    }

    function delegateWithdrawal(uint256 lpShares, uint256[5] memory) external {
    }

    function poolInfo(uint256 pid) external view returns (PoolInfo memory) {
        return _poolInfo[pid];
    }

    function poolCount() external view returns (uint256) {
        return _poolInfo.length;
    }

    function mint(address account, uint256 amount) public {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) public {
        _burn(account, amount);
    }
}
