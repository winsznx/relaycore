/**
 * Feedback Event Indexer
 * 
 * Indexes feedback submission events from the ReputationRegistry contract.
 * Tracks all on-chain feedback for reputation calculations.
 */

import schedule from 'node-schedule';
import logger from '../../../lib/logger.js';
import { INDEXER_CONFIG } from '../config/constants.js';
import * as cronos from '../repository/cronos.repository.js';
import * as db from '../repository/database.repository.js';

const INDEXER_NAME = 'feedback_events';

class FeedbackIndexer {
    private isRunning = false;
    private cronHandle: schedule.Job | null = null;

    /**
     * Execute indexer run.
     */
    async run(): Promise<void> {
        if (this.isRunning) {
            logger.debug('Feedback indexer already running');
            return;
        }

        this.isRunning = true;
        const startTime = Date.now();

        try {
            logger.info('Feedback indexer started');

            const state = await db.getIndexerState(INDEXER_NAME);
            const currentBlock = await cronos.getCurrentBlockNumber();
            const fromBlock = state?.lastBlock || currentBlock - 10000;
            const toBlock = Math.min(fromBlock + INDEXER_CONFIG.MAX_BLOCKS_PER_RUN, currentBlock);

            if (fromBlock >= toBlock) {
                logger.debug('No new blocks to index');
                return;
            }

            logger.info('Scanning blocks for feedback events', { fromBlock, toBlock });

            const events = await cronos.queryFeedbackEvents(fromBlock, toBlock);

            if (events.length === 0) {
                logger.debug('No feedback events found');
                await db.updateIndexerState(INDEXER_NAME, toBlock);
                return;
            }

            logger.info('Processing feedback events', { count: events.length });

            let indexed = 0;
            let failed = 0;

            for (const event of events) {
                try {
                    const subject = event.args[0] as string;
                    const submitter = event.args[1] as string;
                    const tag = event.args[2] as string;
                    const score = Number(event.args[3]);
                    const comment = event.args[4] as string;

                    const block = await cronos.getBlock(event.blockNumber);
                    const timestamp = block
                        ? new Date(block.timestamp * 1000).toISOString()
                        : new Date().toISOString();

                    await db.insertFeedbackEvent({
                        subjectAddress: subject,
                        submitterAddress: submitter,
                        tag,
                        score,
                        comment,
                        txHash: event.transactionHash,
                        blockNumber: event.blockNumber,
                        timestamp
                    });

                    indexed++;
                    logger.debug('Indexed feedback', { subject, tag, score });
                } catch (error) {
                    failed++;
                    logger.error('Failed to index feedback event', error as Error, {
                        txHash: event.transactionHash
                    });
                }
            }

            await db.updateIndexerState(INDEXER_NAME, toBlock);

            const duration = Date.now() - startTime;
            logger.info('Feedback indexer completed', { indexed, failed, durationMs: duration });
        } catch (error) {
            logger.error('Feedback indexer error', error as Error);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Start scheduled indexer.
     */
    start(): schedule.Job {
        this.cronHandle = schedule.scheduleJob(INDEXER_CONFIG.CRON_AGENT_INDEXER, async () => {
            await this.run();
        });
        logger.info('Feedback indexer scheduled', { cron: INDEXER_CONFIG.CRON_AGENT_INDEXER });
        return this.cronHandle;
    }

    /**
     * Stop scheduled indexer.
     */
    stop(): void {
        if (this.cronHandle) {
            this.cronHandle.cancel();
            this.cronHandle = null;
            logger.info('Feedback indexer stopped');
        }
    }
}

export const feedbackIndexer = new FeedbackIndexer();
