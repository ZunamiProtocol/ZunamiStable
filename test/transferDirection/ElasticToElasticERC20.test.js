const { BN, constants, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { ZERO_ADDRESS } = constants;

const {
    shouldBehaveLikeElasticERC20,
    shouldBehaveLikeElasticERC20Transfer,
    shouldBehaveLikeElasticERC20Approve,
} = require('./ElasticERC20.behavior');

const ElasticERC20RigidExtensionMock = artifacts.require('ElasticERC20RigidExtensionMock');
const AssetPriceOracleMock = artifacts.require('AssetPriceOracleMock');

const one = new BN(10).pow(new BN(18));
const mulNorm = (amount, price) => new BN(amount).mul(new BN(price)).div(one);
const divNorm = (amount, price) => new BN(amount).mul(one).div(new BN(price));

contract('ElasticToElasticERC20', function (accounts) {
    const [initialHolder, recipient, anotherAccount] = accounts;

    const name = 'My Token';
    const symbol = 'MTKN';

    const initialPrice = one.muln(1); // 1
    const updatedPrice = new BN('1500000000000000000'); // 1.5 * 10^18

    const initialSupply = new BN(100);
    const initialNominalSupply = new BN(100); // asset price 1 (initialPrice)

    beforeEach(async function () {
        this.assetPricer = await AssetPriceOracleMock.new();
        await this.assetPricer.setAssetPriceInternal(initialPrice);
        this.token = await ElasticERC20RigidExtensionMock.new(
            name,
            symbol,
            this.assetPricer.address,
            initialHolder,
            initialNominalSupply,
            initialSupply
        );
        await this.assetPricer.setAssetPriceInternal(updatedPrice);
        await this.token.cacheAssetPrice();
    });

    shouldBehaveLikeElasticERC20(
        'ERC20',
        initialSupply,
        initialHolder,
        recipient,
        anotherAccount,
        updatedPrice
    );

    describe('decrease allowance', function () {
        describe('when the spender is not the zero address', function () {
            const spender = recipient;

            function shouldDecreaseApproval(amount) {
                describe('when there was no approved amount before', function () {
                    it('reverts', async function () {
                        await expectRevert(
                            this.token.decreaseAllowance(spender, amount, { from: initialHolder }),
                            'ERC20: decreased allowance below zero'
                        );
                    });
                });

                describe('when the spender had an approved amount', function () {
                    const approvedAmount = mulNorm(amount, updatedPrice);

                    beforeEach(async function () {
                        await this.token.approve(spender, approvedAmount, { from: initialHolder });
                    });

                    it('emits an approval event', async function () {
                        await expectEvent(
                            await this.token.decreaseAllowance(spender, approvedAmount, {
                                from: initialHolder,
                            }),
                            'Approval',
                            { owner: initialHolder, spender: spender, value: new BN(0) }
                        );
                    });

                    it('decreases the spender allowance subtracting the requested amount', async function () {
                        await this.token.decreaseAllowance(spender, approvedAmount.subn(1), {
                            from: initialHolder,
                        });

                        expect(
                            await this.token.allowance(initialHolder, spender)
                        ).to.be.bignumber.equal('1');
                    });

                    it('sets the allowance to zero when all allowance is removed', async function () {
                        await this.token.decreaseAllowance(spender, approvedAmount, {
                            from: initialHolder,
                        });
                        expect(
                            await this.token.allowance(initialHolder, spender)
                        ).to.be.bignumber.equal('0');
                    });

                    it('reverts when more than the full allowance is removed', async function () {
                        await expectRevert(
                            this.token.decreaseAllowance(spender, approvedAmount.addn(1), {
                                from: initialHolder,
                            }),
                            'ERC20: decreased allowance below zero'
                        );
                    });
                });
            }

            describe('when the sender has enough balance', function () {
                const amount = initialSupply;

                shouldDecreaseApproval(amount);
            });

            describe('when the sender does not have enough balance', function () {
                const amount = initialSupply.addn(1);

                shouldDecreaseApproval(amount);
            });
        });

        describe('when the spender is the zero address', function () {
            const amount = initialSupply;
            const spender = ZERO_ADDRESS;

            it('reverts', async function () {
                await expectRevert(
                    this.token.decreaseAllowance(spender, amount, { from: initialHolder }),
                    'ERC20: decreased allowance below zero'
                );
            });
        });
    });

    describe('increase allowance', function () {
        const amount = mulNorm(initialSupply);

        describe('when the spender is not the zero address', function () {
            const spender = recipient;

            describe('when the sender has enough balance', function () {
                it('emits an approval event', async function () {
                    await expectEvent(
                        await this.token.increaseAllowance(spender, amount, {
                            from: initialHolder,
                        }),
                        'Approval',
                        { owner: initialHolder, spender: spender, value: amount }
                    );
                });

                describe('when there was no approved amount before', function () {
                    it('approves the requested amount', async function () {
                        await this.token.increaseAllowance(spender, amount, {
                            from: initialHolder,
                        });

                        expect(
                            await this.token.allowance(initialHolder, spender)
                        ).to.be.bignumber.equal(amount);
                    });
                });

                describe('when the spender had an approved amount', function () {
                    beforeEach(async function () {
                        await this.token.approve(spender, new BN(1), { from: initialHolder });
                    });

                    it('increases the spender allowance adding the requested amount', async function () {
                        await this.token.increaseAllowance(spender, amount, {
                            from: initialHolder,
                        });

                        expect(
                            await this.token.allowance(initialHolder, spender)
                        ).to.be.bignumber.equal(amount.addn(1));
                    });
                });
            });

            describe('when the sender does not have enough balance', function () {
                const amount = mulNorm(initialSupply).addn(1);

                it('emits an approval event', async function () {
                    await expectEvent(
                        await this.token.increaseAllowance(spender, amount, {
                            from: initialHolder,
                        }),
                        'Approval',
                        { owner: initialHolder, spender: spender, value: amount }
                    );
                });

                describe('when there was no approved amount before', function () {
                    it('approves the requested amount', async function () {
                        await this.token.increaseAllowance(spender, amount, {
                            from: initialHolder,
                        });

                        expect(
                            await this.token.allowance(initialHolder, spender)
                        ).to.be.bignumber.equal(amount);
                    });
                });

                describe('when the spender had an approved amount', function () {
                    beforeEach(async function () {
                        await this.token.approve(spender, new BN(1), { from: initialHolder });
                    });

                    it('increases the spender allowance adding the requested amount', async function () {
                        await this.token.increaseAllowance(spender, amount, {
                            from: initialHolder,
                        });

                        expect(
                            await this.token.allowance(initialHolder, spender)
                        ).to.be.bignumber.equal(amount.addn(2)); // rounding
                    });
                });
            });
        });

        describe('when the spender is the zero address', function () {
            const spender = ZERO_ADDRESS;

            it('reverts', async function () {
                await expectRevert(
                    this.token.increaseAllowance(spender, amount, { from: initialHolder }),
                    'ERC20: approve to the zero address'
                );
            });
        });
    });

    describe('_mint', function () {
        const amount = new BN(50);
        it('rejects a null account', async function () {
            await expectRevert(
                this.token.mint(ZERO_ADDRESS, mulNorm(amount, updatedPrice), amount),
                'ERC20: mint to the zero address'
            );
        });

        describe('for a non zero account', function () {
            beforeEach('minting', async function () {
                this.receipt = await this.token.mint(
                    recipient,
                    amount,
                    mulNorm(amount, updatedPrice)
                );
            });

            it('increments totalSupply', async function () {
                const expectedSupply = mulNorm(initialSupply.add(amount), updatedPrice);
                expect(await this.token.totalSupply()).to.be.bignumber.equal(expectedSupply);
            });

            it('increments recipient balance', async function () {
                expect(await this.token.balanceOf(recipient)).to.be.bignumber.equal(
                    mulNorm(amount, updatedPrice)
                );
            });

            it('emits Transfer event', async function () {
                const event = await expectEvent(this.receipt, 'Transfer', {
                    from: ZERO_ADDRESS,
                    to: recipient,
                });

                expect(event.args.value).to.be.bignumber.equal(mulNorm(amount, updatedPrice));
            });
        });
    });

    describe('_burn', function () {
        it('rejects a null account', async function () {
            await expectRevert(
                this.token.burn(ZERO_ADDRESS, new BN(1), new BN(1)),
                'ERC20: burn from the zero address'
            );
        });

        it('rejects a null account (rounded)', async function () {
            await expectRevert(
                this.token.burn(ZERO_ADDRESS, mulNorm(new BN(10), updatedPrice), new BN(10)),
                'ERC20: burn from the zero address'
            );
        });

        describe('for a non zero account', function () {
            it('rejects burning more than balance', async function () {
                await expectRevert(
                    this.token.burn(
                        initialHolder,
                        mulNorm(initialSupply, updatedPrice).addn(1),
                        initialSupply.addn(1)
                    ),
                    'ERC20: burn amount exceeds balance'
                );
            });

            const describeBurn = function (description, amount) {
                describe(description, function () {
                    beforeEach('burning', async function () {
                        this.receipt = await this.token.burn(
                            initialHolder,
                            divNorm(amount, updatedPrice),
                            amount
                        );
                    });

                    it('decrements totalSupply', async function () {
                        const expectedSupply = mulNorm(initialSupply, updatedPrice).sub(amount);
                        expect(await this.token.totalSupply()).to.be.bignumber.equal(
                            expectedSupply
                        );
                    });

                    it('decrements initialHolder balance', async function () {
                        const expectedBalance = mulNorm(initialSupply, updatedPrice).sub(amount);
                        expect(await this.token.balanceOf(initialHolder)).to.be.bignumber.equal(
                            expectedBalance
                        );
                    });

                    it('emits Transfer event', async function () {
                        const event = await expectEvent(this.receipt, 'Transfer', {
                            from: initialHolder,
                            to: ZERO_ADDRESS,
                        });

                        expect(event.args.value).to.be.bignumber.equal(amount);
                    });
                });
            };

            describeBurn('for entire balance', mulNorm(initialSupply, updatedPrice));
            describeBurn(
                'for less amount than balance',
                mulNorm(initialSupply, updatedPrice).subn(1)
            );
        });
    });

    describe('_transfer', function () {
        shouldBehaveLikeElasticERC20Transfer(
            'ERC20',
            initialHolder,
            recipient,
            initialSupply,
            updatedPrice,
            function (from, to, amount) {
                return this.token.transferElasticInternal(from, to, divNorm(amount, updatedPrice), amount);
            }
        );

        describe('when the sender is the zero address', function () {
            it('reverts', async function () {
                await expectRevert(
                    this.token.transferElasticInternal(
                        ZERO_ADDRESS,
                        recipient,
                        initialSupply,
                        mulNorm(initialSupply, updatedPrice)
                    ),
                    'ERC20: transfer from the zero address'
                );
            });
        });
    });

    describe('_approve', function () {
        shouldBehaveLikeElasticERC20Approve(
            'ERC20',
            initialHolder,
            recipient,
            initialSupply,
            updatedPrice,
            function (owner, spender, amount) {
                return this.token.approveInternal(owner, spender, amount);
            }
        );

        describe('when the owner is the zero address', function () {
            it('reverts', async function () {
                await expectRevert(
                    this.token.approveInternal(ZERO_ADDRESS, recipient, initialSupply),
                    'ERC20: approve from the zero address'
                );
            });
        });
    });
});