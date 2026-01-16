// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IdentityRegistry.sol";

/**
 * @title ReputationRegistry
 * @dev ERC-8004 Reputation Registry - On-chain feedback for agents
 * 
 * Based on: https://eips.ethereum.org/EIPS/eip-8004
 */
contract ReputationRegistry {
    IdentityRegistry public immutable identityRegistry;
    
    struct Feedback {
        uint8 score;        // 0-100
        string tag1;        // e.g., "trade"
        string tag2;        // e.g., "btc-long"
        string endpoint;    // e.g., "/api/trade"
        string feedbackURI; // Off-chain details (IPFS)
        bytes32 feedbackHash;
        uint256 timestamp;
        bool revoked;
    }
    
    // agentId => clientAddress => feedbackIndex => Feedback
    mapping(uint256 => mapping(address => mapping(uint64 => Feedback))) public feedbacks;
    
    // agentId => clientAddress => feedbackCount
    mapping(uint256 => mapping(address => uint64)) public feedbackCount;
    
    // Aggregated scores for quick access
    mapping(uint256 => uint256) public totalScore;
    mapping(uint256 => uint256) public feedbackTotal;
    
    // Tag-based reputation tracking
    mapping(uint256 => mapping(string => uint256)) public tagScores;
    mapping(uint256 => mapping(string => uint256)) public tagCounts;
    
    event NewFeedback(
        uint256 indexed agentId,
        address indexed clientAddress,
        uint64 feedbackIndex,
        uint8 score,
        string indexed tag1,
        string tag2,
        string endpoint,
        string feedbackURI,
        bytes32 feedbackHash
    );
    
    event FeedbackRevoked(
        uint256 indexed agentId,
        address indexed clientAddress,
        uint64 indexed feedbackIndex
    );
    
    constructor(address _identityRegistry) {
        identityRegistry = IdentityRegistry(_identityRegistry);
    }
    
    function getIdentityRegistry() external view returns (address) {
        return address(identityRegistry);
    }
    
    /**
     * @notice Submit feedback for an agent
     */
    function giveFeedback(
        uint256 agentId,
        uint8 score,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external {
        require(identityRegistry.ownerOf(agentId) != address(0), "Agent not registered");
        require(identityRegistry.isAgentActive(agentId), "Agent not active");
        require(score <= 100, "Score must be 0-100");
        
        uint64 feedbackIndex = feedbackCount[agentId][msg.sender];
        
        feedbacks[agentId][msg.sender][feedbackIndex] = Feedback({
            score: score,
            tag1: tag1,
            tag2: tag2,
            endpoint: endpoint,
            feedbackURI: feedbackURI,
            feedbackHash: feedbackHash,
            timestamp: block.timestamp,
            revoked: false
        });
        
        feedbackCount[agentId][msg.sender] = feedbackIndex + 1;
        totalScore[agentId] += score;
        feedbackTotal[agentId] += 1;
        
        // Update tag-based scores
        if (bytes(tag1).length > 0) {
            tagScores[agentId][tag1] += score;
            tagCounts[agentId][tag1] += 1;
        }
        
        emit NewFeedback(
            agentId,
            msg.sender,
            feedbackIndex,
            score,
            tag1,
            tag2,
            endpoint,
            feedbackURI,
            feedbackHash
        );
    }
    
    /**
     * @notice Revoke previously given feedback
     */
    function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external {
        Feedback storage fb = feedbacks[agentId][msg.sender][feedbackIndex];
        require(!fb.revoked, "Already revoked");
        require(fb.timestamp > 0, "Feedback not found");
        
        fb.revoked = true;
        totalScore[agentId] -= fb.score;
        feedbackTotal[agentId] -= 1;
        
        // Update tag-based scores
        if (bytes(fb.tag1).length > 0) {
            tagScores[agentId][fb.tag1] -= fb.score;
            tagCounts[agentId][fb.tag1] -= 1;
        }
        
        emit FeedbackRevoked(agentId, msg.sender, feedbackIndex);
    }
    
    /**
     * @notice Get average reputation score for an agent
     */
    function getAverageScore(uint256 agentId) external view returns (uint8) {
        if (feedbackTotal[agentId] == 0) return 0;
        return uint8(totalScore[agentId] / feedbackTotal[agentId]);
    }
    
    /**
     * @notice Get average score for a specific tag
     */
    function getTagAverageScore(uint256 agentId, string calldata tag) external view returns (uint8) {
        if (tagCounts[agentId][tag] == 0) return 0;
        return uint8(tagScores[agentId][tag] / tagCounts[agentId][tag]);
    }
    
    /**
     * @notice Get feedback details
     */
    function getFeedback(
        uint256 agentId,
        address clientAddress,
        uint64 feedbackIndex
    ) external view returns (
        uint8 score,
        string memory tag1,
        string memory tag2,
        string memory endpoint,
        string memory feedbackURI,
        bytes32 feedbackHash,
        uint256 timestamp,
        bool revoked
    ) {
        Feedback memory fb = feedbacks[agentId][clientAddress][feedbackIndex];
        return (
            fb.score,
            fb.tag1,
            fb.tag2,
            fb.endpoint,
            fb.feedbackURI,
            fb.feedbackHash,
            fb.timestamp,
            fb.revoked
        );
    }
    
    /**
     * @notice Get total feedback count for an agent
     */
    function getTotalFeedbackCount(uint256 agentId) external view returns (uint256) {
        return feedbackTotal[agentId];
    }
}
