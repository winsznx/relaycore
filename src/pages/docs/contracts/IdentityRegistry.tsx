import { Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';

export default function DocsIdentityRegistry() {
    return (
        <div className="space-y-8">
            <div>
                <Link
                    to="/docs/contracts/deployment"
                    className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Contracts
                </Link>
                <h1 className="text-4xl font-bold text-gray-900 mb-4">Identity Registry Contract</h1>
                <p className="text-lg text-gray-600">
                    ERC-8004 based registry where each AI agent is represented as an NFT on Cronos.
                </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                    <strong>Based on ERC-8004:</strong> The Identity Registry implements the EIP-8004 standard
                    for AI agent identity, providing NFT-based registration with URI metadata.
                </p>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Contract Addresses</h2>
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <p className="text-sm text-gray-600 mb-2">Cronos Testnet (Chain 338):</p>
                        <code className="text-sm text-gray-900">TBD (Deploy in progress)</code>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <p className="text-sm text-gray-600 mb-2">Cronos Mainnet (Chain 25):</p>
                        <code className="text-sm text-gray-400">Coming after testnet validation</code>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Contract Code</h2>
                <pre className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-300">{`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title IdentityRegistry
 * @dev ERC-8004 Identity Registry - Agents as NFTs
 */
contract IdentityRegistry is ERC721URIStorage, Ownable {
    uint256 private _tokenIdCounter;
    
    // Wallet address for reputation aggregation
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
    
    constructor() 
        ERC721("Relay Core Agents", "RCAGENT") 
        Ownable(msg.sender) 
    {
        _tokenIdCounter = 1; // Start from 1
    }
    
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
    
    function setAgentURI(uint256 agentId, string memory newURI) external {
        require(_isAuthorized(ownerOf(agentId), msg.sender, agentId), "Not authorized");
        _setTokenURI(agentId, newURI);
        emit AgentURIUpdated(agentId, newURI);
    }
    
    function deactivateAgent(uint256 agentId) external {
        require(_isAuthorized(ownerOf(agentId), msg.sender, agentId), "Not authorized");
        isActive[agentId] = false;
        emit AgentDeactivated(agentId);
    }
    
    function reactivateAgent(uint256 agentId) external {
        require(_isAuthorized(ownerOf(agentId), msg.sender, agentId), "Not authorized");
        isActive[agentId] = true;
        emit AgentReactivated(agentId);
    }
    
    function totalAgents() external view returns (uint256) {
        return _tokenIdCounter - 1;
    }
    
    function isAgentActive(uint256 agentId) external view returns (bool) {
        return _ownerOf(agentId) != address(0) && isActive[agentId];
    }
}`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Agent Metadata JSON</h2>
                <p className="text-gray-600">
                    The <code className="bg-gray-100 px-2 py-1 rounded text-sm">agentURI</code> should point to
                    a JSON file (IPFS or HTTPS) with this structure:
                </p>
                <pre className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-300">{`{
  "name": "PerpAI Quote",
  "description": "Get trade quotes with AI-optimized routing",
  "version": "1.0.0",
  "agent_type": "trading",
  "owner": "0x6985520C99B70817177ed22312fF4e73bCf3f063",
  "endpoint": "https://api.relaycore.xyz/api/agents/relaycore.perp-ai-quote/invoke",
  "permissions": {
    "requires_payment": true,
    "payment_amount": "5000",
    "payment_token": "USDC"
  },
  "input_schema": {
    "type": "object",
    "properties": {
      "pair": { "type": "string" },
      "side": { "type": "string", "enum": ["long", "short"] },
      "leverage": { "type": "number" },
      "sizeUsd": { "type": "number" }
    }
  }
}`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Functions</h2>

                <div className="space-y-4">
                    <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-2">registerAgent</h3>
                        <p className="text-sm text-gray-600 mb-3">Register a new AI agent and mint an NFT. Returns the new agent ID.</p>
                        <pre className="bg-gray-900 border border-gray-700 rounded p-3 text-xs">
                            <code className="text-gray-300">{`function registerAgent(
  string memory agentURI,    // IPFS or HTTPS URI to metadata JSON
  address walletAddress      // Optional wallet for the agent
) external returns (uint256 agentId)`}</code>
                        </pre>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-2">setAgentURI</h3>
                        <p className="text-sm text-gray-600 mb-3">Update the metadata URI for an agent (owner only).</p>
                        <pre className="bg-gray-900 border border-gray-700 rounded p-3 text-xs">
                            <code className="text-gray-300">{`function setAgentURI(
  uint256 agentId,
  string memory newURI
) external`}</code>
                        </pre>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-2">deactivateAgent / reactivateAgent</h3>
                        <p className="text-sm text-gray-600 mb-3">Toggle agent active status. Inactive agents won't receive invocations.</p>
                        <pre className="bg-gray-900 border border-gray-700 rounded p-3 text-xs">
                            <code className="text-gray-300">{`function deactivateAgent(uint256 agentId) external
function reactivateAgent(uint256 agentId) external`}</code>
                        </pre>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-2">isAgentActive</h3>
                        <p className="text-sm text-gray-600 mb-3">Check if an agent exists and is active.</p>
                        <pre className="bg-gray-900 border border-gray-700 rounded p-3 text-xs">
                            <code className="text-gray-300">{`function isAgentActive(uint256 agentId) external view returns (bool)`}</code>
                        </pre>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Usage Example</h2>
                <pre className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-300">{`import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider('https://evm-t3.cronos.org');
const signer = new ethers.Wallet(privateKey, provider);

const identityRegistry = new ethers.Contract(
  IDENTITY_REGISTRY_ADDRESS,
  IdentityRegistryABI,
  signer
);

// 1. Upload metadata to IPFS first
const metadataURI = 'ipfs://QmYourAgentMetadata...';

// 2. Register the agent
const tx = await identityRegistry.registerAgent(
  metadataURI,
  signer.address  // Agent wallet
);

const receipt = await tx.wait();

// 3. Get the minted agentId from events
const event = receipt.logs.find(
  log => log.topics[0] === ethers.id('AgentRegistered(uint256,address,string,address)')
);
const agentId = ethers.toBigInt(event.topics[1]);

console.log('Agent registered with ID:', agentId.toString());

// 4. Check agent status
const isActive = await identityRegistry.isAgentActive(agentId);
console.log('Agent active:', isActive);

// 5. Update URI if needed
await identityRegistry.setAgentURI(agentId, 'ipfs://QmNewMetadata...');`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Gas Estimates</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="text-left p-3">Operation</th>
                                <th className="text-left p-3">Gas</th>
                                <th className="text-left p-3">~Cost (5000 gwei)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            <tr>
                                <td className="p-3 font-mono">registerAgent</td>
                                <td className="p-3">~150,000</td>
                                <td className="p-3">~0.00075 CRO</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono">setAgentURI</td>
                                <td className="p-3">~50,000</td>
                                <td className="p-3">~0.00025 CRO</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono">deactivateAgent</td>
                                <td className="p-3">~30,000</td>
                                <td className="p-3">~0.00015 CRO</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono">reactivateAgent</td>
                                <td className="p-3">~30,000</td>
                                <td className="p-3">~0.00015 CRO</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Related</h2>
                <div className="grid md:grid-cols-2 gap-4">
                    <Link
                        to="/docs/contracts/reputation"
                        className="flex items-center gap-3 p-4 bg-white rounded-lg hover:shadow-md transition-shadow"
                    >
                        <div>
                            <div className="font-semibold">Reputation Registry →</div>
                            <div className="text-sm text-gray-500">On-chain feedback system</div>
                        </div>
                    </Link>
                    <Link
                        to="/docs/api/sdk"
                        className="flex items-center gap-3 p-4 bg-white rounded-lg hover:shadow-md transition-shadow"
                    >
                        <div>
                            <div className="font-semibold">SDK Guide →</div>
                            <div className="text-sm text-gray-500">Off-chain SDK registration</div>
                        </div>
                    </Link>
                </div>
            </div>
        </div>
    );
}
