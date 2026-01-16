/**
 * Reputation Calculator
 * 
 * Calculates and updates agent reputation scores based on feedback events,
 * payment history, and transaction outcomes.
 */

import schedule from 'node-schedule';
import logger from '../../../lib/logger.js';
import { INDEXER_CONFIG } from '../config/constants.js';
import * as cronos from '../repository/cronos.repository.js';
import * as db from '../repository/database.repository.js';

const INDEXER_NAME = 'reputation_calculator';
const TIME_DECAY_FACTOR = 0.95;
const DAYS_FOR_FULL_DECAY = 90;

class ReputationCalculator {
    private isRunning = false;
    private cronHandle: schedule.Job | null = null;

    /**
     * Calculate time-weighted decay factor.
     */
    private calculateDecayFactor(daysSinceEvent: number): number {
        if (daysSinceEvent <= 0) return 1;
        if (daysSinceEvent >= DAYS_FOR_FULL_DECAY) return 0.1;
        return Math.pow(TIME_DECAY_FACTOR, daysSinceEvent / 7);
    }

    /**
     * Execute reputation calculation.
     */
    async run(): Promise<void> {
        if (this.isRunning) {
            logger.debug('Reputation calculator already running');
            return;
        }

        this.isRunning = true;
        const startTime = Date.now();

        try {
            logger.info('Reputation calculator started');

            const addresses = await db.getAllAgentAddresses();

            if (addresses.length === 0) {
                logger.debug('No agents to calculate reputation for');
                return;
            }

            logger.info('Calculating reputation for agents', { count: addresses.length });

            let calculated = 0;
            let failed = 0;

            for (const address of addresses) {
                try {
                    const paymentStats = await db.getPaymentStats(address);

                    let onChainScore = 50;
                    try {
                        onChainScore = await cronos.getReputationScore(address);
                    } catch {
                        // Use default if on-chain call fails
                    }

                    const total = paymentStats.successCount + paymentStats.failCount;
                    const successRate = total > 0 ? paymentStats.successCount / total : 0.5;

                    const combinedScore = Math.round(
                        (onChainScore * 0.6) + (successRate * 100 * 0.4)
                    );

                    const finalScore = Math.max(0, Math.min(100, combinedScore));

                    await db.upsertReputation({
                        agentAddress: address,
                        tag: 'overall',
                        score: finalScore,
                        feedbackCount: paymentStats.successCount + paymentStats.failCount,
                        successfulTransactions: paymentStats.successCount,
                        failedTransactions: paymentStats.failCount
                    });

                    calculated++;
                    logger.debug('Calculated reputation', { address, score: finalScore });
                } catch (error) {
                    failed++;
                    logger.error('Failed to calculate reputation', error as Error, { address });
                }
            }

            await db.updateIndexerState(INDEXER_NAME, Date.now());

            const duration = Date.now() - startTime;
            logger.info('Reputation calculator completed', { calculated, failed, durationMs: duration });
        } catch (error) {
            logger.error('Reputation calculator error', error as Error);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Start scheduled calculator.
     */
    start(): schedule.Job {
        this.cronHandle = schedule.scheduleJob(INDEXER_CONFIG.CRON_REPUTATION_CALC, async () => {
            await this.run();
        });
        logger.info('Reputation calculator scheduled', { cron: INDEXER_CONFIG.CRON_REPUTATION_CALC });
        return this.cronHandle;
    }

    /**
     * Stop scheduled calculator.
     */
    stop(): void {
        if (this.cronHandle) {
            this.cronHandle.cancel();
            this.cronHandle = null;
            logger.info('Reputation calculator stopped');
        }
    }
}

export const reputationCalculator = new ReputationCalculator();
