import { waffle, artifacts, ethers } from 'hardhat';
import { expect } from 'chai';
import { MockContract } from 'ethereum-waffle';
import { Contract, ContractFactory, utils, Wallet } from 'ethers';
import { Artifact } from 'hardhat/types';

const { deployMockContract, provider } = waffle;

describe('PricableAsset mock tests', async () => {
    let mockAssetPriceOracle: MockContract;
    let pricableAssetContract: Contract;
    let pricableAssetFactory: ContractFactory;

    beforeEach(async () => {
        const wallet: Wallet = provider.getWallets()[0];
        const assetPriceOracleArtifact: Artifact = await artifacts.readArtifact(
            'IAssetPriceOracle'
        );
        const pricableAssetArtifact: Artifact = await artifacts.readArtifact('PricableAssetMock');

        mockAssetPriceOracle = await deployMockContract(wallet, assetPriceOracleArtifact.abi);

        pricableAssetFactory = new ContractFactory(
            pricableAssetArtifact.abi,
            pricableAssetArtifact.bytecode,
            wallet
        );

        pricableAssetContract = await pricableAssetFactory.deploy(mockAssetPriceOracle.address);
    });

    it('should get asset price', async () => {
        await mockAssetPriceOracle.mock.lpPrice.returns(utils.parseEther('555'));
        expect(await pricableAssetContract.assetPrice()).to.eq(utils.parseEther('555'));
    });

    it('should return cached price when current price decreased ', async () => {
        const cachedPrice = utils.parseEther('555');

        // Init price
        await mockAssetPriceOracle.mock.lpPrice.returns(cachedPrice);
        await expect(pricableAssetContract.assetPriceCachedMock())
            .to.emit(pricableAssetContract, 'CachedAssetPrice')
            .withArgs((await provider.getBlockNumber()) + 1, cachedPrice);

        // Decrease price
        await mockAssetPriceOracle.mock.lpPrice.returns(utils.parseEther('444'));

        // Should return cached price
        await pricableAssetContract.assetPriceCachedMock();
        expect(await pricableAssetContract.cachedAssetPrice()).to.eq(cachedPrice);
    });

    it('should return cached price for operations in one block', async () => {
        // Fix a block
        ethers.provider.send('evm_setAutomine', [false]);
        ethers.provider.send('evm_setIntervalMining', [0]);
        const initialBlockNumber = await provider.getBlockNumber();
        const initialPrice = await pricableAssetContract.cachedAssetPrice();

        // Change price
        const cachedPrice = utils.parseEther('555');
        await mockAssetPriceOracle.mock.lpPrice.returns(cachedPrice);
        await pricableAssetContract.assetPriceCachedMock();

        const currentBlockNumber = await provider.getBlockNumber();

        // Should be same block and cached price
        expect(currentBlockNumber).to.eq(initialBlockNumber);
        expect(await pricableAssetContract.cachedAssetPrice()).to.eq(initialPrice);
    });
});
