// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '../PricableAsset.sol';

contract PricableAssetMock is PricableAsset {
    uint256 public cachedAssetPrice;

    constructor(address priceOracle_) PricableAsset(priceOracle_) {}

    function assetPriceCachedInternal() external {
        cachedAssetPrice = assetPriceCached();
    }
}
