async function main() {
    console.log('Start deploy');
    const zunamiAddress = "0x9dE83985047ab3582668320A784F6b9736c6EEa7";
    const ZunamiRedistributor = await ethers.getContractFactory("ZunamiRedistributorNative");
    const redistributor = await ZunamiRedistributor.deploy(zunamiAddress);

    await redistributor.deployed();
    console.log(`ZunamiRedistributor deployed to:`, redistributor.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
