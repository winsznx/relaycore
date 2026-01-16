/**
 * Repository Layer for Cronos RPC Operations
 */

import { ethers } from 'ethers';
import logger from '../../../lib/logger.js';
import { INDEXER_CONFIG, CONTRACT_ABIS } from '../config/constants.js';

let provider: ethers.JsonRpcProvider | null = null;

/**
 * Get or create the Cronos RPC provider.
 */
export function getProvider(): ethers.JsonRpcProvider {
    if (!provider) {
        provider = new ethers.JsonRpcProvider(INDEXER_CONFIG.CRONOS_TESTNET_RPC);
    }
    return provider;
}

/**
 * Fetch the current block number.
 */
export async function getCurrentBlockNumber(): Promise<number> {
    try {
        const blockNumber = await getProvider().getBlockNumber();
        return blockNumber;
    } catch (error) {
        logger.error('Failed to fetch block number', error as Error);
        throw error;
    }
}

/**
 * Fetch a block by number or tag.
 */
export async function getBlock(blockTag: number | string): Promise<ethers.Block | null> {
    try {
        return await getProvider().getBlock(blockTag);
    } catch (error) {
        logger.error('Failed to fetch block', error as Error, { blockTag });
        throw error;
    }
}

/**
 * Fetch a transaction by hash.
 */
export async function getTransaction(txHash: string): Promise<ethers.TransactionResponse | null> {
    try {
        return await getProvider().getTransaction(txHash);
    } catch (error) {
        logger.error('Failed to fetch transaction', error as Error, { txHash });
        throw error;
    }
}

/**
 * Fetch a transaction receipt.
 */
export async function getTransactionReceipt(txHash: string): Promise<ethers.TransactionReceipt | null> {
    try {
        return await getProvider().getTransactionReceipt(txHash);
    } catch (error) {
        logger.error('Failed to fetch transaction receipt', error as Error, { txHash });
        throw error;
    }
}

/**
 * Query contract events within a block range.
 */
export async function queryContractEvents(
    contractAddress: string,
    abi: string[],
    eventName: string,
    fromBlock: number,
    toBlock: number
): Promise<ethers.EventLog[]> {
    try {
        const contract = new ethers.Contract(contractAddress, abi, getProvider());
        const filter = contract.filters[eventName]();
        const events = await contract.queryFilter(filter, fromBlock, toBlock);
        return events.filter((e): e is ethers.EventLog => e instanceof ethers.EventLog);
    } catch (error) {
        logger.error('Failed to query contract events', error as Error, {
            contractAddress,
            eventName,
            fromBlock,
            toBlock
        });
        throw error;
    }
}

/**
 * Query IdentityRegistry events.
 */
export async function queryAgentRegisteredEvents(fromBlock: number, toBlock: number): Promise<ethers.EventLog[]> {
    return queryContractEvents(
        INDEXER_CONFIG.IDENTITY_REGISTRY,
        CONTRACT_ABIS.IDENTITY_REGISTRY,
        'AgentRegistered',
        fromBlock,
        toBlock
    );
}

/**
 * Query ReputationRegistry events.
 */
export async function queryFeedbackEvents(fromBlock: number, toBlock: number): Promise<ethers.EventLog[]> {
    return queryContractEvents(
        INDEXER_CONFIG.REPUTATION_REGISTRY,
        CONTRACT_ABIS.REPUTATION_REGISTRY,
        'FeedbackSubmitted',
        fromBlock,
        toBlock
    );
}

/**
 * Query USDC Transfer events.
 */
export async function queryUSDCTransfers(fromBlock: number, toBlock: number): Promise<ethers.EventLog[]> {
    return queryContractEvents(
        INDEXER_CONFIG.USDC_ADDRESS,
        CONTRACT_ABIS.ERC20,
        'Transfer',
        fromBlock,
        toBlock
    );
}

/**
 * Call a contract view function.
 */
export async function callContractView<T>(
    contractAddress: string,
    abi: string[],
    functionName: string,
    args: unknown[] = []
): Promise<T> {
    try {
        const contract = new ethers.Contract(contractAddress, abi, getProvider());
        const result = await contract[functionName](...args);
        return result as T;
    } catch (error) {
        logger.error('Failed to call contract view', error as Error, {
            contractAddress,
            functionName
        });
        throw error;
    }
}

/**
 * Get total registered agents count.
 */
export async function getTotalAgents(): Promise<number> {
    const result = await callContractView<bigint>(
        INDEXER_CONFIG.IDENTITY_REGISTRY,
        CONTRACT_ABIS.IDENTITY_REGISTRY,
        'totalAgents'
    );
    return Number(result);
}

/**
 * Get agent details by ID.
 */
export async function getAgentDetails(agentId: number): Promise<{
    owner: string;
    agentURI: string;
    isActive: boolean;
}> {
    const result = await callContractView<[string, string, boolean]>(
        INDEXER_CONFIG.IDENTITY_REGISTRY,
        CONTRACT_ABIS.IDENTITY_REGISTRY,
        'getAgent',
        [agentId]
    );
    return {
        owner: result[0],
        agentURI: result[1],
        isActive: result[2]
    };
}

/**
 * Get reputation score for an address.
 */
export async function getReputationScore(address: string, tag: string = 'overall'): Promise<number> {
    const result = await callContractView<bigint>(
        INDEXER_CONFIG.REPUTATION_REGISTRY,
        CONTRACT_ABIS.REPUTATION_REGISTRY,
        'getAverageScore',
        [address, tag]
    );
    return Number(result);
}
