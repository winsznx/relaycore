/**
 * ERC-8004 Integration Service
 * 
 * Handles interaction with ERC-8004 registries:
 * - Identity Registry (Agent NFTs)
 * - Reputation Registry (Feedback)
 * - Validation Registry (Independent verification)
 */

import { ethers } from 'ethers';

const IDENTITY_REGISTRY_ABI = [
    'function registerAgent(string memory agentURI, address walletAddress) external returns (uint256)',
    'function ownerOf(uint256 tokenId) view returns (address)',
    'function isAgentActive(uint256 agentId) view returns (bool)',
    'function tokenURI(uint256 tokenId) view returns (string)',
    'event AgentRegistered(uint256 indexed agentId, address indexed owner, string agentURI, address walletAddress)',
];

const REPUTATION_REGISTRY_ABI = [
    'function giveFeedback(uint256 agentId, uint8 score, string calldata tag1, string calldata tag2, string calldata endpoint, string calldata feedbackURI, bytes32 feedbackHash) external',
    'function getAverageScore(uint256 agentId) view returns (uint8)',
    'function getTagAverageScore(uint256 agentId, string calldata tag) view returns (uint8)',
    'function getTotalFeedbackCount(uint256 agentId) view returns (uint256)',
    'event NewFeedback(uint256 indexed agentId, address indexed clientAddress, uint64 feedbackIndex, uint8 score, string indexed tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)',
];

const VALIDATION_REGISTRY_ABI = [
    'function validationRequest(address validatorAddress, uint256 agentId, string calldata requestURI, bytes32 requestHash) external',
    'function validationResponse(bytes32 requestHash, uint8 response, string calldata responseURI, bytes32 responseHash, string calldata tag) external',
    'function getValidation(bytes32 requestHash) view returns (address, uint256, uint8, string, string, bytes32, uint256, bool)',
    'event ValidationRequest(address indexed validatorAddress, uint256 indexed agentId, string requestURI, bytes32 indexed requestHash)',
    'event ValidationResponse(address indexed validatorAddress, uint256 indexed agentId, bytes32 indexed requestHash, uint8 response, string responseURI, bytes32 responseHash, string tag)',
];

export interface TradeOutcome {
    agentId: number;
    score: number; // 0-100
    tag1: string; // e.g., "trade"
    tag2: string; // e.g., "btc-long"
    endpoint: string; // e.g., "/api/trade/execute"
    tradeData: any; // Full trade data for IPFS
}

export interface ValidationRequest {
    validatorAddress: string;
    agentId: number;
    requestData: any; // Data to validate
}

/**
 * Record trade outcome to Reputation Registry
 */
export async function recordTradeOutcome(
    outcome: TradeOutcome,
    signer: ethers.Signer
): Promise<string> {
    try {
        const reputationRegistry = new ethers.Contract(
            process.env.REPUTATION_REGISTRY_ADDRESS || '',
            REPUTATION_REGISTRY_ABI,
            signer
        );

        // Create feedback hash
        const feedbackHash = ethers.keccak256(
            ethers.toUtf8Bytes(JSON.stringify(outcome.tradeData))
        );

        // For now, use empty feedbackURI (can upload to IPFS later)
        const feedbackURI = '';

        // Submit feedback
        const tx = await reputationRegistry.giveFeedback(
            outcome.agentId,
            outcome.score,
            outcome.tag1,
            outcome.tag2,
            outcome.endpoint,
            feedbackURI,
            feedbackHash
        );

        const receipt = await tx.wait();
        return receipt.hash;
    } catch (error: any) {
        console.error('Failed to record trade outcome:', error);
        throw new Error(`Reputation recording failed: ${error.message}`);
    }
}

/**
 * Get agent reputation score
 */
