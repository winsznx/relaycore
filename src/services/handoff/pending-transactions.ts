/**
 * Pending Transaction Store
 * 
 * Stores unsigned transactions awaiting user signature via handoff URL.
 * This is the core of the handoff signing pattern - agents NEVER sign,
 * they create pending transactions and receive signing URLs.
 * 
 * Production: This should be backed by Supabase/PostgreSQL
 * Current: In-memory store with TTL cleanup
 */

import { randomUUID } from 'crypto';

// ============================================
// TYPES
// ============================================

export type TransactionStatus =
    | 'pending'    // Created, awaiting signature
    | 'signed'     // Signed, ready to broadcast
    | 'broadcast'  // Sent to network
    | 'confirmed'  // Included in block
    | 'failed'     // Transaction failed
    | 'expired';   // TTL exceeded

export interface TransactionContext {
    tool: string;                          // MCP tool that created this
    params: Record<string, unknown>;       // Tool parameters (sanitized)
    sessionId?: string;                    // Associated session ID
    agentId?: string;                      // Agent that initiated
    description?: string;                  // Human-readable description
}

export interface PendingTransaction {
    id: string;
    createdAt: Date;
    expiresAt: Date;
    status: TransactionStatus;

    // Transaction details
    chainId: number;
    to: string;
    data: string;
    value: string;                         // wei as string
    gasLimit?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;

    // Context for UI and indexing
    context: TransactionContext;

    // After user connects wallet
    signerAddress?: string;

    // After broadcast
    txHash?: string;

    // After confirmation
    blockNumber?: number;
    blockHash?: string;
    gasUsed?: string;

    // Error tracking
    errorMessage?: string;

    // State transitions (for indexer)
    stateHistory: Array<{
        status: TransactionStatus;
        timestamp: Date;
        metadata?: Record<string, unknown>;
    }>;
}

export interface CreatePendingTransactionParams {
    chainId: number;
    to: string;
    data: string;
    value?: string;
    gasLimit?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    context: TransactionContext;
    ttlSeconds?: number;                   // Default: 15 minutes
}

// ============================================
// STORE IMPLEMENTATION
// ============================================

class PendingTransactionStore {
    private transactions: Map<string, PendingTransaction> = new Map();
    private cleanupInterval: NodeJS.Timeout | null = null;

    private readonly DEFAULT_TTL_SECONDS = 15 * 60; // 15 minutes
    private readonly CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute

    constructor() {
        // Start cleanup interval
        this.startCleanup();
    }

    /**
     * Create a new pending transaction
     * Returns the transaction ID for the signing URL
     */
    create(params: CreatePendingTransactionParams): PendingTransaction {
        const id = randomUUID();
        const now = new Date();
        const ttlMs = (params.ttlSeconds ?? this.DEFAULT_TTL_SECONDS) * 1000;

        const transaction: PendingTransaction = {
            id,
            createdAt: now,
            expiresAt: new Date(now.getTime() + ttlMs),
            status: 'pending',

            chainId: params.chainId,
            to: params.to,
            data: params.data,
            value: params.value ?? '0',
            gasLimit: params.gasLimit,
            maxFeePerGas: params.maxFeePerGas,
            maxPriorityFeePerGas: params.maxPriorityFeePerGas,

            context: params.context,

            stateHistory: [{
                status: 'pending',
                timestamp: now,
                metadata: { tool: params.context.tool }
            }]
        };

        this.transactions.set(id, transaction);

        console.log(`[PendingTx] Created ${id} for tool=${params.context.tool}`);

        return transaction;
    }

    /**
     * Get a pending transaction by ID
     */
    get(id: string): PendingTransaction | undefined {
        const tx = this.transactions.get(id);

        // Check if expired
        if (tx && tx.status === 'pending' && new Date() > tx.expiresAt) {
            this.updateStatus(id, 'expired');
            return this.transactions.get(id);
        }

        return tx;
    }

    /**
     * Update transaction status
     */
    updateStatus(
        id: string,
        status: TransactionStatus,
        metadata?: Record<string, unknown>
    ): PendingTransaction | undefined {
        const tx = this.transactions.get(id);
        if (!tx) return undefined;

        tx.status = status;
        tx.stateHistory.push({
            status,
            timestamp: new Date(),
            metadata
        });

        console.log(`[PendingTx] ${id} -> ${status}`);

        return tx;
    }

    /**
     * Mark as signed (after user signs in UI)
     */
    markSigned(id: string, signerAddress: string): PendingTransaction | undefined {
        const tx = this.get(id);
        if (!tx || tx.status !== 'pending') return undefined;

        tx.signerAddress = signerAddress;
        return this.updateStatus(id, 'signed', { signerAddress });
    }

