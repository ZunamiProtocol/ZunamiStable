// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '../ZunamiElasticRigidVault.sol';

contract ZunamiElasticRigidVaultMock is ZunamiElasticRigidVault {
    constructor(
        IERC20Metadata asset,
        address priceOracle,
        string memory name,
        string memory symbol
    ) ElasticERC20(name, symbol) ElasticRigidVault(asset) ZunamiElasticRigidVault(priceOracle) {
        cacheAssetPrice();
    }

    function mockMint(
        address account,
        uint256 nominalAmount,
        uint256 amount
    ) public {
        _mintElastic(account, nominalAmount, amount);
    }

    function mockBurn(
        address account,
        uint256 nominalAmount,
        uint256 amount
    ) public {
        _burnElastic(account, nominalAmount, amount);
    }
}
