/**
 * USDC Transfer Indexer
 *
 * Indexes all USDC transfers to/from the Relay wallet for explorer visibility.
 * Scans Transfer events from the USDC contract and records them in on_chain_transactions.
 *
 * This ensures all x402/EIP-3009 payments appear in the explorer even if they
 * were settled by the Facilitator (which doesn't go through our API).
 */

import schedule from 'node-schedule';
import { ethers } from 'ethers';
import logger from '../../../lib/logger.js';
import { INDEXER_CONFIG } from '../config/constants.js';
import { supabase } from '../../../lib/supabase.js';

const INDEXER_NAME = 'usdc_transfer_indexer';

// USDC contract addresses
const USDC_ADDRESSES = {
    testnet: '0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0',
    mainnet: '0xf951eC28187D9E5Ca673Da8FE6757E6f0Be5F77C'
};

// RPC URLs
const RPC_URLS = {
    testnet: 'https://evm-t3.cronos.org',
    mainnet: 'https://evm.cronos.org'
};

// Transfer event signature
const TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');

// EIP-3009 TransferWithAuthorization event
const TRANSFER_WITH_AUTH_TOPIC = ethers.id('TransferWithAuthorization(address,address,uint256,uint256,uint256,bytes32)');

class USDCTransferIndexer {
    private isRunning = false;
    private cronHandle: schedule.Job | null = null;
    private network: 'testnet' | 'mainnet';
    private provider: ethers.JsonRpcProvider;
    private usdcAddress: string;
    private relayWalletAddress: string;
    private lastIndexedBlock: number = 0;

    constructor() {
        this.network = (process.env.CRONOS_NETWORK === 'cronos-mainnet' ? 'mainnet' : 'testnet');
        this.provider = new ethers.JsonRpcProvider(RPC_URLS[this.network]);
        this.usdcAddress = USDC_ADDRESSES[this.network];
        this.relayWalletAddress = process.env.RELAY_WALLET_ADDRESS || process.env.PAYMENT_RECIPIENT_ADDRESS || '';

        logger.info('USDC Transfer Indexer initialized', {
            network: this.network,
            usdcAddress: this.usdcAddress,
            relayWallet: this.relayWalletAddress
        });
    }

    /**
     * Get last indexed block from database
     */
    private async getLastIndexedBlock(): Promise<number> {
        try {
            const { data } = await supabase
                .from('indexer_state')
                .select('last_block')
                .eq('indexer_name', INDEXER_NAME)
                .single();

            return data?.last_block || 0;
        } catch {
            return 0;
        }
    }

    /**
     * Update last indexed block in database
     */
    private async updateLastIndexedBlock(blockNumber: number): Promise<void> {
        try {
            await supabase
                .from('indexer_state')
                .upsert({
                    indexer_name: INDEXER_NAME,
                    last_block: blockNumber,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'indexer_name' });
        } catch (error) {
            logger.warn('Failed to update indexer state', { error });
        }
    }

