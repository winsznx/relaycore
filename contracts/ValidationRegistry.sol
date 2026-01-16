// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IdentityRegistry.sol";

/**
 * @title ValidationRegistry
 * @dev ERC-8004 Validation Registry - Independent verification of agent work
 * 
 * Based on: https://eips.ethereum.org/EIPS/eip-8004
 */
contract ValidationRegistry {
    IdentityRegistry public immutable identityRegistry;
    
    struct ValidationStatus {
        address validatorAddress;
        uint256 agentId;
        uint8 response;      // 0-100 (0=failed, 100=passed)
        string tag;
        string responseURI;
        bytes32 responseHash;
        uint256 lastUpdate;
        bool completed;
    }
    
    mapping(bytes32 => ValidationStatus) public validations;
    mapping(uint256 => bytes32[]) public agentValidations;
    mapping(address => bytes32[]) public validatorRequests;
    
    // Validator reputation tracking
    mapping(address => uint256) public validatorCompletedCount;
    mapping(address => uint256) public validatorTotalScore;
    
    event ValidationRequest(
        address indexed validatorAddress,
        uint256 indexed agentId,
        string requestURI,
        bytes32 indexed requestHash
    );
    
    event ValidationResponse(
        address indexed validatorAddress,
        uint256 indexed agentId,
        bytes32 indexed requestHash,
        uint8 response,
        string responseURI,
        bytes32 responseHash,
        string tag
    );
    
    constructor(address _identityRegistry) {
        identityRegistry = IdentityRegistry(_identityRegistry);
    }
    
    /**
     * @notice Request validation for agent work
     */
    function validationRequest(
        address validatorAddress,
        uint256 agentId,
        string calldata requestURI,
        bytes32 requestHash
    ) external {
        require(
            identityRegistry.ownerOf(agentId) == msg.sender ||
            identityRegistry.getApproved(agentId) == msg.sender,
            "Not agent owner or operator"
        );
        require(validatorAddress != address(0), "Invalid validator");
        require(validations[requestHash].lastUpdate == 0, "Request already exists");
        
        validations[requestHash] = ValidationStatus({
            validatorAddress: validatorAddress,
            agentId: agentId,
            response: 0,
            tag: "",
            responseURI: "",
            responseHash: bytes32(0),
            lastUpdate: block.timestamp,
            completed: false
        });
        
        agentValidations[agentId].push(requestHash);
        validatorRequests[validatorAddress].push(requestHash);
        
        emit ValidationRequest(validatorAddress, agentId, requestURI, requestHash);
    }
    
    /**
     * @notice Respond to validation request
     */
    function validationResponse(
        bytes32 requestHash,
        uint8 response,
        string calldata responseURI,
        bytes32 responseHash,
        string calldata tag
    ) external {
        ValidationStatus storage vs = validations[requestHash];
        require(vs.validatorAddress == msg.sender, "Not the validator");
        require(!vs.completed, "Already completed");
        require(response <= 100, "Response must be 0-100");
        
        vs.response = response;
        vs.tag = tag;
        vs.responseURI = responseURI;
        vs.responseHash = responseHash;
        vs.lastUpdate = block.timestamp;
        vs.completed = true;
        
        // Update validator stats
        validatorCompletedCount[msg.sender] += 1;
        validatorTotalScore[msg.sender] += response;
        
        emit ValidationResponse(
            msg.sender,
            vs.agentId,
            requestHash,
            response,
            responseURI,
            responseHash,
            tag
        );
    }
    
    /**
     * @notice Get validation status
     */
    function getValidation(bytes32 requestHash) external view returns (
        address validatorAddress,
        uint256 agentId,
        uint8 response,
        string memory tag,
        string memory responseURI,
        bytes32 responseHash,
        uint256 lastUpdate,
        bool completed
    ) {
        ValidationStatus memory vs = validations[requestHash];
        return (
            vs.validatorAddress,
            vs.agentId,
            vs.response,
            vs.tag,
            vs.responseURI,
            vs.responseHash,
            vs.lastUpdate,
            vs.completed
        );
    }
    
    /**
     * @notice Get all validation requests for an agent
     */
    function getAgentValidations(uint256 agentId) external view returns (bytes32[] memory) {
        return agentValidations[agentId];
    }
    
    /**
     * @notice Get all validation requests for a validator
     */
    function getValidatorRequests(address validator) external view returns (bytes32[] memory) {
        return validatorRequests[validator];
    }
    
    /**
     * @notice Get validator average score
     */
    function getValidatorAverageScore(address validator) external view returns (uint8) {
        if (validatorCompletedCount[validator] == 0) return 0;
        return uint8(validatorTotalScore[validator] / validatorCompletedCount[validator]);
    }
    
    /**
     * @notice Get validator completion count
     */
    function getValidatorCompletedCount(address validator) external view returns (uint256) {
        return validatorCompletedCount[validator];
    }
}
