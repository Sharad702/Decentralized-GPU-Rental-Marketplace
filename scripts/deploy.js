const hre = require("hardhat");

async function main() {
    console.log("Deploying GpuRental Contract...");
    
    const GpuRental = await hre.ethers.getContractFactory("GpuRental");
    const gpuRental = await GpuRental.deploy();
    await gpuRental.waitForDeployment();
    
    console.log("GpuRental deployed to:", await gpuRental.getAddress());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
