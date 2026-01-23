/**
 * Transaction Indexer
 * 
 * Indexes all on-chain transactions from the handoff signing flow.
 * Tracks the complete lifecycle: pending -> signed -> broadcast -> confirmed/failed
 * 
 * Based on Luganodes/Solana-Indexer transaction tracking patterns:
 * - Fetches transaction details from chain
 * - Enriches with gas usage, status, timestamps
 * - Correlates with MCP tool invocations
 * - Updates agent execution records
 */

import schedule from 'node-schedule';
import logger from '../../../lib/logger.js';
import { INDEXER_CONFIG } from '../config/constants.js';
import * as cronos from '../repository/cronos.repository.js';
import * as db from '../repository/database.repository.js';

const INDEXER_NAME = 'transaction_indexer';

// Transaction states that need indexing
const INDEXABLE_STATES = ['broadcast', 'pending'];

class TransactionIndexer {
    private isRunning = false;
    private cronHandle: schedule.Job | null = null;

    /**
     * Execute indexer run - processes pending/broadcast transactions.
     */
    async run(): Promise<void> {
        if (this.isRunning) {
            logger.debug('Transaction indexer already running');
            return;
        }

        this.isRunning = true;
        const startTime = Date.now();

        try {
            logger.info('Transaction indexer started');

            // Get transactions that need chain validation
            const pendingTxs = await db.getTransactionsToIndex(INDEXER_CONFIG.BATCH_SIZE);

            if (pendingTxs.length === 0) {
                logger.debug('No transactions to index');
                return;
            }

            logger.info('Processing transactions', { count: pendingTxs.length });

            let confirmed = 0;
            let failed = 0;
            let pending = 0;
            let expired = 0;

            for (const tx of pendingTxs) {
                try {
                    const result = await this.processTransaction(tx);
                    switch (result) {
                        case 'confirmed': confirmed++; break;
                        case 'failed': failed++; break;
                        case 'pending': pending++; break;
                        case 'expired': expired++; break;
                    }
                } catch (error) {
                    logger.error('Failed to process transaction', error as Error, {
                        transactionId: tx.transaction_id
                    });
                    failed++;
                }
            }

            const duration = Date.now() - startTime;
            logger.info('Transaction indexer completed', {
                confirmed,
                failed,
                pending,
                expired,
                total: pendingTxs.length,
                durationMs: duration
            });
        } catch (error) {
            logger.error('Transaction indexer error', error as Error);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Process a single transaction.
     */
    private async processTransaction(tx: {
        transaction_id: string;
        tx_hash: string | null;
        status: string;
        chain_id: number;
        expires_at: string;
        tool: string;
        session_id: string | null;
        agent_id: string | null;
    }): Promise<'confirmed' | 'failed' | 'pending' | 'expired'> {

        // Check if expired
        if (new Date(tx.expires_at) < new Date() && tx.status === 'pending') {
            await db.updateTransactionStatus(tx.transaction_id, 'expired', {
                error_message: 'Transaction expired without signature'
            });

            // Record state change
            await db.insertTransactionStateChange(tx.transaction_id, 'expired', {
                reason: 'timeout',
                expiresAt: tx.expires_at
            });

            return 'expired';
        }

        // If no tx_hash yet, nothing to check on-chain
        if (!tx.tx_hash) {
            return 'pending';
        }

        // Get network from chain ID
        const network = this.getNetworkFromChainId(tx.chain_id);
        if (!network) {
            logger.error('Unknown chain ID', undefined, { chainId: tx.chain_id });
            return 'failed';
        }

        // Fetch transaction receipt from chain
        const receipt = await cronos.getTransactionReceipt(tx.tx_hash);

        if (!receipt) {
            // Transaction not yet mined
            return 'pending';
        }

        // Get block for timestamp
        const block = await cronos.getBlock(receipt.blockNumber);
        const timestamp = block ? new Date(block.timestamp * 1000).toISOString() : new Date().toISOString();

        if (receipt.status === 1) {
            // Success
            await db.updateTransactionStatus(tx.transaction_id, 'confirmed', {
                block_number: receipt.blockNumber,
                block_hash: receipt.blockHash,
                gas_used: receipt.gasUsed.toString(),
                confirmed_at: timestamp
            });

            // Record state change
            await db.insertTransactionStateChange(tx.transaction_id, 'confirmed', {
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString(),
                effectiveGasPrice: receipt.gasPrice?.toString()
            });

            // If this was an escrow payment release, update agent earnings
            if (tx.tool.includes('escrow') && tx.tool.includes('release') && tx.agent_id) {
                await this.processEscrowRelease(tx, receipt);
            }

            // Index as on-chain transaction record
            await db.upsertOnChainTransaction({
                txHash: tx.tx_hash,
                chainId: tx.chain_id,
                blockNumber: receipt.blockNumber,
                blockHash: receipt.blockHash,
                from: receipt.from,
                to: receipt.to || '',
                value: '0', // Would need original tx data
                gasUsed: receipt.gasUsed.toString(),
                gasPrice: receipt.gasPrice?.toString() || '0',
                status: 'success',
                timestamp,
                tool: tx.tool,
                sessionId: tx.session_id,
                agentId: tx.agent_id,
                pendingTxId: tx.transaction_id
            });

            logger.debug('Transaction confirmed', {
                transactionId: tx.transaction_id,
                txHash: tx.tx_hash,
                block: receipt.blockNumber
            });

            return 'confirmed';

        } else {
            // Transaction reverted
            await db.updateTransactionStatus(tx.transaction_id, 'failed', {
                block_number: receipt.blockNumber,
                error_message: 'Transaction reverted on-chain'
            });

            // Record state change
            await db.insertTransactionStateChange(tx.transaction_id, 'failed', {
                blockNumber: receipt.blockNumber,
                reason: 'reverted',
                gasUsed: receipt.gasUsed.toString()
            });

            // Index as failed transaction
            await db.upsertOnChainTransaction({
                txHash: tx.tx_hash,
                chainId: tx.chain_id,
                blockNumber: receipt.blockNumber,
                blockHash: receipt.blockHash,
                from: receipt.from,
                to: receipt.to || '',
                value: '0',
                gasUsed: receipt.gasUsed.toString(),
                gasPrice: receipt.gasPrice?.toString() || '0',
                status: 'failed',
                timestamp,
                tool: tx.tool,
                sessionId: tx.session_id,
                agentId: tx.agent_id,
                pendingTxId: tx.transaction_id
            });

            logger.debug('Transaction failed', {
                transactionId: tx.transaction_id,
                txHash: tx.tx_hash,
                block: receipt.blockNumber
            });

            return 'failed';
        }
    }

    /**
     * Process escrow payment release for agent earnings tracking.
     */
    private async processEscrowRelease(tx: {
        transaction_id: string;
        session_id: string | null;
        agent_id: string | null;
    }, receipt: {
        logs: readonly { topics: readonly string[]; data: string }[];
    }): Promise<void> {
        try {
            // PaymentReleased event topic
            const paymentReleasedTopic = '0x' + 'PaymentReleased(uint256,address,uint256,bytes32)'
                .split('')
                .reduce((acc, char) => acc + char.charCodeAt(0).toString(16), '')
                .substring(0, 64);

            // Find PaymentReleased event in logs
            for (const log of receipt.logs) {
                // In production, properly decode the event
                if (tx.agent_id) {
                    // Would decode amount from log.data
                    logger.debug('Processing escrow release for agent', {
                        agentId: tx.agent_id,
                        sessionId: tx.session_id
                    });
                }
            }
        } catch (error) {
            logger.error('Failed to process escrow release', error as Error);
        }
    }

    /**
     * Get network name from chain ID.
     */
    private getNetworkFromChainId(chainId: number): 'mainnet' | 'testnet' | 'zkevm-mainnet' | 'zkevm-testnet' | null {
        switch (chainId) {
            case 25: return 'mainnet';
            case 338: return 'testnet';
            case 388: return 'zkevm-mainnet';
            case 240: return 'zkevm-testnet';
            default: return null;
        }
    }

    /**
     * Start scheduled indexer.
     */
    start(): schedule.Job {
        this.cronHandle = schedule.scheduleJob(INDEXER_CONFIG.CRON_HANDOFF_INDEXER, async () => {
            await this.run();
        });
        logger.info('Transaction indexer scheduled', { cron: INDEXER_CONFIG.CRON_HANDOFF_INDEXER });
        return this.cronHandle;
    }

    /**
     * Stop scheduled indexer.
     */
    stop(): void {
        if (this.cronHandle) {
            this.cronHandle.cancel();
            this.cronHandle = null;
            logger.info('Transaction indexer stopped');
        }
    }
}

export const transactionIndexer = new TransactionIndexer();
