/**
 * Signing Service
 * 
 * Handles the complete handoff signing flow:
 * 1. Agent calls MCP tool -> creates pending transaction
 * 2. User opens signing URL in browser
 * 3. User connects wallet and signs
 * 4. Backend broadcasts transaction
 * 5. Indexer records result
 * 
 * SECURITY: No private keys are ever stored or transmitted.
 * All signing happens in user's wallet via browser.
 */

import { ethers } from 'ethers';
import {
    pendingTransactionStore,
    getSigningUrl,
    type CreatePendingTransactionParams
} from './pending-transactions';

// ============================================
// TYPES
// ============================================

export interface SigningRequest {
    id: string;
    chainId: number;
    to: string;
    data: string;
    value: string;
    description?: string;
    tool: string;
    expiresAt: Date;
    status: string;
}

export interface SigningResult {
    success: boolean;
    transactionId: string;
    txHash?: string;
    blockNumber?: number;
    error?: string;
}

export interface PrepareTransactionResult {
    transactionId: string;
    signingUrl: string;
    expiresAt: Date;
    chainId: number;
    description?: string;
}

// ============================================
// CHAIN CONFIGURATION
// ============================================

const CHAIN_RPC_URLS: Record<number, string> = {
    25: process.env.CRONOS_MAINNET_RPC || 'https://evm.cronos.org',
    338: process.env.CRONOS_TESTNET_RPC || 'https://evm-t3.cronos.org',
    388: process.env.CRONOS_ZKEVM_MAINNET_RPC || 'https://mainnet.zkevm.cronos.org',
    240: process.env.CRONOS_ZKEVM_TESTNET_RPC || 'https://testnet.zkevm.cronos.org'
};

function getProvider(chainId: number): ethers.JsonRpcProvider {
    const rpcUrl = CHAIN_RPC_URLS[chainId];
    if (!rpcUrl) {
        throw new Error(`Unsupported chain ID: ${chainId}`);
    }
    return new ethers.JsonRpcProvider(rpcUrl, chainId);
}

// ============================================
// SIGNING SERVICE
// ============================================

export class SigningService {
    private baseUrl: string;

    constructor(baseUrl?: string) {
        this.baseUrl = baseUrl || process.env.RELAY_CORE_URL || 'https://api.relaycore.xyz';
    }

    /**
     * Prepare a transaction for handoff signing
     * This is the main entry point for MCP tools
     */
    prepareTransaction(params: CreatePendingTransactionParams): PrepareTransactionResult {
        const transaction = pendingTransactionStore.create(params);
        const signingUrl = getSigningUrl(transaction.id, this.baseUrl);

        return {
            transactionId: transaction.id,
            signingUrl,
            expiresAt: transaction.expiresAt,
            chainId: transaction.chainId,
            description: transaction.context.description
        };
    }

    /**
     * Get signing request for UI display
     * Called when user opens signing URL
     */
    getSigningRequest(transactionId: string): SigningRequest | null {
        const tx = pendingTransactionStore.get(transactionId);
        if (!tx) return null;

        return {
            id: tx.id,
            chainId: tx.chainId,
            to: tx.to,
            data: tx.data,
            value: tx.value,
            description: tx.context.description,
            tool: tx.context.tool,
            expiresAt: tx.expiresAt,
            status: tx.status
        };
    }

