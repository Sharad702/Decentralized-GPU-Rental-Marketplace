const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = ethers;

describe("GpuRental", function () {
  let GpuRental;
  let gpuRental;
  let owner;
  let renter;
  let addr1;
  let addr2;

  beforeEach(async function () {
    // Get the ContractFactory and Signers here.
    GpuRental = await ethers.getContractFactory("GpuRental");
    [owner, renter, addr1, addr2] = await ethers.getSigners();

    // Deploy a new GpuRental contract before each test
    gpuRental = await GpuRental.deploy();
    await gpuRental.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await gpuRental.owner()).to.equal(owner.address);
    });

    it("Should initialize with zero GPUs and rentals", async function () {
      expect(await gpuRental.gpuCount()).to.equal(0);
      expect(await gpuRental.rentalCount()).to.equal(0);
    });
  });

  describe("GPU Listing", function () {
    it("Should list a new GPU", async function () {
      await gpuRental.listGPU("RTX 4090", ethers.parseEther("0.1"), 24);
      const gpu = await gpuRental.gpus(0);
      expect(gpu.name).to.equal("RTX 4090");
      expect(gpu.pricePerHour).to.equal(ethers.parseEther("0.1"));
      expect(gpu.isAvailable).to.equal(true);
      expect(gpu.listingDuration).to.equal(24);
    });

    it("Should emit GPUListed event", async function () {
      await expect(gpuRental.listGPU("RTX 4090", ethers.parseEther("0.1"), 24))
        .to.emit(gpuRental, "GPUListed")
        .withArgs(0, owner.address, "RTX 4090", ethers.parseEther("0.1"), 24);
    });

    it("Should fail if listing duration is zero", async function () {
      await expect(
        gpuRental.listGPU("RTX 4090", ethers.parseEther("0.1"), 0)
      ).to.be.revertedWith("Listing duration must be between 1 and 168 hours");
    });

    it("Should fail if price is zero", async function () {
      await expect(
        gpuRental.listGPU("RTX 4090", 0, 24)
      ).to.be.revertedWith("Price must be greater than 0");
    });
  });

  describe("GPU Rental", function () {
    beforeEach(async function () {
      // List a GPU before each rental test
      await gpuRental.listGPU("RTX 4090", ethers.parseEther("0.1"), 24);
    });

    it("Should rent a GPU", async function () {
      const rentalDuration = 5;
      const totalCost = ethers.parseEther("0.5"); // 0.1 ETH/hour * 5 hours

      await expect(
        gpuRental.connect(renter).rentGPU(0, rentalDuration, { value: totalCost })
      )
        .to.emit(gpuRental, "GPURented")
        .withArgs(0, renter.address, 0, rentalDuration, totalCost);

      const gpu = await gpuRental.gpus(0);
      expect(gpu.isAvailable).to.equal(false);
    });

    it("Should fail if GPU is not available", async function () {
      await gpuRental.connect(renter).rentGPU(0, 5, { value: ethers.parseEther("0.5") });
      await expect(
        gpuRental.connect(addr1).rentGPU(0, 5, { value: ethers.parseEther("0.5") })
      ).to.be.revertedWith("GPU is not available");
    });

    it("Should fail if rental duration exceeds listing duration", async function () {
      await expect(
        gpuRental.connect(renter).rentGPU(0, 25, { value: ethers.parseEther("2.5") })
      ).to.be.revertedWith("Invalid rental duration");
    });

    it("Should fail if payment is insufficient", async function () {
      await expect(
        gpuRental.connect(renter).rentGPU(0, 5, { value: ethers.parseEther("0.4") })
      ).to.be.revertedWith("Insufficient payment");
    });
  });

  describe("Rental Management", function () {
    beforeEach(async function () {
      // List and rent a GPU before each test
      await gpuRental.listGPU("RTX 4090", ethers.parseEther("0.1"), 24);
      await gpuRental.connect(renter).rentGPU(0, 5, {
        value: ethers.parseEther("0.5"),
      });
    });

    it("Should submit proof and complete rental", async function () {
      // Increase time to after rental period
      await network.provider.send("evm_increaseTime", [6 * 60 * 60]); // 6 hours
      await network.provider.send("evm_mine");

      await expect(gpuRental.connect(renter).submitProof(0))
        .to.emit(gpuRental, "ProofSubmitted")
        .withArgs(0, renter.address);

      const rental = await gpuRental.rentals(0);
      expect(rental.isCompleted).to.equal(true);

      const gpu = await gpuRental.gpus(0);
      expect(gpu.isAvailable).to.equal(true);
    });

    it("Should fail to submit proof before rental ends", async function () {
      await expect(
        gpuRental.connect(renter).submitProof(0)
      ).to.be.revertedWith("Rental period not ended");
    });

    it("Should dispute rental", async function () {
      // Increase time to after rental period
      await network.provider.send("evm_increaseTime", [6 * 60 * 60]); // 6 hours
      await network.provider.send("evm_mine");

      await expect(gpuRental.connect(renter).disputeRental(0))
        .to.emit(gpuRental, "RentalDisputed")
        .withArgs(0, renter.address);

      const rental = await gpuRental.rentals(0);
      expect(rental.isDisputed).to.equal(true);
    });

    it("Should fail to dispute before rental ends", async function () {
      await expect(
        gpuRental.connect(renter).disputeRental(0)
      ).to.be.revertedWith("Rental period not ended");
    });
  });
}); 