    /**
     * Mark as broadcast (after tx sent to network)
     */
    markBroadcast(id: string, txHash: string): PendingTransaction | undefined {
        const tx = this.get(id);
        if (!tx || tx.status !== 'signed') return undefined;

        tx.txHash = txHash;
        return this.updateStatus(id, 'broadcast', { txHash });
    }

    /**
     * Mark as confirmed (after block inclusion)
     */
    markConfirmed(
        id: string,
        blockNumber: number,
        blockHash: string,
        gasUsed: string
    ): PendingTransaction | undefined {
        const tx = this.get(id);
        if (!tx || tx.status !== 'broadcast') return undefined;

        tx.blockNumber = blockNumber;
        tx.blockHash = blockHash;
        tx.gasUsed = gasUsed;
        return this.updateStatus(id, 'confirmed', { blockNumber, blockHash, gasUsed });
    }

    /**
     * Mark as failed
     */
    markFailed(id: string, errorMessage: string): PendingTransaction | undefined {
        const tx = this.get(id);
        if (!tx) return undefined;

        tx.errorMessage = errorMessage;
        return this.updateStatus(id, 'failed', { errorMessage });
    }

    /**
     * List all transactions for a session
     */
    listBySession(sessionId: string): PendingTransaction[] {
        return Array.from(this.transactions.values())
            .filter(tx => tx.context.sessionId === sessionId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    /**
     * List all transactions for an agent
     */
    listByAgent(agentId: string): PendingTransaction[] {
        return Array.from(this.transactions.values())
            .filter(tx => tx.context.agentId === agentId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    /**
     * Get recent transactions (for monitoring)
     */
    listRecent(limit: number = 50): PendingTransaction[] {
        return Array.from(this.transactions.values())
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, limit);
    }

    /**
     * Get statistics
     */
    getStats(): {
        total: number;
        byStatus: Record<TransactionStatus, number>;
        avgTimeToSign: number | null;
    } {
        const txs = Array.from(this.transactions.values());

        const byStatus: Record<TransactionStatus, number> = {
            pending: 0,
            signed: 0,
            broadcast: 0,
            confirmed: 0,
            failed: 0,
            expired: 0
        };

        let signedTimes: number[] = [];

        for (const tx of txs) {
            byStatus[tx.status] = (byStatus[tx.status] || 0) + 1;

            // Calculate time to sign
            if (tx.status !== 'pending' && tx.status !== 'expired') {
                const signedEntry = tx.stateHistory.find(s => s.status === 'signed');
                if (signedEntry) {
                    signedTimes.push(signedEntry.timestamp.getTime() - tx.createdAt.getTime());
                }
            }
        }

        return {
            total: txs.length,
            byStatus,
            avgTimeToSign: signedTimes.length > 0
                ? signedTimes.reduce((a, b) => a + b, 0) / signedTimes.length / 1000
                : null
        };
    }

    /**
     * Cleanup expired transactions (runs periodically)
     */
    private cleanup(): void {
        const now = new Date();
        let cleanedCount = 0;

        for (const [id, tx] of this.transactions.entries()) {
            if (tx.status === 'pending' && now > tx.expiresAt) {
                this.updateStatus(id, 'expired');
                cleanedCount++;
            }

            // Remove very old transactions (older than 24 hours)
            const ageMs = now.getTime() - tx.createdAt.getTime();
            if (ageMs > 24 * 60 * 60 * 1000) {
                this.transactions.delete(id);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            console.log(`[PendingTx] Cleaned ${cleanedCount} transactions`);
        }
    }

    private startCleanup(): void {
        if (this.cleanupInterval) return;
        this.cleanupInterval = setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL_MS);
    }

    /**
     * Stop cleanup (for testing/shutdown)
     */
    stopCleanup(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const pendingTransactionStore = new PendingTransactionStore();

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate signing URL for a pending transaction
 */
export function getSigningUrl(transactionId: string, baseUrl?: string): string {
    const base = baseUrl || process.env.RELAY_CORE_URL || 'http://localhost:4000';
    return `${base}/sign/${transactionId}`;
}

/**
 * Prepare a transaction and return signing URL (main interface for MCP tools)
 */
export function prepareTransactionForHandoff(
    params: CreatePendingTransactionParams,
    baseUrl?: string
): { transaction: PendingTransaction; signingUrl: string } {
    const transaction = pendingTransactionStore.create(params);
    const signingUrl = getSigningUrl(transaction.id, baseUrl);

    return { transaction, signingUrl };
}
