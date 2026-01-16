// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title IdentityRegistry
 * @dev ERC-8004 Identity Registry - Agents as NFTs
 * 
 * Each agent gets a unique tokenId and URI pointing to registration JSON
 * Based on: https://eips.ethereum.org/EIPS/eip-8004
 */
contract IdentityRegistry is ERC721URIStorage, Ownable {
    uint256 private _tokenIdCounter;
    
    // Optional: on-chain wallet address for reputation aggregation
    mapping(uint256 => address) public agentWalletAddress;
    
    // Agent metadata
    mapping(uint256 => bool) public isActive;
    mapping(uint256 => uint256) public registrationTimestamp;
    
    event AgentRegistered(
        uint256 indexed agentId,
        address indexed owner,
        string agentURI,
        address walletAddress
    );
    
    event AgentURIUpdated(uint256 indexed agentId, string newURI);
    event AgentDeactivated(uint256 indexed agentId);
    event AgentReactivated(uint256 indexed agentId);
    
    constructor() ERC721("Relay Core Agents", "RCAGENT") Ownable(msg.sender) {
        _tokenIdCounter = 1; // Start from 1
    }
    
    /**
     * @notice Register a new agent
     * @param agentURI URI pointing to agent registration JSON (IPFS or HTTPS)
     * @param walletAddress Optional wallet address for this agent
     * @return agentId The newly minted agent ID
     */
    function registerAgent(
        string memory agentURI,
        address walletAddress
    ) external returns (uint256) {
        uint256 agentId = _tokenIdCounter;
        _tokenIdCounter++;
        
        _safeMint(msg.sender, agentId);
        _setTokenURI(agentId, agentURI);
        
        if (walletAddress != address(0)) {
            agentWalletAddress[agentId] = walletAddress;
        }
        
        isActive[agentId] = true;
        registrationTimestamp[agentId] = block.timestamp;
        
        emit AgentRegistered(agentId, msg.sender, agentURI, walletAddress);
        return agentId;
    }
    
    /**
     * @notice Update agent URI (only owner or approved)
     */
    function setAgentURI(uint256 agentId, string memory newURI) external {
        require(
            _isAuthorized(ownerOf(agentId), msg.sender, agentId),
            "Not authorized"
        );
        _setTokenURI(agentId, newURI);
        emit AgentURIUpdated(agentId, newURI);
    }
    
    /**
     * @notice Deactivate an agent (only owner)
     */
    function deactivateAgent(uint256 agentId) external {
        require(
            _isAuthorized(ownerOf(agentId), msg.sender, agentId),
            "Not authorized"
        );
        isActive[agentId] = false;
        emit AgentDeactivated(agentId);
    }
    
    /**
     * @notice Reactivate an agent (only owner)
     */
    function reactivateAgent(uint256 agentId) external {
        require(
            _isAuthorized(ownerOf(agentId), msg.sender, agentId),
            "Not authorized"
        );
        isActive[agentId] = true;
        emit AgentReactivated(agentId);
    }
    
    /**
     * @notice Get total registered agents
     */
    function totalAgents() external view returns (uint256) {
        return _tokenIdCounter - 1;
    }
    
    /**
     * @notice Check if agent exists and is active
     */
    function isAgentActive(uint256 agentId) external view returns (bool) {
        return _ownerOf(agentId) != address(0) && isActive[agentId];
    }
}
