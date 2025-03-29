// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract GpuRental {
    struct GPU {
        address owner;
        string name;
        uint256 pricePerHour;
        bool isAvailable;
        uint256 listingDuration;
        uint256 listingEndTime;
    }

    struct Rental {
        address renter;
        uint256 gpuId;
        uint256 rentalDuration;
        uint256 totalCost;
        uint256 rentalEndTime;
        bool isCompleted;
        bool isDisputed;
    }

    address public owner;
    uint256 public gpuCount;
    uint256 public rentalCount;
    uint256 public constant GRACE_PERIOD = 1 hours;

    mapping(uint256 => GPU) public gpus;
    mapping(uint256 => Rental) public rentals;

    event GPUListed(uint256 indexed gpuId, address indexed owner, string name, uint256 pricePerHour, uint256 listingDuration);
    event GPURented(uint256 indexed rentalId, address indexed renter, uint256 gpuId, uint256 rentalDuration, uint256 totalCost);
    event ProofSubmitted(uint256 indexed rentalId, address indexed renter);
    event RentalDisputed(uint256 indexed rentalId, address indexed renter);
    event RentalAutoCompleted(uint256 indexed rentalId, address indexed renter);
    event GPUReclaimed(uint256 indexed gpuId, address indexed owner);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    function listGPU(string memory _name, uint256 _pricePerHour, uint256 _listingDuration) public {
        require(_pricePerHour > 0, "Price must be greater than 0");
        require(_listingDuration > 0 && _listingDuration <= 168, "Listing duration must be between 1 and 168 hours");

        uint256 gpuId = gpuCount++;
        gpus[gpuId] = GPU({
            owner: msg.sender,
            name: _name,
            pricePerHour: _pricePerHour,
            isAvailable: true,
            listingDuration: _listingDuration,
            listingEndTime: block.timestamp + (_listingDuration * 1 hours)
        });

        emit GPUListed(gpuId, msg.sender, _name, _pricePerHour, _listingDuration);
    }

    function rentGPU(uint256 _gpuId, uint256 _rentalDuration) public payable {
        require(_gpuId < gpuCount, "GPU does not exist");
        require(gpus[_gpuId].isAvailable, "GPU is not available");
        require(_rentalDuration > 0 && _rentalDuration <= gpus[_gpuId].listingDuration, "Invalid rental duration");
        require(block.timestamp <= gpus[_gpuId].listingEndTime, "Listing has expired");

        uint256 totalCost = gpus[_gpuId].pricePerHour * _rentalDuration;
        require(msg.value >= totalCost, "Insufficient payment");

        uint256 rentalId = rentalCount++;
        rentals[rentalId] = Rental({
            renter: msg.sender,
            gpuId: _gpuId,
            rentalDuration: _rentalDuration,
            totalCost: totalCost,
            rentalEndTime: block.timestamp + (_rentalDuration * 1 hours),
            isCompleted: false,
            isDisputed: false
        });

        gpus[_gpuId].isAvailable = false;
        payable(gpus[_gpuId].owner).transfer(totalCost);

        emit GPURented(rentalId, msg.sender, _gpuId, _rentalDuration, totalCost);
    }

    function submitProof(uint256 _rentalId) public {
        require(_rentalId < rentalCount, "Rental does not exist");
        require(rentals[_rentalId].renter == msg.sender, "Only renter can submit proof");
        require(!rentals[_rentalId].isCompleted, "Rental is already completed");
        require(!rentals[_rentalId].isDisputed, "Rental is disputed");
        require(block.timestamp >= rentals[_rentalId].rentalEndTime, "Rental period not ended");

        rentals[_rentalId].isCompleted = true;
        gpus[rentals[_rentalId].gpuId].isAvailable = true;

        emit ProofSubmitted(_rentalId, msg.sender);
    }

    function disputeRental(uint256 _rentalId) public {
        require(_rentalId < rentalCount, "Rental does not exist");
        require(rentals[_rentalId].renter == msg.sender, "Only renter can dispute");
        require(!rentals[_rentalId].isCompleted, "Rental is already completed");
        require(!rentals[_rentalId].isDisputed, "Rental is already disputed");
        require(block.timestamp >= rentals[_rentalId].rentalEndTime, "Rental period not ended");

        rentals[_rentalId].isDisputed = true;
        emit RentalDisputed(_rentalId, msg.sender);
    }

    function autoCompleteRental(uint256 _rentalId) public {
        require(_rentalId < rentalCount, "Rental does not exist");
        require(!rentals[_rentalId].isCompleted, "Rental is already completed");
        require(!rentals[_rentalId].isDisputed, "Rental is disputed");
        require(block.timestamp >= rentals[_rentalId].rentalEndTime + GRACE_PERIOD, "Grace period not ended");

        rentals[_rentalId].isCompleted = true;
        gpus[rentals[_rentalId].gpuId].isAvailable = true;

        emit RentalAutoCompleted(_rentalId, rentals[_rentalId].renter);
    }

    function reclaimGPU(uint256 _gpuId) public {
        require(_gpuId < gpuCount, "GPU does not exist");
        require(gpus[_gpuId].owner == msg.sender, "Only owner can reclaim");
        require(!gpus[_gpuId].isAvailable, "GPU is already available");
        require(block.timestamp > gpus[_gpuId].listingEndTime, "Listing period not ended");

        gpus[_gpuId].isAvailable = true;
        emit GPUReclaimed(_gpuId, msg.sender);
    }

    function getRentalDetails(uint256 _rentalId) public view returns (uint256 endTime, uint256 gracePeriod) {
        require(_rentalId < rentalCount, "Rental does not exist");
        return (rentals[_rentalId].rentalEndTime, rentals[_rentalId].rentalEndTime + GRACE_PERIOD);
    }
}
