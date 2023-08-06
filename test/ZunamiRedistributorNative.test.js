const { BN, balance, send } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const ZunamiMock = artifacts.require('ZunamiNativeMock');
const ZunamiStrategyMock = artifacts.require('ZunamiStrategyNativeMock');
const ZunamiRedistributor = artifacts.require('ZunamiRedistributorNative');
const ERC20DecimalsMock = artifacts.require('ERC20DecimalsMock');

const one = new BN(10).pow(new BN(18));

contract('ZunamiRedistributorNative', function (accounts) {
    const [holder, recipient, spender, other, user1, user2] = accounts;

    beforeEach(async function () {
        this.tokens = await Promise.all([
            {address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'},
            await ERC20DecimalsMock.new('WETH', 'WETH', 18),
            await ERC20DecimalsMock.new('FRXETH', 'FRXETH', 18),
            {address: ethers.constants.AddressZero},
            {address: ethers.constants.AddressZero}
        ]);

        this.zunami = await ZunamiMock.new(this.tokens.map((t) => t.address));

        this.redistributor = await ZunamiRedistributor.new(this.zunami.address);
    });

    it('should be initiated', async function () {
        expect(await this.redistributor.zunami()).to.be.equal(this.zunami.address);
    });

    it('should redistribute value', async function () {
        const poolTotalShares = one.mul(new BN(100));
        await this.zunami.mint(holder, poolTotalShares);

        const poolCount = 5;
        const poolSharesPercents = [33, 1, 19, 20, 27].map((value) =>
            poolTotalShares.mul(new BN(value)).div(new BN(100))
        );
        const strategis = [];
        for (let pid = 0; pid < poolCount; pid++) {
            const strategy = await ZunamiStrategyMock.new(this.tokens.map((t) => t.address));
            strategis.push(strategy);
            await this.zunami.addPool(strategy.address);
            await this.zunami.setLpShares(pid, poolSharesPercents[pid]);
        }

        await this.zunami.approve(this.redistributor.address, poolTotalShares);

        await this.redistributor.requestRedistribution(poolTotalShares);

        const tokenValue = one.mul(new BN(100));

        await send.ether(holder, this.redistributor.address, tokenValue);
        await this.tokens[1].mint(this.redistributor.address, tokenValue);
        await this.tokens[2].mint(this.redistributor.address, tokenValue);

        for (let pid = 0; pid < poolCount; pid++) {
            expect(await balance.current(strategis[pid].address)).to.be.bignumber.equal(
                new BN(0)
            );
            expect(await this.tokens[1].balanceOf(strategis[pid].address)).to.be.bignumber.equal(
                new BN(0)
            );
            expect(await this.tokens[2].balanceOf(strategis[pid].address)).to.be.bignumber.equal(
                new BN(0)
            );
        }

        await this.redistributor.redistribute();

        for (let pid = 0; pid < poolCount; pid++) {
            expect(await balance.current(strategis[pid].address)).to.be.bignumber.equal(
                tokenValue.mul(poolSharesPercents[pid]).div(poolTotalShares)
            );
            expect(await this.tokens[1].balanceOf(strategis[pid].address)).to.be.bignumber.equal(
                tokenValue.mul(poolSharesPercents[pid]).div(poolTotalShares)
            );
            expect(await this.tokens[2].balanceOf(strategis[pid].address)).to.be.bignumber.equal(
                tokenValue.mul(poolSharesPercents[pid]).div(poolTotalShares)
            );
        }
    });
});
