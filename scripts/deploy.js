const hre = require("hardhat");

async function main() {
    console.log("Deploying GpuRental Contract...");
    
    const GpuRental = await hre.ethers.getContractFactory("GpuRental");
    const gpuRental = await GpuRental.deploy();
    
    await gpuRental.deployed();
    
    console.log("GpuRental Contract deployed to:", gpuRental.address);
    console.log("Waiting for block confirmations...");
    
    // Wait for 5 block confirmations
    await gpuRental.deployTransaction.wait(5);
    
    console.log("Confirmed! Contract deployed successfully.");
    console.log("Contract address:", gpuRental.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
