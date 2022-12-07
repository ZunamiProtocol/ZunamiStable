const { BN, constants, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const ERC20DecimalsMock = artifacts.require('ERC20DecimalsMock');
const ZunamiElasticRigidVaultMock = artifacts.require('ZunamiElasticRigidVaultMock');
const AssetPriceOracleMock = artifacts.require('AssetPriceOracleMock');

const one = new BN(10).pow(new BN(18));
const parseToken = (token) => new BN(token).mul(one);
const parseShare = (share) => new BN(share).mul(one);

const mulNorm = (amount, price) => new BN(amount).mul(new BN(price)).div(one);
const divNorm = (amount, price) => new BN(amount).mul(one).div(new BN(price));

contract('ElasticRigidVault', function (accounts) {
    const [holder, recipient, spender, other, user1, user2] = accounts;

    const name = 'My Token';
    const symbol = 'MTKN';

    const initialPrice = one.muln(1); // 1
    const updatedPrice = new BN('1500000000000000000'); // 1.5 * 10^18

    beforeEach(async function () {
        this.assetPricer = await AssetPriceOracleMock.new();
        await this.assetPricer.setAssetPriceInternal(initialPrice);
        this.token = await ERC20DecimalsMock.new(name, symbol, 18);
        this.vault = await ZunamiElasticRigidVaultMock.new(
            this.token.address,
            this.assetPricer.address,
            name + ' Vault',
            symbol + 'V'
        );

        await this.token.mint(holder, web3.utils.toWei('100'));
        await this.token.approve(this.vault.address, constants.MAX_UINT256, { from: holder });
        await this.vault.approve(spender, constants.MAX_UINT256, { from: holder });
        await this.assetPricer.setAssetPriceInternal(updatedPrice);
        await this.vault.cacheAssetPrice();
    });

    it('metadata', async function () {
        expect(await this.vault.name()).to.be.equal(name + ' Vault');
        expect(await this.vault.symbol()).to.be.equal(symbol + 'V');
        expect(await this.vault.decimals()).to.be.bignumber.equal('18');
        expect(await this.vault.asset()).to.be.equal(this.token.address);
    });

    describe('empty vault: no assets & no shares', function () {
        it('status', async function () {
            expect(await this.vault.totalAssets()).to.be.bignumber.equal('0');
        });

        it('deposit', async function () {
            expect(await this.vault.maxDeposit(holder)).to.be.bignumber.equal(
                constants.MAX_UINT256
            );
            expect(await this.vault.previewDeposit(parseToken(1))).to.be.bignumber.equal(
                mulNorm(parseShare(1), updatedPrice)
            );

            const { tx } = await this.vault.deposit(parseToken(1), recipient, { from: holder });

            await expectEvent.inTransaction(tx, this.token, 'Transfer', {
                from: holder,
                to: this.vault.address,
                value: parseToken(1),
            });

            await expectEvent.inTransaction(tx, this.vault, 'Transfer', {
                from: constants.ZERO_ADDRESS,
                to: recipient,
                value: "1500000000000000000", // parseShare(1.5),
            });
        });

        it('withdraw', async function () {
            expect(await this.vault.maxWithdraw(holder)).to.be.bignumber.equal('0');
            expect(await this.vault.previewWithdraw('0')).to.be.bignumber.equal('0');

            const { tx } = await this.vault.withdraw('0', recipient, holder, { from: holder });

            await expectEvent.inTransaction(tx, this.token, 'Transfer', {
                from: this.vault.address,
                to: recipient,
                value: '0',
            });

            await expectEvent.inTransaction(tx, this.vault, 'Transfer', {
                from: holder,
                to: constants.ZERO_ADDRESS,
                value: '0',
            });
        });
    });

    describe('partially empty vault: assets & no shares', function () {
        beforeEach(async function () {
            await this.token.mint(this.vault.address, parseToken(1)); // 1 token
        });

        it('status', async function () {
            expect(await this.vault.totalAssets()).to.be.bignumber.equal(parseToken(1));
        });

        it('deposit', async function () {
            expect(await this.vault.maxDeposit(holder)).to.be.bignumber.equal(
                constants.MAX_UINT256
            );
            expect(await this.vault.previewDeposit(parseToken(1))).to.be.bignumber.equal(
                mulNorm(parseShare(1), updatedPrice)
            );

            const { tx } = await this.vault.deposit(parseToken(1), recipient, { from: holder });

            await expectEvent.inTransaction(tx, this.token, 'Transfer', {
                from: holder,
                to: this.vault.address,
                value: parseToken(1),
            });

            await expectEvent.inTransaction(tx, this.vault, 'Transfer', {
                from: constants.ZERO_ADDRESS,
                to: recipient,
                value: "1500000000000000000",//parseShare(1.5),
            });
        });

        it('withdraw', async function () {
            expect(await this.vault.maxWithdraw(holder)).to.be.bignumber.equal('0');
            expect(await this.vault.previewWithdraw('0')).to.be.bignumber.equal('0');

            const { tx } = await this.vault.withdraw('0', recipient, holder, { from: holder });

            await expectEvent.inTransaction(tx, this.token, 'Transfer', {
                from: this.vault.address,
                to: recipient,
                value: '0',
            });

            await expectEvent.inTransaction(tx, this.vault, 'Transfer', {
                from: holder,
                to: constants.ZERO_ADDRESS,
                value: '0',
            });
        });
    });

    describe('partially empty vault: shares & no assets', function () {
        beforeEach(async function () {
            await this.vault.mockMint(holder, parseShare(1), mulNorm(parseShare(1), updatedPrice));
        });

        it('status', async function () {
            expect(await this.vault.totalAssets()).to.be.bignumber.equal('0');
        });

        it('deposit', async function () {
            expect(await this.vault.maxDeposit(holder)).to.be.bignumber.equal('0');

            // Can deposit 0 (max deposit)
            const { tx } = await this.vault.deposit(0, recipient, { from: holder });

            await expectEvent.inTransaction(tx, this.token, 'Transfer', {
                from: holder,
                to: this.vault.address,
                value: "0",
            });

            await expectEvent.inTransaction(tx, this.vault, 'Transfer', {
                from: constants.ZERO_ADDRESS,
                to: recipient,
                value: "0",
            });

            // Cannot deposit more than 0
            await expectRevert(
                this.vault.deposit(parseToken(1), recipient, { from: holder }),
                'ElasticVault: deposit more than max'
            );
        });

        it('withdraw', async function () {
            expect(await this.vault.maxWithdraw(holder)).to.be.bignumber.equal(
                mulNorm(parseToken(1), updatedPrice)
            );
            expect(await this.vault.previewWithdraw('0')).to.be.bignumber.equal('0');
            const { tx } = await this.vault.withdraw('0', recipient, holder, { from: holder });

            await expectEvent.inTransaction(tx, this.token, 'Transfer', {
                from: this.vault.address,
                to: recipient,
                value: '0',
            });

            await expectEvent.inTransaction(tx, this.vault, 'Transfer', {
                from: holder,
                to: constants.ZERO_ADDRESS,
                value: '0',
            });
        });
    });

    describe('full vault: assets & shares', function () {
        beforeEach(async function () {
            await this.token.mint(this.vault.address, parseToken(1)); // 1 tokens
            await this.vault.mockMint(holder, parseShare(100), parseShare(100)); // 100 share
        });

        it('status', async function () {
            expect(await this.vault.totalAssets()).to.be.bignumber.equal(parseToken(1));
        });

        it('deposit', async function () {
            expect(await this.vault.maxDeposit(holder)).to.be.bignumber.equal(
                constants.MAX_UINT256
            );
            expect(await this.vault.previewDeposit(parseToken(1))).to.be.bignumber.equal(
                mulNorm(parseShare(1), updatedPrice)
            );

            const { tx } = await this.vault.deposit(parseToken(1), recipient, { from: holder });

            await expectEvent.inTransaction(tx, this.token, 'Transfer', {
                from: holder,
                to: this.vault.address,
                value: parseToken(1),
            });

            await expectEvent.inTransaction(tx, this.vault, 'Transfer', {
                from: constants.ZERO_ADDRESS,
                to: recipient,
                value: "1500000000000000000",// parseShare(1.5),
            });
        });

        it('withdraw', async function () {
            expect(await this.vault.maxWithdraw(holder)).to.be.bignumber.equal(
                mulNorm(parseToken(100), updatedPrice)
            );
            expect(await this.vault.previewWithdraw(parseToken(1))).to.be.bignumber.equal(
                divNorm(parseShare(1), updatedPrice)
            );

            const { tx } = await this.vault.withdraw(parseToken(1), recipient, holder, {
                from: holder,
            });

            await expectEvent.inTransaction(tx, this.token, 'Transfer', {
                from: this.vault.address,
                to: recipient,
                value: "666666666666666666",
            });

            await expectEvent.inTransaction(tx, this.vault, 'Transfer', {
                from: holder,
                to: constants.ZERO_ADDRESS,
                value: parseShare(1),
            });
        });

        it('withdraw with approval', async function () {
            await expectRevert(
                this.vault.withdraw(parseToken(1), recipient, holder, { from: other }),
                'ERC20: insufficient allowance'
            );

            await this.vault.withdraw(parseToken(1), recipient, holder, { from: spender });
        });
    });

    /// Scenario inspired by solmate ERC4626 tests:
    /// https://github.com/transmissions11/solmate/blob/main/src/test/ERC4626.t.sol
    it('multiple mint, deposit, redeem & withdrawal', async function () {
        // test designed with both asset using similar decimals
        this.assetPricer = await AssetPriceOracleMock.new();
        await this.assetPricer.setAssetPriceInternal(initialPrice);

        this.token = await ERC20DecimalsMock.new(name, symbol, 18);
        this.vault = await ZunamiElasticRigidVaultMock.new(
            this.token.address,
            this.assetPricer.address,
            name + ' Vault',
            symbol + 'V'
        );

        await this.token.mint(user1, 5000);
        await this.token.mint(user2, 4000);
        await this.token.approve(this.vault.address, 5000, { from: user1 });
        await this.token.approve(this.vault.address, 4000, { from: user2 });

        // 1. Alice mints 2000 shares (costs 2000 tokens)
        {
            const { tx } = await this.vault.deposit(2000, user1, { from: user1 });
            await expectEvent.inTransaction(tx, this.token, 'Transfer', {
                from: user1,
                to: this.vault.address,
                value: '2000',
            });
            await expectEvent.inTransaction(tx, this.vault, 'Transfer', {
                from: constants.ZERO_ADDRESS,
                to: user1,
                value: '2000',
            });

            expect(await this.vault.previewDeposit(2000)).to.be.bignumber.equal('2000');
            expect(await this.vault.balanceOf(user1)).to.be.bignumber.equal('2000');
            expect(await this.vault.balanceOf(user2)).to.be.bignumber.equal('0');
            expect(
                await this.vault.convertToValue(await this.vault.balanceOf(user1))
            ).to.be.bignumber.equal('2000');
            expect(
                await this.vault.convertToValue(await this.vault.balanceOf(user2))
            ).to.be.bignumber.equal('0');
            expect(await this.vault.totalSupply()).to.be.bignumber.equal('2000');
            expect(await this.vault.totalAssets()).to.be.bignumber.equal('2000');
        }

        // 2. Bob deposits 4000 tokens (mints 4000 shares)
        {
            const { tx } = await this.vault.deposit(4000, user2, { from: user2 });
            await expectEvent.inTransaction(tx, this.token, 'Transfer', {
                from: user2,
                to: this.vault.address,
                value: '4000',
            });
            await expectEvent.inTransaction(tx, this.vault, 'Transfer', {
                from: constants.ZERO_ADDRESS,
                to: user2,
                value: '4000',
            });

            expect(await this.vault.balanceOf(user1)).to.be.bignumber.equal('2000');
            expect(await this.vault.balanceOfNominal(user1)).to.be.bignumber.equal('2000');
            expect(await this.vault.previewWithdraw('2000')).to.be.bignumber.equal('2000');
            expect(await this.vault.balanceOf(user2)).to.be.bignumber.equal('4000');
            expect(await this.vault.balanceOfNominal(user2)).to.be.bignumber.equal('4000');
            expect(await this.vault.previewWithdraw('4000')).to.be.bignumber.equal('4000');
            expect(
                await this.vault.convertToValue(await this.vault.balanceOfNominal(user1))
            ).to.be.bignumber.equal('2000');
            expect(
                await this.vault.convertToValue(await this.vault.balanceOfNominal(user2))
            ).to.be.bignumber.equal('4000');
            expect(await this.vault.totalSupply()).to.be.bignumber.equal('6000');
            expect(await this.vault.totalAssets()).to.be.bignumber.equal('6000');
        }

        // 3. Vault mutates by asset price 1.5 per asset
        await this.assetPricer.setAssetPriceInternal(updatedPrice);
        await this.vault.cacheAssetPrice();
        expect(await this.vault.balanceOf(user1)).to.be.bignumber.equal('3000');
        expect(await this.vault.balanceOfNominal(user1)).to.be.bignumber.equal('2000');
        expect(await this.vault.previewWithdraw(3000)).to.be.bignumber.equal('2000');
        expect(await this.vault.balanceOf(user2)).to.be.bignumber.equal('6000');
        expect(await this.vault.balanceOfNominal(user2)).to.be.bignumber.equal('4000');
        expect(await this.vault.previewWithdraw(6000)).to.be.bignumber.equal('4000');
        expect(
            await this.vault.convertToValue(await this.vault.balanceOfNominal(user1))
        ).to.be.bignumber.equal('3000');
        expect(
            await this.vault.convertToValue(await this.vault.balanceOfNominal(user2))
        ).to.be.bignumber.equal('6000');
        expect(await this.vault.totalSupply()).to.be.bignumber.equal('9000');
        expect(await this.vault.totalAssets()).to.be.bignumber.equal('6000');

        // 4. Alice deposits 2000 tokens (mints 3000 shares)
        {
            const { tx } = await this.vault.deposit(2000, user1, { from: user1 });
            await expectEvent.inTransaction(tx, this.token, 'Transfer', {
                from: user1,
                to: this.vault.address,
                value: '2000',
            });
            await expectEvent.inTransaction(tx, this.vault, 'Transfer', {
                from: constants.ZERO_ADDRESS,
                to: user1,
                value: '3000',
            });

            expect(await this.vault.balanceOf(user1)).to.be.bignumber.equal('6000');
            expect(await this.vault.balanceOfNominal(user1)).to.be.bignumber.equal('4000');
            expect(await this.vault.previewWithdraw(6000)).to.be.bignumber.equal('4000');
            expect(await this.vault.balanceOf(user2)).to.be.bignumber.equal('6000');
            expect(await this.vault.balanceOfNominal(user2)).to.be.bignumber.equal('4000');
            expect(await this.vault.previewWithdraw(6000)).to.be.bignumber.equal('4000');
            expect(
                await this.vault.convertToValue(await this.vault.balanceOfNominal(user1))
            ).to.be.bignumber.equal('6000');
            expect(
                await this.vault.convertToValue(await this.vault.balanceOfNominal(user2))
            ).to.be.bignumber.equal('6000');
            expect(await this.vault.totalSupply()).to.be.bignumber.equal('12000');
            expect(await this.vault.totalAssets()).to.be.bignumber.equal('8000');
        }

        // 5. Vault mutates by asset price 1.8 per asset
        await this.assetPricer.setAssetPriceInternal(new BN('1800000000000000000'));
        await this.vault.cacheAssetPrice();

        expect(await this.vault.balanceOf(user1)).to.be.bignumber.equal('7200');
        expect(await this.vault.balanceOfNominal(user1)).to.be.bignumber.equal('4000');
        expect(await this.vault.balanceOf(user2)).to.be.bignumber.equal('7200');
        expect(await this.vault.balanceOfNominal(user2)).to.be.bignumber.equal('4000');
        expect(
            await this.vault.convertToValue(await this.vault.balanceOfNominal(user1))
        ).to.be.bignumber.equal('7200');
        expect(
            await this.vault.convertToValue(await this.vault.balanceOfNominal(user2))
        ).to.be.bignumber.equal('7200');
        expect(await this.vault.totalSupply()).to.be.bignumber.equal('14400');
        expect(await this.vault.totalAssets()).to.be.bignumber.equal('8000');

        // 6. Alice withdraw 2428 assets (1348 shares)
        {
            const { tx } = await this.vault.withdraw(2428, user1, user1, { from: user1 });
            await expectEvent.inTransaction(tx, this.vault, 'Transfer', {
                from: user1,
                to: constants.ZERO_ADDRESS,
                value: '2428',
            });
            await expectEvent.inTransaction(tx, this.token, 'Transfer', {
                from: this.vault.address,
                to: user1,
                value: '1348',
            });

            expect(await this.vault.balanceOf(user1)).to.be.bignumber.equal('4773');
            expect(await this.vault.balanceOfNominal(user1)).to.be.bignumber.equal('2652');
            expect(await this.vault.previewWithdraw(4773)).to.be.bignumber.equal('2651');
            expect(await this.vault.balanceOf(user2)).to.be.bignumber.equal('7200');
            expect(await this.vault.balanceOfNominal(user2)).to.be.bignumber.equal('4000');
            expect(await this.vault.previewWithdraw(7200)).to.be.bignumber.equal('4000');
            expect(
                await this.vault.convertToValue(await this.vault.balanceOfNominal(user1))
            ).to.be.bignumber.equal('4773');
            expect(
                await this.vault.convertToValue(await this.vault.balanceOfNominal(user2))
            ).to.be.bignumber.equal('7200');
            expect(await this.vault.totalSupply()).to.be.bignumber.equal('11973');
            expect(await this.vault.totalAssets()).to.be.bignumber.equal('6652');
        }

        // 7. Bob withdraws 2929 assets (1627 shares)
        {
            const { tx } = await this.vault.withdraw(2929, user2, user2, { from: user2 });
            await expectEvent.inTransaction(tx, this.vault, 'Transfer', {
                from: user2,
                to: constants.ZERO_ADDRESS,
                value: '2929',
            });
            await expectEvent.inTransaction(tx, this.token, 'Transfer', {
                from: this.vault.address,
                to: user2,
                value: '1627',
            });

            expect(await this.vault.balanceOf(user1)).to.be.bignumber.equal('4773');
            expect(await this.vault.balanceOfNominal(user1)).to.be.bignumber.equal('2652');
            expect(await this.vault.previewWithdraw(4773)).to.be.bignumber.equal('2651');
            expect(await this.vault.balanceOf(user2)).to.be.bignumber.equal('4271');
            expect(await this.vault.balanceOfNominal(user2)).to.be.bignumber.equal('2373');
            expect(await this.vault.previewWithdraw(4271)).to.be.bignumber.equal('2372');
            expect(
                await this.vault.convertToValue(await this.vault.balanceOfNominal(user1))
            ).to.be.bignumber.equal('4773');
            expect(
                await this.vault.convertToValue(await this.vault.balanceOfNominal(user2))
            ).to.be.bignumber.equal('4271');
            expect(await this.vault.totalSupply()).to.be.bignumber.equal('9045');
            expect(await this.vault.totalAssets()).to.be.bignumber.equal('5025');
        }

        // 8. Vault mutates by asset price 2.1 per asset
        await this.assetPricer.setAssetPriceInternal(new BN('2100000000000000000'));
        await this.vault.cacheAssetPrice();

        expect(await this.vault.balanceOf(user1)).to.be.bignumber.equal('5569');
        expect(await this.vault.balanceOfNominal(user1)).to.be.bignumber.equal('2652');
        expect(await this.vault.previewWithdraw(5569)).to.be.bignumber.equal('2651');
        expect(await this.vault.balanceOf(user2)).to.be.bignumber.equal('4983');
        expect(await this.vault.balanceOfNominal(user2)).to.be.bignumber.equal('2373');
        expect(await this.vault.previewWithdraw(4983)).to.be.bignumber.equal('2372');
        expect(
            await this.vault.convertToValue(await this.vault.balanceOfNominal(user1))
        ).to.be.bignumber.equal('5569');
        expect(
            await this.vault.convertToValue(await this.vault.balanceOfNominal(user2))
        ).to.be.bignumber.equal('4983');
        expect(await this.vault.totalSupply()).to.be.bignumber.equal('10552');
        expect(await this.vault.totalAssets()).to.be.bignumber.equal('5025');

        // 9. Alice withdraws all 5569 assets
        // NOTE: Bob's assets have been rounded back up
        {
            const { tx } = await this.vault.withdraw(5569, user1, user1, { from: user1 });
            await expectEvent.inTransaction(tx, this.vault, 'Transfer', {
                from: user1,
                to: constants.ZERO_ADDRESS,
                value: '5569',
            });
            await expectEvent.inTransaction(tx, this.token, 'Transfer', {
                from: this.vault.address,
                to: user1,
                value: '2651',
            });

            expect(await this.vault.balanceOf(user1)).to.be.bignumber.equal('2');
            expect(await this.vault.balanceOfNominal(user1)).to.be.bignumber.equal('1');
            expect(await this.vault.balanceOf(user2)).to.be.bignumber.equal('4983');
            expect(await this.vault.balanceOfNominal(user2)).to.be.bignumber.equal('2373');
            expect(await this.vault.previewWithdraw(4983)).to.be.bignumber.equal('2372');
            expect(
                await this.vault.convertToValue(await this.vault.balanceOfNominal(user1))
            ).to.be.bignumber.equal('2');
            expect(
                await this.vault.convertToValue(await this.vault.balanceOfNominal(user2))
            ).to.be.bignumber.equal('4983');
            expect(await this.vault.totalSupply()).to.be.bignumber.equal('4985');
            expect(await this.vault.totalAssets()).to.be.bignumber.equal('2374');
        }

        // 10. Bob withdraw all
        {
            const { tx } = await this.vault.withdrawAll(user2, user2, { from: user2 });
            await expectEvent.inTransaction(tx, this.vault, 'Transfer', {
                from: user2,
                to: constants.ZERO_ADDRESS,
                value: '4983',
            });
            await expectEvent.inTransaction(tx, this.token, 'Transfer', {
                from: this.vault.address,
                to: user2,
                value: '2373',
            });

            expect(await this.vault.balanceOf(user1)).to.be.bignumber.equal('2');
            expect(await this.vault.balanceOfNominal(user1)).to.be.bignumber.equal('1');
            expect(await this.vault.balanceOf(user2)).to.be.bignumber.equal('0');
            expect(await this.vault.balanceOfNominal(user2)).to.be.bignumber.equal('0');
            expect(
                await this.vault.convertToValue(await this.vault.balanceOfNominal(user1))
            ).to.be.bignumber.equal('2');
            expect(
                await this.vault.convertToValue(await this.vault.balanceOfNominal(user2))
            ).to.be.bignumber.equal('0');
            expect(await this.vault.totalSupply()).to.be.bignumber.equal('2');
            expect(await this.vault.totalAssets()).to.be.bignumber.equal('1');
        }

        // 11. Alice withdraw all
        {
            const { tx } = await this.vault.withdrawAll(user1, user1, { from: user1 });
            await expectEvent.inTransaction(tx, this.vault, 'Transfer', {
                from: user1,
                to: constants.ZERO_ADDRESS,
                value: '2',
            });
            await expectEvent.inTransaction(tx, this.token, 'Transfer', {
                from: this.vault.address,
                to: user1,
                value: '1',
            });

            expect(await this.vault.balanceOf(user1)).to.be.bignumber.equal('0');
            expect(await this.vault.balanceOfNominal(user1)).to.be.bignumber.equal('0');
            expect(await this.vault.balanceOf(user2)).to.be.bignumber.equal('0');
            expect(await this.vault.balanceOfNominal(user2)).to.be.bignumber.equal('0');
            expect(
                await this.vault.convertToValue(await this.vault.balanceOfNominal(user1))
            ).to.be.bignumber.equal('0');
            expect(
                await this.vault.convertToValue(await this.vault.balanceOfNominal(user2))
            ).to.be.bignumber.equal('0');
            expect(await this.vault.totalSupply()).to.be.bignumber.equal('0');
            expect(await this.vault.totalAssets()).to.be.bignumber.equal('0');
        }
    });
});