    /**
     * Execute indexer run - scans for USDC transfers
     */
    async run(): Promise<void> {
        if (this.isRunning) {
            logger.debug('USDC transfer indexer already running');
            return;
        }

        if (!this.relayWalletAddress) {
            logger.warn('RELAY_WALLET_ADDRESS not configured, skipping USDC indexer');
            return;
        }

        this.isRunning = true;
        const startTime = Date.now();

        try {
            // Get current block
            const currentBlock = await this.provider.getBlockNumber();

            // Get last indexed block
            const lastBlock = await this.getLastIndexedBlock();
            const fromBlock = lastBlock > 0 ? lastBlock + 1 : currentBlock - 1000; // Start from last 1000 blocks if fresh

            // Don't index if already up to date
            if (fromBlock >= currentBlock) {
                logger.debug('USDC indexer up to date', { currentBlock });
                return;
            }

            // Limit batch size to avoid RPC timeout
            const toBlock = Math.min(fromBlock + INDEXER_CONFIG.BATCH_SIZE * 10, currentBlock);

            logger.info('Indexing USDC transfers', {
                fromBlock,
                toBlock,
                relayWallet: this.relayWalletAddress
            });

            // Fetch Transfer logs where Relay is sender or recipient
            const relayAddressPadded = ethers.zeroPadValue(this.relayWalletAddress.toLowerCase(), 32);

            // Transfers FROM Relay (refunds, agent payments)
            const outgoingLogs = await this.provider.getLogs({
                address: this.usdcAddress,
                topics: [TRANSFER_TOPIC, relayAddressPadded, null],
                fromBlock,
                toBlock
            });

            // Transfers TO Relay (session deposits)
            const incomingLogs = await this.provider.getLogs({
                address: this.usdcAddress,
                topics: [TRANSFER_TOPIC, null, relayAddressPadded],
                fromBlock,
                toBlock
            });

            // Also check for TransferWithAuthorization (x402/EIP-3009)
            const x402OutgoingLogs = await this.provider.getLogs({
                address: this.usdcAddress,
                topics: [TRANSFER_WITH_AUTH_TOPIC, relayAddressPadded, null],
                fromBlock,
                toBlock
            });

            const x402IncomingLogs = await this.provider.getLogs({
                address: this.usdcAddress,
                topics: [TRANSFER_WITH_AUTH_TOPIC, null, relayAddressPadded],
                fromBlock,
                toBlock
            });

            const allLogs = [...outgoingLogs, ...incomingLogs, ...x402OutgoingLogs, ...x402IncomingLogs];

            logger.info('Found USDC transfer logs', {
                outgoing: outgoingLogs.length,
                incoming: incomingLogs.length,
                x402Outgoing: x402OutgoingLogs.length,
                x402Incoming: x402IncomingLogs.length,
                total: allLogs.length
            });

            // Process each log
            let indexed = 0;
            for (const log of allLogs) {
                try {
                    await this.processTransferLog(log);
                    indexed++;
                } catch (error) {
                    logger.warn('Failed to process transfer log', {
                        txHash: log.transactionHash,
                        error: error instanceof Error ? error.message : 'Unknown'
                    });
                }
            }

            // Update last indexed block
            await this.updateLastIndexedBlock(toBlock);

            const duration = Date.now() - startTime;
            logger.info('USDC transfer indexer completed', {
                indexed,
                fromBlock,
                toBlock,
                durationMs: duration
            });

        } catch (error) {
            logger.error('USDC transfer indexer error', error as Error);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Process a single Transfer log
     */
    private async processTransferLog(log: ethers.Log): Promise<void> {
        // Decode Transfer event
        const from = ethers.getAddress('0x' + log.topics[1].slice(26));
        const to = ethers.getAddress('0x' + log.topics[2].slice(26));
        const amount = ethers.formatUnits(BigInt(log.data), 6);

        // Get block for timestamp
        const block = await this.provider.getBlock(log.blockNumber);
        const timestamp = block ? new Date(block.timestamp * 1000).toISOString() : new Date().toISOString();

        // Determine transaction type
        let type = 'usdc_transfer';
        const isX402 = log.topics[0] === TRANSFER_WITH_AUTH_TOPIC;
        const isFromRelay = from.toLowerCase() === this.relayWalletAddress.toLowerCase();
        const isToRelay = to.toLowerCase() === this.relayWalletAddress.toLowerCase();

        if (isX402) {
            type = isFromRelay ? 'x402_outgoing' : 'x402_incoming';
        } else if (isFromRelay) {
            type = 'relay_outgoing';
        } else if (isToRelay) {
            type = 'relay_incoming';
        }

        // Check if already exists
        const { data: existing } = await supabase
            .from('on_chain_transactions')
            .select('id')
            .eq('tx_hash', log.transactionHash)
            .single();

        if (existing) {
            logger.debug('Transaction already indexed', { txHash: log.transactionHash });
            return;
        }

        // Insert into on_chain_transactions
        const { error } = await supabase.from('on_chain_transactions').insert({
            tx_hash: log.transactionHash,
            from_address: from.toLowerCase(),
            to_address: to.toLowerCase(),
            value: amount,
            type,
            status: 'success',
            timestamp,
            block_number: log.blockNumber,
            block_hash: log.blockHash,
            log_index: log.index,
            gas_used: '0', // Would need full tx receipt
            metadata: {
                isX402,
                usdcContract: this.usdcAddress,
                network: this.network,
                indexedBy: INDEXER_NAME
            }
        });

        if (error) {
            logger.warn('Failed to insert transaction', { txHash: log.transactionHash, error });
        } else {
            logger.debug('Indexed USDC transfer', {
                txHash: log.transactionHash,
                type,
                from,
                to,
                amount,
                isX402
            });
        }

        // Also update payments table if this matches a pending payment
        if (isFromRelay) {
            await supabase
                .from('payments')
                .update({ tx_hash: log.transactionHash, status: 'settled' })
                .eq('to_address', to.toLowerCase())
                .eq('amount', amount)
                .is('tx_hash', null);
        }

        // Update session_payments if this is an agent payment
        if (isFromRelay) {
            await supabase
                .from('session_payments')
                .update({ tx_hash: log.transactionHash, facilitator_tx_hash: log.transactionHash })
                .eq('agent_address', to.toLowerCase())
                .eq('amount', amount)
                .is('tx_hash', null);
        }
    }

    /**
     * Start scheduled indexer
     */
    start(): schedule.Job {
        // Run every 30 seconds
        const cronSchedule = '*/30 * * * * *';
        this.cronHandle = schedule.scheduleJob(cronSchedule, async () => {
            await this.run();
        });
        logger.info('USDC transfer indexer scheduled', { cron: cronSchedule });

        // Run immediately on start
        this.run().catch(err => logger.error('Initial USDC indexer run failed', err as Error));

        return this.cronHandle;
    }

    /**
     * Stop scheduled indexer
     */
    stop(): void {
        if (this.cronHandle) {
            this.cronHandle.cancel();
            this.cronHandle = null;
            logger.info('USDC transfer indexer stopped');
        }
    }
}

export const usdcTransferIndexer = new USDCTransferIndexer();
