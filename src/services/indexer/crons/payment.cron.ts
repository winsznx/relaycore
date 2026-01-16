/**
 * Payment Event Indexer
 * 
 * Indexes x402 payment transactions from the Cronos blockchain.
 * Enriches payment records with block confirmations and timestamps.
 */

import schedule from 'node-schedule';
import logger from '../../../lib/logger.js';
import { INDEXER_CONFIG } from '../config/constants.js';
import * as cronos from '../repository/cronos.repository.js';
import * as db from '../repository/database.repository.js';

const INDEXER_NAME = 'payment_events';

class PaymentIndexer {
    private isRunning = false;
    private cronHandle: schedule.Job | null = null;

    /**
     * Execute indexer run.
     */
    async run(): Promise<void> {
        if (this.isRunning) {
            logger.debug('Payment indexer already running');
            return;
        }

        this.isRunning = true;
        const startTime = Date.now();

        try {
            logger.info('Payment indexer started');

            const payments = await db.getUnindexedPayments(INDEXER_CONFIG.BATCH_SIZE);

            if (payments.length === 0) {
                logger.debug('No unindexed payments found');
                return;
            }

            logger.info('Processing payments', { count: payments.length });

            let indexed = 0;
            let failed = 0;

            for (const payment of payments) {
                try {
                    const tx = await cronos.getTransaction(payment.tx_hash);

                    if (tx && tx.blockNumber) {
                        await db.updatePaymentBlockNumber(payment.payment_id, tx.blockNumber);
                        indexed++;
                        logger.debug('Indexed payment', {
                            paymentId: payment.payment_id,
                            block: tx.blockNumber
                        });
                    }
                } catch (error) {
                    failed++;
                    logger.error('Failed to index payment', error as Error, {
                        paymentId: payment.payment_id
                    });
                }
            }

            const duration = Date.now() - startTime;
            logger.info('Payment indexer completed', { indexed, failed, durationMs: duration });
        } catch (error) {
            logger.error('Payment indexer error', error as Error);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Start scheduled indexer.
     */
    start(): schedule.Job {
        this.cronHandle = schedule.scheduleJob(INDEXER_CONFIG.CRON_PAYMENT_INDEXER, async () => {
            await this.run();
        });
        logger.info('Payment indexer scheduled', { cron: INDEXER_CONFIG.CRON_PAYMENT_INDEXER });
        return this.cronHandle;
    }

    /**
     * Stop scheduled indexer.
     */
    stop(): void {
        if (this.cronHandle) {
            this.cronHandle.cancel();
            this.cronHandle = null;
            logger.info('Payment indexer stopped');
        }
    }
}

export const paymentIndexer = new PaymentIndexer();
