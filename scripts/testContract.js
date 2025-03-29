const hre = require("hardhat");

async function main() {
  console.log("Starting contract test...");

  // Get the ContractFactory and Signers
  const GpuRental = await hre.ethers.getContractFactory("GpuRental");
  const [owner, renter, addr1] = await ethers.getSigners();

  // Deploy contract
  console.log("\nDeploying contract...");
  const gpuRental = await GpuRental.deploy();
  await gpuRental.waitForDeployment();
  console.log("Contract deployed to:", await gpuRental.getAddress());

  // Test owner
  console.log("\nTesting owner...");
  const contractOwner = await gpuRental.owner();
  console.log("Contract owner:", contractOwner);
  console.log("Expected owner:", owner.address);
  console.log("Owner test:", contractOwner === owner.address ? "PASSED" : "FAILED");

  // Test listing GPU
  console.log("\nTesting GPU listing...");
  const listingTx = await gpuRental.listGPU("RTX 4090", ethers.parseEther("0.1"), 24);
  await listingTx.wait();
  console.log("GPU listed successfully");

  // Check GPU details
  const gpu = await gpuRental.gpus(0);
  console.log("\nGPU Details:");
  console.log("Name:", gpu.name);
  console.log("Price per hour:", ethers.formatEther(gpu.pricePerHour), "ETH");
  console.log("Available:", gpu.isAvailable);
  console.log("Listing duration:", gpu.listingDuration.toString(), "hours");

  // Test renting GPU
  console.log("\nTesting GPU rental...");
  const rentalDuration = 5;
  const totalCost = ethers.parseEther("0.5"); // 0.1 ETH/hour * 5 hours
  const rentalTx = await gpuRental.connect(renter).rentGPU(0, rentalDuration, { value: totalCost });
  await rentalTx.wait();
  console.log("GPU rented successfully");

  // Check rental details
  const rental = await gpuRental.rentals(0);
  console.log("\nRental Details:");
  console.log("Renter:", rental.renter);
  console.log("GPU ID:", rental.gpuId.toString());
  console.log("Duration:", rental.rentalDuration.toString(), "hours");
  console.log("Total Cost:", ethers.formatEther(rental.totalCost), "ETH");
  console.log("End Time:", new Date(Number(rental.rentalEndTime) * 1000).toLocaleString());
  console.log("Completed:", rental.isCompleted);
  console.log("Disputed:", rental.isDisputed);

  // Test submitting proof
  console.log("\nTesting proof submission...");
  // Increase time to after rental period
  await network.provider.send("evm_increaseTime", [6 * 60 * 60]); // 6 hours
  await network.provider.send("evm_mine");

  const proofTx = await gpuRental.connect(renter).submitProof(0);
  await proofTx.wait();
  console.log("Proof submitted successfully");

  // Check final GPU status
  const finalGpu = await gpuRental.gpus(0);
  console.log("\nFinal GPU Status:");
  console.log("Available:", finalGpu.isAvailable);

  // Test dispute functionality
  console.log("\nTesting dispute functionality...");
  // List and rent another GPU
  await gpuRental.listGPU("RTX 3080", ethers.parseEther("0.2"), 48);
  await gpuRental.connect(addr1).rentGPU(1, 10, { value: ethers.parseEther("2") });
  
  // Increase time to after rental period
  await network.provider.send("evm_increaseTime", [11 * 60 * 60]); // 11 hours
  await network.provider.send("evm_mine");

  const disputeTx = await gpuRental.connect(addr1).disputeRental(1);
  await disputeTx.wait();
  console.log("Dispute filed successfully");

  // Check final rental status
  const finalRental = await gpuRental.rentals(1);
  console.log("\nFinal Rental Status:");
  console.log("Disputed:", finalRental.isDisputed);

  console.log("\nAll tests completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 