/**
 * On-Chain Contract Integration Hook
 * 
 * React hook for reading data from deployed ERC-8004 contracts
 * on Cronos Testnet.
 */

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

// Contract addresses (Cronos Testnet - Chain 338)
const CONTRACTS = {
    identityRegistry: import.meta.env.VITE_IDENTITY_REGISTRY_ADDRESS || '0x4b697D8ABC0e3dA0086011222755d9029DBB9C43',
    reputationRegistry: import.meta.env.VITE_REPUTATION_REGISTRY_ADDRESS || '0xdaFC2fA590C5Ba88155a009660dC3b14A3651a67',
    validationRegistry: import.meta.env.VITE_VALIDATION_REGISTRY_ADDRESS || '0x0483d030a1B1dA819dA08e2b73b01eFD28c67322'
};

const RPC_URL = import.meta.env.VITE_CRONOS_RPC_URL || 'https://evm-t3.cronos.org';

// ABIs (minimal read-only)
const IDENTITY_ABI = [
    "function totalAgents() view returns (uint256)",
    "function isAgentActive(uint256 agentId) view returns (bool)",
    "function tokenURI(uint256 agentId) view returns (string)",
    "function ownerOf(uint256 agentId) view returns (address)",
    "function agentWalletAddress(uint256 agentId) view returns (address)",
    "function registrationTimestamp(uint256 agentId) view returns (uint256)",
    "event AgentRegistered(uint256 indexed agentId, address indexed owner, string agentURI, address walletAddress)"
];

const REPUTATION_ABI = [
    "function getAverageScore(uint256 agentId) view returns (uint8)",
    "function getTotalFeedbackCount(uint256 agentId) view returns (uint256)",
    "function getTagAverageScore(uint256 agentId, string tag) view returns (uint8)",
    "function totalScore(uint256 agentId) view returns (uint256)",
    "function feedbackTotal(uint256 agentId) view returns (uint256)",
    "event NewFeedback(uint256 indexed agentId, address indexed clientAddress, uint64 feedbackIndex, uint8 score, string indexed tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)"
];

const VALIDATION_ABI = [
    "function getValidation(bytes32 requestHash) view returns (address validatorAddress, uint256 agentId, uint8 response, string tag, string responseURI, bytes32 responseHash, uint256 lastUpdate, bool completed)",
    "function getAgentValidations(uint256 agentId) view returns (bytes32[])",
    "function getValidatorRequests(address validator) view returns (bytes32[])",
    "function validatorCompletedCount(address) view returns (uint256)",
    "function validatorTotalScore(address) view returns (uint256)",
    "function getValidatorAverageScore(address validator) view returns (uint8)",
    "function getValidatorCompletedCount(address validator) view returns (uint256)",
    "event ValidationRequest(address indexed validatorAddress, uint256 indexed agentId, string requestURI, bytes32 indexed requestHash)",
    "event ValidationResponse(address indexed validatorAddress, uint256 indexed agentId, bytes32 indexed requestHash, uint8 response, string responseURI, bytes32 responseHash, string tag)"
];

export interface Agent {
    id: number;
    owner: string;
    walletAddress: string;
    uri: string;
    isActive: boolean;
    registrationTimestamp: number;
    reputation?: {
        averageScore: number;
        totalFeedback: number;
    };
}

export interface ContractStats {
    totalAgents: number;
    totalFeedback: number;
    averageReputation: number;
    lastUpdated: Date;
}

/**
 * Hook for reading on-chain contract data
 */