export async function getAgentReputation(
    agentId: number,
    network: 'testnet' | 'mainnet' = 'testnet'
): Promise<{
    averageScore: number;
    totalFeedback: number;
    isActive: boolean;
}> {
    try {
        const rpcUrl = network === 'testnet'
            ? 'https://evm-t3-zkevm.cronos.org'
            : 'https://evm.cronos.org';

        const provider = new ethers.JsonRpcProvider(rpcUrl);

        const identityRegistry = new ethers.Contract(
            process.env.IDENTITY_REGISTRY_ADDRESS || '',
            IDENTITY_REGISTRY_ABI,
            provider
        );

        const reputationRegistry = new ethers.Contract(
            process.env.REPUTATION_REGISTRY_ADDRESS || '',
            REPUTATION_REGISTRY_ABI,
            provider
        );

        const [isActive, averageScore, totalFeedback] = await Promise.all([
            identityRegistry.isAgentActive(agentId),
            reputationRegistry.getAverageScore(agentId),
            reputationRegistry.getTotalFeedbackCount(agentId),
        ]);

        return {
            averageScore: Number(averageScore),
            totalFeedback: Number(totalFeedback),
            isActive,
        };
    } catch (error: any) {
        console.error('Failed to get agent reputation:', error);
        throw new Error(`Reputation fetch failed: ${error.message}`);
    }
}

/**
 * Request validation for high-value trade
 */
export async function requestTradeValidation(
    request: ValidationRequest,
    signer: ethers.Signer
): Promise<string> {
    try {
        const validationRegistry = new ethers.Contract(
            process.env.VALIDATION_REGISTRY_ADDRESS || '',
            VALIDATION_REGISTRY_ABI,
            signer
        );

        // Create request hash
        const requestHash = ethers.keccak256(
            ethers.toUtf8Bytes(JSON.stringify(request.requestData))
        );

        // For now, use empty requestURI (can upload to IPFS later)
        const requestURI = '';

        // Submit validation request
        const tx = await validationRegistry.validationRequest(
            request.validatorAddress,
            request.agentId,
            requestURI,
            requestHash
        );

        const receipt = await tx.wait();
        return receipt.hash;
    } catch (error: any) {
        console.error('Failed to request validation:', error);
        throw new Error(`Validation request failed: ${error.message}`);
    }
}

/**
 * Calculate trade outcome score (0-100)
 * Based on execution quality metrics
 */
export function calculateTradeScore(trade: {
    success: boolean;
    slippage: number;
    executionTime: number;
    priceImpact: number;
}): number {
    if (!trade.success) return 0;

    let score = 100;

    // Deduct for slippage (max -30 points)
    const slippagePenalty = Math.min(trade.slippage * 100, 30);
    score -= slippagePenalty;

    // Deduct for execution time (max -20 points)
    const timePenalty = Math.min(trade.executionTime / 1000, 20); // 1s = 1 point
    score -= timePenalty;

    // Deduct for price impact (max -20 points)
    const impactPenalty = Math.min(trade.priceImpact * 100, 20);
    score -= impactPenalty;

    return Math.max(0, Math.round(score));
}

/**
 * Register new agent on Identity Registry
 * Returns agentId (from event) and txHash
 */
export async function registerAgent(
    agentURI: string,
    walletAddress: string,
    signer: ethers.Signer
): Promise<{ agentId: number; txHash: string }> {
    try {
        const contractAddress = import.meta.env.VITE_IDENTITY_REGISTRY_ADDRESS ||
            process.env.IDENTITY_REGISTRY_ADDRESS || '';

        if (!contractAddress) {
            throw new Error('Identity Registry address not configured');
        }

        const identityRegistry = new ethers.Contract(
            contractAddress,
            IDENTITY_REGISTRY_ABI,
            signer
        );

        const tx = await identityRegistry.registerAgent(agentURI, walletAddress);
        const receipt = await tx.wait();

        // Extract agentId from event
        const event = receipt.logs.find((log: any) => {
            try {
                const parsed = identityRegistry.interface.parseLog(log);
                return parsed?.name === 'AgentRegistered';
            } catch {
                return false;
            }
        });

        if (event) {
            const parsed = identityRegistry.interface.parseLog(event);
            return {
                agentId: Number(parsed?.args.agentId),
                txHash: receipt.hash,
            };
        }

        throw new Error('AgentRegistered event not found');
    } catch (error: any) {
        console.error('Failed to register agent:', error);
        throw new Error(`Agent registration failed: ${error.message}`);
    }
}
