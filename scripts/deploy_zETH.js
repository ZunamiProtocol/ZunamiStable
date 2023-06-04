async function main() {
    console.log('Start deploy');
    const name = 'zETH';
    const Token = await ethers.getContractFactory(name);
    const token = await Token.deploy();

    await token.deployed();
    console.log(`Token ${name} deployed to:`, token.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
