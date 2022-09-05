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

    it('should be reverted in case a zero price oracle', async () => {
        await expect(
            pricableAssetContract.changePriceOracle(ethers.constants.AddressZero)
        ).revertedWith('Zero price oracle');
    });

    it('should return cached price when current price decreased ', async () => {
        const cachedPrice = utils.parseEther('555');

        // Init price
        await mockAssetPriceOracle.mock.lpPrice.returns(cachedPrice);
        await expect(pricableAssetContract.assetPriceCachedInternal())
            .to.emit(pricableAssetContract, 'CachedAssetPrice')
            .withArgs((await provider.getBlockNumber()) + 1, cachedPrice);

        // Decrease price
        await mockAssetPriceOracle.mock.lpPrice.returns(utils.parseEther('444'));

        // Should return cached price
        await pricableAssetContract.assetPriceCachedInternal();
        expect(await pricableAssetContract.cachedAssetPrice()).to.eq(cachedPrice);
    });

    // In this case block numbers are different, _c_cachedBlock = 0 but block.number > 0
    it('should return initial zero price for operations in one block', async () => {
        // Fix a block
        ethers.provider.send('evm_setAutomine', [false]);
        ethers.provider.send('evm_setIntervalMining', [0]);
        const initialBlockNumber = await provider.getBlockNumber();
        const initialPrice = await pricableAssetContract.cachedAssetPrice();

        // Change price
        const cachedPrice = utils.parseEther('555');
        await mockAssetPriceOracle.mock.lpPrice.returns(cachedPrice);
        await pricableAssetContract.assetPriceCachedInternal();
        const currentBlockNumber = await provider.getBlockNumber();

        // Should be same block and cached price
        expect(currentBlockNumber).to.eq(initialBlockNumber);
        expect(await pricableAssetContract.cachedAssetPrice()).to.eq(initialPrice);

        ethers.provider.send('evm_setAutomine', [true]);
    });

    // In this case block numbers are different
    it('should return cached price for operations in one block', async () => {
        const initPrice = utils.parseEther('555');
        await mockAssetPriceOracle.mock.lpPrice.returns(initPrice);
        await pricableAssetContract.assetPriceCachedInternal();

        // Fix a block
        ethers.provider.send('evm_setAutomine', [false]);
        ethers.provider.send('evm_setIntervalMining', [0]);
        const initialBlockNumber = await provider.getBlockNumber();
        const currentPrice = await pricableAssetContract.cachedAssetPrice();

        // Change price
        const newPrice = utils.parseEther('444');
        await mockAssetPriceOracle.mock.lpPrice.returns(newPrice);
        await pricableAssetContract.assetPriceCachedInternal();

        const currentBlockNumber = await provider.getBlockNumber();

        // Should be same block and cached price
        expect(currentBlockNumber).to.eq(initialBlockNumber);
        expect(await pricableAssetContract.cachedAssetPrice()).to.eq(currentPrice);

        ethers.provider.send('evm_setAutomine', [true]);
    });

    // In this case block numbers are equals
    it('should return cached price when block numbers are equals', async () => {
        // Fix a block
        ethers.provider.send('evm_setAutomine', [false]);
        ethers.provider.send('evm_setIntervalMining', [0]);
        const initPrice = utils.parseEther('555');
        await mockAssetPriceOracle.mock.lpPrice.returns(initPrice);
        await pricableAssetContract.assetPriceCachedInternal();
        const initialBlockNumber = await provider.getBlockNumber();
        const currentPrice = await pricableAssetContract.cachedAssetPrice();

        // Change price
        const newPrice = utils.parseEther('444');
        await mockAssetPriceOracle.mock.lpPrice.returns(newPrice);
        await pricableAssetContract.assetPriceCachedInternal();

        const currentBlockNumber = await provider.getBlockNumber();

        // Should be same block and cached price
        expect(currentBlockNumber).to.eq(initialBlockNumber);
        expect(await pricableAssetContract.cachedAssetPrice()).to.eq(currentPrice);

        ethers.provider.send('evm_setAutomine', [true]);
    });
});
