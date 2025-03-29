"use client";
import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { toast, Toaster } from "react-hot-toast";

const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const contractABI = [
    // GPU Management
    "function listGPU(string name, uint256 pricePerHour, uint256 listingDuration)",
    "function rentGPU(uint256 gpuId, uint256 rentalDuration) payable",
    "function submitProof(uint256 rentalId)",
    "function disputeRental(uint256 rentalId)",
    "function autoCompleteRental(uint256 rentalId)",
    "function reclaimGPU(uint256 gpuId)",
    
    // View Functions
    "function gpuCount() view returns (uint256)",
    "function rentalCount() view returns (uint256)",
    "function gpus(uint256) view returns (address owner, string name, uint256 pricePerHour, bool isAvailable, uint256 listingDuration)",
    "function rentals(uint256) view returns (address renter, uint256 gpuId, uint256 rentalDuration, uint256 totalCost, bool isCompleted, bool isDisputed)",
    "function getRentalDetails(uint256) view returns (uint256 endTime, uint256 gracePeriod)",
    
    // Events
    "event GPUListed(uint256 indexed gpuId, address indexed owner, string name, uint256 pricePerHour, uint256 listingDuration)",
    "event GPURented(uint256 indexed rentalId, address indexed renter, uint256 gpuId, uint256 rentalDuration, uint256 totalCost)",
    "event ProofSubmitted(uint256 indexed rentalId, address indexed renter)",
    "event RentalDisputed(uint256 indexed rentalId, address indexed renter)",
    "event RentalAutoCompleted(uint256 indexed rentalId, address indexed renter)",
    "event GPUReclaimed(uint256 indexed gpuId, address indexed owner)"
];

