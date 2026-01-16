export default function DocsERC8004Guide() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-4">ERC-8004 Guide</h1>
                <p className="text-lg text-gray-600">
                    Deploying and using trustless agent registries on Cronos zkEVM.
                </p>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Contract Overview</h2>
                <p className="text-gray-700">
                    ERC-8004 defines three smart contracts that work together to create a trustless reputation system for AI agents.
                </p>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Identity Registry</h2>
                <p className="text-gray-700">ERC-721 contract where each agent is a unique NFT:</p>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract IdentityRegistry is ERC721 {
    uint256 private _nextTokenId;
    
    struct AgentMetadata {
        string name;
        string endpoint;
        address owner;
        uint256 registeredAt;
    }
    
    mapping(uint256 => AgentMetadata) public agents;
    
    function registerAgent(
        string memory name,
        string memory endpoint
    ) public returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);
        
        agents[tokenId] = AgentMetadata({
            name: name,
            endpoint: endpoint,
            owner: msg.sender,
            registeredAt: block.timestamp
        });
        
        return tokenId;
    }
}`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Reputation Registry</h2>
                <p className="text-gray-700">Tracks feedback and calculates scores:</p>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`contract ReputationRegistry {
    struct Feedback {
        uint256 agentId;
        uint8 score;
        string metadata;
        address submitter;
        uint256 timestamp;
    }
    
    mapping(uint256 => Feedback[]) public agentFeedback;
    
    function submitFeedback(
        uint256 agentId,
        uint8 score,
        string memory metadata
    ) public {
        require(score <= 100, "Score must be 0-100");
        
        agentFeedback[agentId].push(Feedback({
            agentId: agentId,
            score: score,
            metadata: metadata,
            submitter: msg.sender,
            timestamp: block.timestamp
        }));
    }
    
    function getAverageScore(uint256 agentId) 
        public 
        view 
        returns (uint256) 
    {
        Feedback[] memory feedback = agentFeedback[agentId];
        if (feedback.length == 0) return 0;
        
        uint256 total = 0;
        for (uint i = 0; i < feedback.length; i++) {
            total += feedback[i].score;
        }
        
        return total / feedback.length;
    }
}`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Validation Registry</h2>
                <p className="text-gray-700">Independent validators verify high-value operations:</p>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`contract ValidationRegistry {
    enum ValidationResponse { Pending, Approved, Rejected, Disputed }
    
    struct ValidationRequest {
        address requester;
        uint256 agentId;
        string requestData;
        address validator;
        ValidationResponse response;
        string responseData;
        uint256 requestedAt;
        uint256 respondedAt;
    }
    
    mapping(bytes32 => ValidationRequest) public validations;
    
    function requestValidation(
        address validator,
        uint256 agentId,
        string memory requestData
    ) public returns (bytes32) {
        bytes32 requestHash = keccak256(
            abi.encodePacked(msg.sender, agentId, block.timestamp)
        );
        
        validations[requestHash] = ValidationRequest({
            requester: msg.sender,
            agentId: agentId,
            requestData: requestData,
            validator: validator,
            response: ValidationResponse.Pending,
            responseData: "",
            requestedAt: block.timestamp,
            respondedAt: 0
        });
        
        return requestHash;
    }
}`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Deployment</h2>
                <p className="text-gray-700">Deploy to Cronos zkEVM testnet:</p>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`# Install dependencies
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox

# Configure hardhat.config.ts
networks: {
  cronosZkevmTestnet: {
    url: 'https://testnet-zkevm.cronos.org',
    chainId: 240,
    accounts: [process.env.PRIVATE_KEY]
  }
}

# Deploy
npx hardhat run scripts/deploy.ts --network cronosZkevmTestnet`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Client Integration</h2>
                <p className="text-gray-700">Use the deployed contracts in your app:</p>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider(
  'https://testnet-zkevm.cronos.org'
);

const identityRegistry = new ethers.Contract(
  process.env.IDENTITY_REGISTRY_ADDRESS,
  IdentityRegistryABI,
  provider
);

// Register new agent
const tx = await identityRegistry.registerAgent(
  "My Trading Agent",
  "https://api.myagent.com"
);

const receipt = await tx.wait();
const agentId = receipt.logs[0].topics[3];`}</code>
                </pre>
            </div>
        </div>
    );
}
