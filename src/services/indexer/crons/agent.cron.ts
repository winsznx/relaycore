/**
 * Agent Registry Indexer
 * 
 * Indexes agent registration events from the IdentityRegistry contract.
 * Tracks agent lifecycle: registration, deactivation, reactivation.
 */

import schedule from 'node-schedule';
import logger from '../../../lib/logger.js';
import { INDEXER_CONFIG } from '../config/constants.js';
import * as cronos from '../repository/cronos.repository.js';
import * as db from '../repository/database.repository.js';

const INDEXER_NAME = 'agent_registry';

class AgentIndexer {
    private isRunning = false;
    private cronHandle: schedule.Job | null = null;

    /**
     * Execute indexer run.
     */
    async run(): Promise<void> {
        if (this.isRunning) {
            logger.debug('Agent indexer already running');
            return;
        }

        this.isRunning = true;
        const startTime = Date.now();

        try {
            logger.info('Agent indexer started');

            const state = await db.getIndexerState(INDEXER_NAME);
            const currentBlock = await cronos.getCurrentBlockNumber();
            const fromBlock = state?.lastBlock || currentBlock - 10000;
            const toBlock = Math.min(fromBlock + INDEXER_CONFIG.MAX_BLOCKS_PER_RUN, currentBlock);

            if (fromBlock >= toBlock) {
                logger.debug('No new blocks to index');
                return;
            }

            logger.info('Scanning blocks for agent events', { fromBlock, toBlock });

            const events = await cronos.queryAgentRegisteredEvents(fromBlock, toBlock);

            if (events.length === 0) {
                logger.debug('No agent registration events found');
                await db.updateIndexerState(INDEXER_NAME, toBlock);
                return;
            }

            logger.info('Processing agent events', { count: events.length });

            let indexed = 0;
            let failed = 0;

            for (const event of events) {
                try {
                    const agentId = Number(event.args[0]);
                    const owner = event.args[1] as string;
                    const agentURI = event.args[2] as string;

                    const block = await cronos.getBlock(event.blockNumber);
                    const timestamp = block
                        ? new Date(block.timestamp * 1000).toISOString()
                        : new Date().toISOString();

                    await db.upsertAgent({
                        agentId,
                        ownerAddress: owner,
                        agentURI,
                        isActive: true,
                        registeredAt: timestamp,
                        registrationTxHash: event.transactionHash,
                        registrationBlock: event.blockNumber
                    });

                    indexed++;
                    logger.debug('Indexed agent', { agentId, owner });
                } catch (error) {
                    failed++;
                    logger.error('Failed to index agent event', error as Error, {
                        txHash: event.transactionHash
                    });
                }
            }

            await db.updateIndexerState(INDEXER_NAME, toBlock);

            const duration = Date.now() - startTime;
            logger.info('Agent indexer completed', { indexed, failed, durationMs: duration });
        } catch (error) {
            logger.error('Agent indexer error', error as Error);
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
        logger.info('Agent indexer scheduled', { cron: INDEXER_CONFIG.CRON_AGENT_INDEXER });
        return this.cronHandle;
    }

    /**
     * Stop scheduled indexer.
     */
    stop(): void {
        if (this.cronHandle) {
            this.cronHandle.cancel();
            this.cronHandle = null;
            logger.info('Agent indexer stopped');
        }
    }
}

export const agentIndexer = new AgentIndexer();