export function useOnChainContracts() {
    const [_provider, setProvider] = useState<ethers.JsonRpcProvider | null>(null);
    const [identityContract, setIdentityContract] = useState<ethers.Contract | null>(null);
    const [reputationContract, setReputationContract] = useState<ethers.Contract | null>(null);
    const [stats, setStats] = useState<ContractStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Initialize provider and contracts
    useEffect(() => {
        try {
            const rpcProvider = new ethers.JsonRpcProvider(RPC_URL);
            setProvider(rpcProvider);

            const identity = new ethers.Contract(
                CONTRACTS.identityRegistry,
                IDENTITY_ABI,
                rpcProvider
            );
            setIdentityContract(identity);

            const reputation = new ethers.Contract(
                CONTRACTS.reputationRegistry,
                REPUTATION_ABI,
                rpcProvider
            );
            setReputationContract(reputation);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to initialize contracts');
        }
    }, []);

    // Fetch contract stats
    const fetchStats = useCallback(async () => {
        if (!identityContract) return;

        setLoading(true);
        try {
            const totalAgents = await identityContract.totalAgents();

            // Calculate aggregate stats
            let totalFeedback = 0;
            let totalScore = 0;

            const numAgents = Number(totalAgents);

            if (numAgents > 0 && reputationContract) {
                for (let i = 1; i <= Math.min(numAgents, 10); i++) {
                    try {
                        const feedback = await reputationContract.feedbackTotal(i);
                        const score = await reputationContract.totalScore(i);
                        totalFeedback += Number(feedback);
                        totalScore += Number(score);
                    } catch (e) {
                        // Agent might not exist yet
                    }
                }
            }

            setStats({
                totalAgents: numAgents,
                totalFeedback,
                averageReputation: totalFeedback > 0 ? totalScore / totalFeedback : 0,
                lastUpdated: new Date()
            });
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch stats');
        } finally {
            setLoading(false);
        }
    }, [identityContract, reputationContract]);

    // Auto-fetch on mount
    useEffect(() => {
        if (identityContract) {
            fetchStats();
        }
    }, [identityContract, fetchStats]);

    // Get agent by ID
    const getAgent = useCallback(async (agentId: number): Promise<Agent | null> => {
        if (!identityContract || !reputationContract) return null;

        try {
            const [owner, walletAddress, uri, isActive, timestamp] = await Promise.all([
                identityContract.ownerOf(agentId),
                identityContract.agentWalletAddress(agentId),
                identityContract.tokenURI(agentId),
                identityContract.isAgentActive(agentId),
                identityContract.registrationTimestamp(agentId)
            ]);

            // Get reputation
            const [avgScore, feedbackCount] = await Promise.all([
                reputationContract.getAverageScore(agentId),
                reputationContract.getTotalFeedbackCount(agentId)
            ]);

            return {
                id: agentId,
                owner,
                walletAddress,
                uri,
                isActive,
                registrationTimestamp: Number(timestamp),
                reputation: {
                    averageScore: Number(avgScore),
                    totalFeedback: Number(feedbackCount)
                }
            };
        } catch (err) {
            console.error('Failed to fetch agent:', err);
            return null;
        }
    }, [identityContract, reputationContract]);

    // Get all agents
    const getAllAgents = useCallback(async (): Promise<Agent[]> => {
        if (!identityContract || !stats) return [];

        const agents: Agent[] = [];

        for (let i = 1; i <= stats.totalAgents; i++) {
            const agent = await getAgent(i);
            if (agent) {
                agents.push(agent);
            }
        }

        return agents;
    }, [identityContract, stats, getAgent]);

    return {
        stats,
        loading,
        error,
        getAgent,
        getAllAgents,
        refetch: fetchStats,
        contracts: CONTRACTS
    };
}

/**
 * Hook for subscribing to contract events
 */
export function useContractEvents() {
    const [events, setEvents] = useState<any[]>([]);
    const [listening, setListening] = useState(false);

    const startListening = useCallback(async () => {
        try {
            const provider = new ethers.JsonRpcProvider(RPC_URL);

            const identityContract = new ethers.Contract(
                CONTRACTS.identityRegistry,
                IDENTITY_ABI,
                provider
            );

            const reputationContract = new ethers.Contract(
                CONTRACTS.reputationRegistry,
                REPUTATION_ABI,
                provider
            );

            // Listen for AgentRegistered events
            identityContract.on('AgentRegistered', (agentId, owner, agentURI, walletAddress, event) => {
                setEvents(prev => [...prev, {
                    type: 'AgentRegistered',
                    agentId: Number(agentId),
                    owner,
                    agentURI,
                    walletAddress,
                    blockNumber: event.blockNumber,
                    timestamp: new Date()
                }]);
            });

            // Listen for NewFeedback events
            reputationContract.on('NewFeedback', (agentId, clientAddress, _feedbackIndex, score, tag1, tag2, endpoint, _feedbackURI, _feedbackHash, event) => {
                setEvents(prev => [...prev, {
                    type: 'NewFeedback',
                    agentId: Number(agentId),
                    clientAddress,
                    score: Number(score),
                    tag1,
                    tag2,
                    endpoint,
                    blockNumber: event.blockNumber,
                    timestamp: new Date()
                }]);
            });

            setListening(true);

            return () => {
                identityContract.removeAllListeners();
                reputationContract.removeAllListeners();
                setListening(false);
            };
        } catch (err) {
            console.error('Failed to start listening:', err);
        }
    }, []);

    return {
        events,
        listening,
        startListening,
        clearEvents: () => setEvents([])
    };
}

export { CONTRACTS, RPC_URL };