export default function Home() {
  const [address, setAddress] = useState("");
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(false);
  const [gpus, setGpus] = useState([]);
  const [activeRentals, setActiveRentals] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedGPU, setSelectedGPU] = useState(null);
  const [rentalDuration, setRentalDuration] = useState("");
  const [gpuLenders, setGpuLenders] = useState([]);
  const [price, setPrice] = useState("");
  const [gpuModel, setGpuModel] = useState("");
  const [listingDuration, setListingDuration] = useState("");
  const [rentalError, setRentalError] = useState("");

  const connectWallet = async () => {
    try {
      setLoading(true);
      if (!window.ethereum) {
        toast.error("Please install MetaMask!");
        return;
      }

      // Request account access
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      setAddress(accounts[0]);

      // Create contract instance
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contractInstance = new ethers.Contract(
        contractAddress,
        contractABI,
        signer
      );
      setContract(contractInstance);

      // Listen for account changes
      window.ethereum.on("accountsChanged", (accounts) => {
        setAddress(accounts[0]);
      });

      // Listen for network changes
      window.ethereum.on("chainChanged", () => {
        window.location.reload();
      });

      // Initial fetch of GPUs and rentals
      await fetchGPUs();
      await fetchActiveRentals();

      toast.success("Wallet connected successfully!");
    } catch (error) {
      console.error("Error connecting wallet:", error);
      toast.error("Failed to connect wallet");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      if (typeof window.ethereum !== "undefined") {
        try {
          // Request account access
          const accounts = await window.ethereum.request({
            method: "eth_requestAccounts",
          });
          setAddress(accounts[0]);

          // Create contract instance
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          const signer = provider.getSigner();
          const contractInstance = new ethers.Contract(
            contractAddress,
            contractABI,
            signer
          );
          setContract(contractInstance);

          // Listen for account changes
          window.ethereum.on("accountsChanged", (accounts) => {
            setAddress(accounts[0]);
          });

          // Listen for network changes
          window.ethereum.on("chainChanged", () => {
            window.location.reload();
          });

          // Initial fetch of GPUs and rentals
          await fetchGPUs();
          await fetchActiveRentals();
        } catch (error) {
          console.error("Error initializing:", error);
          toast.error("Failed to connect to wallet");
        }
      } else {
        toast.error("Please install MetaMask!");
      }
    };

    init();

    return () => {
      // Cleanup listeners
      if (window.ethereum) {
        window.ethereum.removeListener("accountsChanged", (accounts) => {
          setAddress(accounts[0]);
        });
        window.ethereum.removeListener("chainChanged", () => {
          window.location.reload();
        });
      }
    };
  }, []);

  async function fetchGPUs() {
    try {
        setLoading(true);
        const totalGPUs = await contract.gpuCount();
        console.log("Total GPUs:", totalGPUs.toString());

        let gpus = [];
        for (let i = 0; i < totalGPUs.toNumber(); i++) {
            try {
                const gpu = await contract.gpus(i);
                console.log(`GPU ${i}:`, {
                    name: gpu.name,
                    pricePerHour: gpu.pricePerHour.toString(),
                    isAvailable: gpu.isAvailable,
                    listingDuration: gpu.listingDuration.toString()
                });
                
                gpus.push({ 
                    id: i, 
                    name: gpu.name,
                    price: ethers.utils.formatEther(gpu.pricePerHour), 
                    available: gpu.isAvailable,
                    listingDuration: gpu.listingDuration.toString()
                });
            } catch (error) {
                console.error(`Error fetching GPU ${i}:`, error);
                continue;
            }
        }
        setGpuLenders(gpus);
    } catch (error) {
        console.error("Error fetching GPUs:", error);
        toast.error("Failed to fetch GPUs");
    } finally {
        setLoading(false);
    }
  }

  const fetchActiveRentals = async () => {
    if (!contract || !address) return;
    
    try {
        // First check if there are any rentals
        const rentalCount = await contract.rentalCount();
        if (rentalCount.toNumber() === 0) {
            setActiveRentals([]);
            return;
        }

        const rentals = [];
        // Use a try-catch for each rental to handle potential errors
        for (let i = 0; i < rentalCount.toNumber(); i++) {
            try {
                const rental = await contract.rentals(i);
                if (rental.renter.toLowerCase() === address.toLowerCase() && !rental.isCompleted) {
                    const gpu = await contract.gpus(rental.gpuId);
                    const rentalDetails = await contract.getRentalDetails(i);
                    rentals.push({
                        id: i,
                        gpuName: gpu.name,
                        rentalDuration: rental.rentalDuration.toString(),
                        totalCost: ethers.utils.formatEther(rental.totalCost),
                        endTime: new Date(Number(rentalDetails.endTime) * 1000),
                        gracePeriod: new Date(Number(rentalDetails.gracePeriod) * 1000),
                        isDisputed: rental.isDisputed
                    });
                }
            } catch (error) {
                console.error(`Error fetching rental ${i}:`, error);
                continue; // Skip this rental and continue with the next one
            }
        }
        
        setActiveRentals(rentals);
    } catch (error) {
        console.error("Error fetching active rentals:", error);
        setActiveRentals([]); // Set empty array on error
    }
};

  async function listGPU() {
    if (!address) return toast.error("Connect your wallet first!");
    if (!gpuModel || !price || !listingDuration) return toast.error("Enter GPU Model, Price and Duration");
    
    try {
      setLoading(true);
      console.log("Listing GPU with params:", {
        name: gpuModel,
        pricePerHour: ethers.utils.parseEther(price).toString(),
        listingDuration: parseInt(listingDuration)
      });

      // First estimate gas
      const gasEstimate = await contract.estimateGas.listGPU(
        gpuModel,
        ethers.utils.parseEther(price),
        parseInt(listingDuration)
      );

      console.log("Estimated gas:", gasEstimate.toString());

      // Add 20% buffer to gas estimate
      const gasLimit = gasEstimate.mul(120).div(100);

      const tx = await contract.listGPU(
        gpuModel, 
        ethers.utils.parseEther(price),
        parseInt(listingDuration),
        { 
          gasLimit: gasLimit,
          from: address
        }
      );
      
      console.log("Transaction sent:", tx.hash);
      await tx.wait();
      console.log("Transaction confirmed");
      
      toast.success("GPU listed successfully!");
      await fetchGPUs();
      setGpuModel("");
      setPrice("");
      setListingDuration("");
    } catch (error) {
      console.error("Error listing GPU:", error);
      if (error.message.includes("user rejected")) {
        toast.error("Transaction was rejected");
      } else if (error.message.includes("insufficient funds")) {
        toast.error("Insufficient funds for gas");
      } else if (error.message.includes("nonce too low")) {
        toast.error("Please refresh the page and try again");
      } else {
        toast.error(error.message || "Failed to list GPU");
      }
    } finally {
      setLoading(false);
    }
  }

  const handleRentGPU = async (gpuId, duration) => {
    if (!contract || !address) return;
    
    try {
        // First check if the GPU exists and is available
        const gpu = await contract.gpus(gpuId);
        if (!gpu.isAvailable) {
            toast.error("This GPU is not available for rent");
            return;
        }

        // Calculate total cost
        const totalCost = gpu.pricePerHour.mul(duration);
        
        // Log the values for debugging
        console.log("Renting GPU:", {
            gpuId,
            duration,
            pricePerHour: gpu.pricePerHour.toString(),
            totalCost: totalCost.toString(),
            isAvailable: gpu.isAvailable
        });

        const tx = await contract.rentGPU(gpuId, duration, { value: totalCost });
        await tx.wait();
        
        // Refresh active rentals after successful rental
        await fetchActiveRentals();
        await fetchGPUs(); // Also refresh the GPU list
        
        toast.success("GPU rented successfully!");
    } catch (error) {
        console.error("Error renting GPU:", error);
        if (error.message.includes("GPU not available")) {
            toast.error("This GPU is not available for rent");
        } else if (error.message.includes("Insufficient payment")) {
            toast.error("Insufficient payment for the rental");
        } else {
            toast.error(error.message || "Failed to rent GPU");
        }
    }
  };

  function openRentModal(gpu) {
    setSelectedGPU(gpu);
    setRentalDuration("1");
    setRentalError("");
    setShowModal(true);
  }

  async function confirmRent() {
    if (!selectedGPU) return;
    
    const duration = parseInt(rentalDuration);
    if (!duration || duration <= 0) {
        setRentalError("Please enter a valid duration");
        return;
    }

    const availableHours = parseInt(selectedGPU.listingDuration);
    if (duration > availableHours) {
        setRentalError(`Cannot rent for more than ${availableHours} hours`);
        return;
    }
    
    await handleRentGPU(selectedGPU.id, duration);
    setShowModal(false);
  }

  const handleSubmitProof = async (rentalId) => {
    if (!contract || !address) return;
    
    try {
        const tx = await contract.submitProof(rentalId);
        await tx.wait();
        
        // Refresh active rentals after successful proof submission
        await fetchActiveRentals();
        
        toast.success("Proof submitted successfully!");
    } catch (error) {
        console.error("Error submitting proof:", error);
        toast.error(error.message || "Failed to submit proof");
    }
  };

  const handleDisputeRental = async (rentalId) => {
    if (!contract || !address) return;
    
    try {
        const tx = await contract.disputeRental(rentalId);
        await tx.wait();
        
        // Refresh active rentals after successful dispute
        await fetchActiveRentals();
        
        toast.success("Dispute filed successfully!");
    } catch (error) {
        console.error("Error filing dispute:", error);
        toast.error(error.message || "Failed to file dispute");
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Toaster position="top-right" />
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 text-blue-400">
            GPU Rental Marketplace
          </h1>
          <p className="text-gray-400 text-lg">Rent or List High-Performance GPUs for AI Computing</p>
        </div>

        {/* Wallet Connection */}
        <div className="flex justify-center mb-8">
          {!address ? (
            <button 
              className="bg-blue-600 px-8 py-3 rounded-lg text-lg"
              onClick={connectWallet}
              disabled={loading}
            >
              {loading ? "Connecting..." : "Connect Wallet"}
            </button>
          ) : (
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-400">
                Connected: {address.slice(0, 6)}...{address.slice(-4)}
              </span>
              <button 
                className="bg-red-600 px-6 py-2 rounded-lg"
                onClick={() => setAddress("")}
              >
                Disconnect
              </button>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* List GPU Section */}
          <div className="bg-gray-800 p-6 rounded-xl h-fit">
            <h2 className="text-2xl font-semibold mb-6 text-center">List Your GPU</h2>
            <input 
              className="w-full mb-4 px-4 py-3 bg-gray-700 rounded-lg"
              placeholder="GPU Model (e.g., NVIDIA RTX 4090)"
              value={gpuModel}
              onChange={(e) => setGpuModel(e.target.value)}
            />
            <input 
              className="w-full mb-4 px-4 py-3 bg-gray-700 rounded-lg"
              placeholder="Price per hour (ETH)"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            <div className="flex items-center space-x-2 mb-4">
              <input 
                className="w-full px-4 py-3 bg-gray-700 rounded-lg"
                placeholder="Listing Duration (hours)"
                value={listingDuration}
                onChange={(e) => {
                  const value = e.target.value;
                  const numValue = value.replace(/[^0-9]/g, '');
                  setListingDuration(value === '' ? '' : numValue);
                }}
              />
            </div>
            <button
              className="w-full bg-green-500 px-6 py-3 rounded-lg"
              onClick={listGPU}
            >
              {loading ? "Processing..." : "List GPU"}
            </button>
          </div>

          {/* Available GPUs Section */}
          <div className="bg-gray-800 p-6 rounded-xl min-h-[400px]">
            <h2 className="text-2xl font-semibold mb-6 text-center">Available GPUs</h2>
            {gpuLenders.length === 0 ? (
              <p className="text-center text-gray-400">No GPUs available</p>
            ) : (
              <div className="space-y-4">
                {gpuLenders.map((gpu) => (
                  <div key={gpu.id} className="bg-gray-700 p-4 rounded-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-medium text-lg">{gpu.name}</h3>
                        <p className="text-gray-400">{gpu.price} ETH/hour</p>
                      </div>
                      <button
                        className={`px-6 py-2 rounded-lg ${
                          gpu.available 
                            ? "bg-blue-500 hover:bg-blue-600" 
                            : "bg-gray-500 cursor-not-allowed"
                        }`}
                        onClick={() => openRentModal(gpu)}
                        disabled={!gpu.available}
                      >
                        {gpu.available ? "Rent Now" : "Rented"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Active Rentals Section */}
        {address && activeRentals.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-semibold mb-6 text-center">Your Active Rentals</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeRentals.map((rental) => (
                <div key={rental.id} className="bg-gray-800 p-6 rounded-xl">
                  <h3 className="text-xl font-medium mb-2">{rental.gpuName}</h3>
                  <div className="space-y-2 text-gray-400">
                    <p>Rental Duration: {rental.rentalDuration} hours</p>
                    <p>Total Cost: {rental.totalCost} ETH</p>
                    <p>Ends: {rental.endTime.toLocaleString()}</p>
                    <p>Grace Period Until: {rental.gracePeriod.toLocaleString()}</p>
                  </div>
                  
                  <div className="mt-4 space-y-2">
                    {new Date() >= rental.endTime && !rental.isDisputed && (
                      <>
                        <button
                          onClick={() => handleSubmitProof(rental.id)}
                          className="w-full bg-green-500 px-4 py-2 rounded-lg hover:bg-green-600"
                          disabled={loading}
                        >
                          {loading ? "Processing..." : "Submit Proof"}
                        </button>
                        <button
                          onClick={() => handleDisputeRental(rental.id)}
                          className="w-full bg-red-500 px-4 py-2 rounded-lg hover:bg-red-600"
                          disabled={loading}
                        >
                          {loading ? "Processing..." : "File Dispute"}
                        </button>
                      </>
                    )}
                    {rental.isDisputed && (
                      <p className="text-yellow-500 text-center">Rental Disputed</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Rental Modal */}
      {showModal && selectedGPU && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full">
            <h2 className="text-2xl font-semibold mb-4 text-center">Confirm GPU Rental</h2>
            
            <div className="mb-6">
              <h3 className="text-xl font-medium mb-2">{selectedGPU.name}</h3>
              <p className="text-gray-400 mb-4">Price: {selectedGPU.price} ETH/hour</p>
              <p className="text-gray-400 mb-4">Available for: {selectedGPU.listingDuration} hours</p>
              
              <div className="flex items-center space-x-2 mb-4">
                <input
                  type="text"
                  min="1"
                  value={rentalDuration}
                  onChange={(e) => {
                    const value = e.target.value;
                    const numValue = value.replace(/[^0-9]/g, '');
                    setRentalDuration(value === '' ? '' : numValue);
                    
                    // Validate rental duration
                    if (numValue && parseInt(numValue) > parseInt(selectedGPU.listingDuration)) {
                      setRentalError(`Cannot rent for more than ${selectedGPU.listingDuration} hours`);
                    } else {
                      setRentalError("");
                    }
                  }}
                  className="w-20 px-3 py-2 bg-gray-700 rounded-lg text-center text-white"
                />
                <span className="text-gray-400">hours</span>
              </div>

              {rentalError && (
                <p className="text-red-500 text-sm mb-4">{rentalError}</p>
              )}

              <div className="bg-gray-700 p-3 rounded-lg mb-4">
                <p className="text-gray-400">Estimated Time:</p>
                <p className="text-lg font-medium">
                  {rentalDuration ? `${rentalDuration} hour${parseInt(rentalDuration) > 1 ? 's' : ''}` : '0 hours'}
                </p>
                <p className="text-sm text-gray-400">
                {rentalDuration ? `(Until ${new Date(Date.now() + parseInt(rentalDuration) * 60 * 60 * 1000).toLocaleDateString('en-GB')} ${new Date(Date.now() + parseInt(rentalDuration) * 60 * 60 * 1000).toLocaleTimeString()})` : ''}
                </p>
              </div>

              <div className="bg-gray-700 p-3 rounded-lg mb-4">
                <p className="text-gray-300">
                  Total Cost: {rentalDuration ? (parseFloat(selectedGPU.price) * parseInt(rentalDuration)).toFixed(6) : '0'} ETH
                </p>
              </div>
            </div>

            <div className="flex space-x-4">
              <button
                className="flex-1 bg-gray-600 hover:bg-gray-700 px-6 py-3 rounded-lg"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button
                className="flex-1 bg-blue-500 hover:bg-blue-600 px-6 py-3 rounded-lg"
                onClick={confirmRent}
                disabled={loading || !rentalDuration || rentalError}
              >
                {loading ? "Processing..." : "Confirm Rental"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