    /**
     * Process signed transaction from UI
     * Called after user signs in their wallet
     */
    async processSignedTransaction(
        transactionId: string,
        signedTransaction: string,
        signerAddress: string
    ): Promise<SigningResult> {
        const tx = pendingTransactionStore.get(transactionId);

        if (!tx) {
            return {
                success: false,
                transactionId,
                error: 'Transaction not found'
            };
        }

        if (tx.status !== 'pending') {
            return {
                success: false,
                transactionId,
                error: `Invalid status: ${tx.status}. Expected: pending`
            };
        }

        if (new Date() > tx.expiresAt) {
            pendingTransactionStore.markFailed(transactionId, 'Transaction expired');
            return {
                success: false,
                transactionId,
                error: 'Transaction has expired'
            };
        }

        try {
            // Mark as signed
            pendingTransactionStore.markSigned(transactionId, signerAddress);

            // Broadcast transaction
            const provider = getProvider(tx.chainId);
            const txResponse = await provider.broadcastTransaction(signedTransaction);

            // Mark as broadcast
            pendingTransactionStore.markBroadcast(transactionId, txResponse.hash);

            // Wait for confirmation (with timeout)
            const receipt = await Promise.race([
                txResponse.wait(1),
                new Promise<null>((resolve) => setTimeout(() => resolve(null), 30000))
            ]);

            if (receipt && receipt.status === 1) {
                pendingTransactionStore.markConfirmed(
                    transactionId,
                    receipt.blockNumber,
                    receipt.blockHash,
                    receipt.gasUsed.toString()
                );

                return {
                    success: true,
                    transactionId,
                    txHash: txResponse.hash,
                    blockNumber: receipt.blockNumber
                };
            } else if (receipt && receipt.status === 0) {
                pendingTransactionStore.markFailed(transactionId, 'Transaction reverted');
                return {
                    success: false,
                    transactionId,
                    txHash: txResponse.hash,
                    error: 'Transaction reverted on-chain'
                };
            } else {
                // Still pending after timeout - return success with just hash
                return {
                    success: true,
                    transactionId,
                    txHash: txResponse.hash
                };
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            pendingTransactionStore.markFailed(transactionId, errorMessage);

            return {
                success: false,
                transactionId,
                error: errorMessage
            };
        }
    }

    /**
     * Get transaction status
     * Used by agents to poll for completion
     */
    getTransactionStatus(transactionId: string): {
        found: boolean;
        status?: string;
        txHash?: string;
        blockNumber?: number;
        error?: string;
    } {
        const tx = pendingTransactionStore.get(transactionId);

        if (!tx) {
            return { found: false };
        }

        return {
            found: true,
            status: tx.status,
            txHash: tx.txHash,
            blockNumber: tx.blockNumber,
            error: tx.errorMessage
        };
    }

    /**
     * Cancel a pending transaction
     */
    cancelTransaction(transactionId: string): boolean {
        const tx = pendingTransactionStore.get(transactionId);

        if (!tx || tx.status !== 'pending') {
            return false;
        }

        pendingTransactionStore.markFailed(transactionId, 'Cancelled by user');
        return true;
    }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const signingService = new SigningService();

// ============================================
// CONTRACT INTERACTION HELPERS
// ============================================

/**
 * Prepare an ERC20 approve transaction
 */
export function prepareERC20Approve(
    chainId: number,
    tokenAddress: string,
    spender: string,
    amount: string,
    context: { tool: string; sessionId?: string; agentId?: string }
): PrepareTransactionResult {
    const iface = new ethers.Interface([
        'function approve(address spender, uint256 amount) returns (bool)'
    ]);

    const data = iface.encodeFunctionData('approve', [spender, amount]);

    return signingService.prepareTransaction({
        chainId,
        to: tokenAddress,
        data,
        value: '0',
        context: {
            ...context,
            params: { chainId, tokenAddress, spender, amount },
            description: `Approve ${spender} to spend tokens`
        }
    });
}

/**
 * Prepare an ERC20 transfer transaction
 */
export function prepareERC20Transfer(
    chainId: number,
    tokenAddress: string,
    recipient: string,
    amount: string,
    context: { tool: string; sessionId?: string; agentId?: string }
): PrepareTransactionResult {
    const iface = new ethers.Interface([
        'function transfer(address to, uint256 amount) returns (bool)'
    ]);

    const data = iface.encodeFunctionData('transfer', [recipient, amount]);

    return signingService.prepareTransaction({
        chainId,
        to: tokenAddress,
        data,
        value: '0',
        context: {
            ...context,
            params: { chainId, tokenAddress, recipient, amount },
            description: `Transfer tokens to ${recipient.slice(0, 10)}...`
        }
    });
}

/**
 * Prepare a native token (CRO) transfer
 */
export function prepareNativeTransfer(
    chainId: number,
    recipient: string,
    amount: string,
    context: { tool: string; sessionId?: string; agentId?: string }
): PrepareTransactionResult {
    return signingService.prepareTransaction({
        chainId,
        to: recipient,
        data: '0x',
        value: amount,
        context: {
            ...context,
            params: { chainId, recipient, amount },
            description: `Send CRO to ${recipient.slice(0, 10)}...`
        }
    });
}

/**
 * Prepare escrow session creation
 */
export function prepareEscrowSessionCreate(
    chainId: number,
    escrowContract: string,
    escrowAgent: string,
    maxSpend: string,
    duration: number,
    agents: string[],
    context: { tool: string; sessionId?: string; agentId?: string }
): PrepareTransactionResult {
    const iface = new ethers.Interface([
        'function createSession(address escrowAgent, uint256 maxSpend, uint256 duration, address[] agents) returns (uint256)'
    ]);

    const data = iface.encodeFunctionData('createSession', [
        escrowAgent,
        maxSpend,
        duration,
        agents
    ]);

    return signingService.prepareTransaction({
        chainId,
        to: escrowContract,
        data,
        value: '0',
        context: {
            ...context,
            params: { chainId, escrowContract, escrowAgent, maxSpend, duration, agents },
            description: `Create escrow session (max: ${ethers.formatUnits(maxSpend, 6)} USDC)`
        }
    });
}

/**
 * Prepare escrow deposit
 */
export function prepareEscrowDeposit(
    chainId: number,
    escrowContract: string,
    sessionId: string,
    amount: string,
    context: { tool: string; agentId?: string }
): PrepareTransactionResult {
    const iface = new ethers.Interface([
        'function deposit(uint256 sessionId, uint256 amount)'
    ]);

    const data = iface.encodeFunctionData('deposit', [sessionId, amount]);

    return signingService.prepareTransaction({
        chainId,
        to: escrowContract,
        data,
        value: '0',
        context: {
            ...context,
            sessionId,
            params: { chainId, escrowContract, sessionId, amount },
            description: `Deposit ${ethers.formatUnits(amount, 6)} USDC to session ${sessionId}`
        }
    });
}

/**
 * Prepare escrow refund
 */
export function prepareEscrowRefund(
    chainId: number,
    escrowContract: string,
    sessionId: string,
    context: { tool: string; agentId?: string }
): PrepareTransactionResult {
    const iface = new ethers.Interface([
        'function refund(uint256 sessionId)'
    ]);

    const data = iface.encodeFunctionData('refund', [sessionId]);

    return signingService.prepareTransaction({
        chainId,
        to: escrowContract,
        data,
        value: '0',
        context: {
            ...context,
            sessionId,
            params: { chainId, escrowContract, sessionId },
            description: `Refund remaining balance from session ${sessionId}`
        }
    });
}

/**
 * Prepare escrow session close
 */
export function prepareEscrowClose(
    chainId: number,
    escrowContract: string,
    sessionId: string,
    context: { tool: string; agentId?: string }
): PrepareTransactionResult {
    const iface = new ethers.Interface([
        'function closeSession(uint256 sessionId)'
    ]);

    const data = iface.encodeFunctionData('closeSession', [sessionId]);

    return signingService.prepareTransaction({
        chainId,
        to: escrowContract,
        data,
        value: '0',
        context: {
            ...context,
            sessionId,
            params: { chainId, escrowContract, sessionId },
            description: `Close session ${sessionId} and refund remaining`
        }
    });
}
