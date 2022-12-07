// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../ElasticERC20RigidExtension.sol';
import '../RigidAddressSet.sol';
import './PricableAssetMock.sol';

// mock class using ERC20
contract ElasticERC20RigidExtensionMock is ElasticERC20RigidExtension, PricableAssetMock, RigidAddressSet {
    constructor(
        string memory name,
        string memory symbol,
        address priceOracle,
        address initialAccount,
        uint256 initialNominalBalance,
        uint256 initialBalance
    ) payable ElasticERC20(name, symbol) PricableAssetMock(priceOracle) {
        cacheAssetPrice();

        if (initialAccount != address(0)) {
            _mintElastic(initialAccount, initialNominalBalance, initialBalance);
        }
    }

    function mint(
        address account,
        uint256 nominalAmount,
        uint256 amount
    ) public {
        _mintElastic(account, nominalAmount, amount);
    }

    function burn(
        address account,
        uint256 nominalAmount,
        uint256 amount
    ) public {
        _burnElastic(account, nominalAmount, amount);
    }

    function transferElasticInternal(
        address from,
        address to,
        uint256 nominalAmount,
        uint256 value
    ) public {
        _transferElastic(from, to, nominalAmount, value);
    }

    function transferRigidInternal(
        address from,
        address to,
        uint256 value
    ) public {
        _transferRigid(from, to, value);
    }

    function approveInternal(
        address owner,
        address spender,
        uint256 value
    ) public {
        if(containRigidAddress(owner)) _approveRigid(owner, spender, value);
        else _approveElastic(owner, spender, value);
    }

    function containRigidAddress(address _rigidAddress) public view override returns(bool) {
        return _containRigidAddress(_rigidAddress);
    }

    function addRigidAddress(address _rigidAddress) public {
        require(!containRigidAddress(_rigidAddress), "Not elastic address");
        uint256 balanceElastic = balanceOf(_rigidAddress);
        _addRigidAddress(_rigidAddress);
        if(balanceElastic > 0) {
            _convertElasticToRigidBalancePartially(_rigidAddress, balanceElastic);
        }
    }

    function removeRigidAddress(address _rigidAddress) public {
        require(containRigidAddress(_rigidAddress), "Not rigid address");
        uint256 balanceRigid = balanceOf(_rigidAddress);
        _removeRigidAddress(_rigidAddress);
        if(balanceRigid > 0) {
            _convertRigidToElasticBalancePartially(_rigidAddress, balanceRigid);
        }
    }
}
