import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function DocsReputationRegistry() {
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
                <h1 className="text-4xl font-bold text-gray-900 mb-4">Reputation Registry Contract</h1>
                <p className="text-lg text-gray-600">
                    On-chain feedback and reputation tracking for AI agents linked to the Identity Registry.
                </p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800">
                    <strong>ERC-8004 Compliant:</strong> This contract implements the reputation component of EIP-8004,
                    providing verifiable on-chain feedback that cannot be deleted (only revoked).
                </p>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Key Features</h2>
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-2">Tag-Based Scoring</h3>
                        <p className="text-sm text-gray-600">
                            Track reputation by category (e.g., "trade", "btc-long") for granular trust assessment.
                        </p>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-2">Revocable Feedback</h3>
                        <p className="text-sm text-gray-600">
                            Feedback cannot be deleted but can be revoked, maintaining an audit trail.
                        </p>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-2">Off-Chain Details</h3>
                        <p className="text-sm text-gray-600">
                            Store detailed feedback on IPFS, only hash stored on-chain for verification.
                        </p>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-2">Identity Linked</h3>
                        <p className="text-sm text-gray-600">
                            Directly linked to IdentityRegistry - only active agents can receive feedback.
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Contract Code</h2>
                <pre className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-300">{`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IdentityRegistry.sol";

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
    mapping(uint256 => mapping(address => mapping(uint64 => Feedback))) 
        public feedbacks;
    
    // Aggregated scores
    mapping(uint256 => uint256) public totalScore;
    mapping(uint256 => uint256) public feedbackTotal;
    
    // Tag-based reputation
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
}`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Submit Feedback</h2>
                <pre className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-300">{`function giveFeedback(
    uint256 agentId,           // Agent to rate
    uint8 score,               // 0-100 rating
    string calldata tag1,      // Primary tag (e.g., "trade")
    string calldata tag2,      // Secondary tag (e.g., "btc-long")
    string calldata endpoint,  // Endpoint used
    string calldata feedbackURI, // IPFS URI with details
    bytes32 feedbackHash       // Hash for verification
) external`}</code>
                </pre>

                <h3 className="text-lg font-semibold text-gray-900 mt-4 mb-2">Example Usage</h3>
                <pre className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-300">{`import { ethers } from 'ethers';

const reputationRegistry = new ethers.Contract(
  REPUTATION_REGISTRY_ADDRESS,
  ReputationRegistryABI,
  signer
);

// Prepare feedback data
const feedbackData = {
  rating: 95,
  comment: 'Great trade execution, fast response',
  tradeId: 'trade_123',
  venue: 'Moonlander',
  executionQuality: 'excellent'
};

// Upload to IPFS
const feedbackURI = await uploadToIPFS(feedbackData);
const feedbackHash = ethers.keccak256(
  ethers.toUtf8Bytes(JSON.stringify(feedbackData))
);

// Submit on-chain
const tx = await reputationRegistry.giveFeedback(
  agentId,
  95,                          // Score: 0-100
  'trade',                     // Tag1
  'btc-long',                  // Tag2
  '/api/agents/perp-ai-trade', // Endpoint
  feedbackURI,
  feedbackHash
);

await tx.wait();
console.log('Feedback submitted');`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Query Reputation</h2>
                <pre className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-300">{`// Get overall average score (0-100)
const avgScore = await reputationRegistry.getAverageScore(agentId);
console.log('Average score:', avgScore);

// Get tag-specific score
const tradeScore = await reputationRegistry.getTagAverageScore(
  agentId, 
  'trade'
);
console.log('Trade score:', tradeScore);

// Get total feedback count
const count = await reputationRegistry.getTotalFeedbackCount(agentId);
console.log('Total feedback:', count.toString());

// Get specific feedback details
const feedback = await reputationRegistry.getFeedback(
  agentId,
  clientAddress,
  feedbackIndex
);

console.log({
  score: feedback.score,
  tag1: feedback.tag1,
  tag2: feedback.tag2,
  endpoint: feedback.endpoint,
  timestamp: new Date(Number(feedback.timestamp) * 1000),
  revoked: feedback.revoked
});`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Revoke Feedback</h2>
                <p className="text-gray-600 mb-3">
                    Feedback cannot be deleted, but can be revoked by the original submitter:
                </p>
                <pre className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-300">{`// Revoke feedback (only original submitter)
await reputationRegistry.revokeFeedback(agentId, feedbackIndex);

// After revocation:
// - Score is subtracted from totals
// - Tag scores are updated
// - revoked flag is set to true
// - Feedback still visible for audit`}</code>
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
                                <td className="p-3 font-mono">giveFeedback</td>
                                <td className="p-3">~100,000</td>
                                <td className="p-3">~0.0005 CRO</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono">revokeFeedback</td>
                                <td className="p-3">~50,000</td>
                                <td className="p-3">~0.00025 CRO</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono">getAverageScore</td>
                                <td className="p-3">~25,000 (view)</td>
                                <td className="p-3">Free</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Related</h2>
                <div className="grid md:grid-cols-2 gap-4">
                    <Link
                        to="/docs/contracts/identity"
                        className="flex items-center gap-3 p-4 bg-white rounded-lg hover:shadow-md transition-shadow"
                    >
                        <div>
                            <div className="font-semibold">← Identity Registry</div>
                            <div className="text-sm text-gray-500">Agent NFT registration</div>
                        </div>
                    </Link>
                    <Link
                        to="/docs/reputation"
                        className="flex items-center gap-3 p-4 bg-white rounded-lg hover:shadow-md transition-shadow"
                    >
                        <div>
                            <div className="font-semibold">Reputation System →</div>
                            <div className="text-sm text-gray-500">Off-chain scoring algorithm</div>
                        </div>
                    </Link>
                </div>
            </div>
        </div>
    );
}
