/**
 * Escrow Session Event Indexer
 * 
 * Indexes all EscrowSession contract events for real-time agentic flow tracking.
 * 
 * Events Indexed:
 * - SessionCreated: New escrow session created
 * - FundsDeposited: Funds deposited to session
 * - PaymentReleased: Agent received payment
 * - SessionRefunded: Funds refunded to owner
 * - SessionClosed: Session closed
 * - AgentAuthorized: Agent added to session
 * - AgentRevoked: Agent removed from session
 */

import schedule from 'node-schedule';
import logger from '../../../lib/logger.js';
import { INDEXER_CONFIG } from '../config/constants.js';
import * as cronos from '../repository/cronos.repository.js';
import * as db from '../repository/database.repository.js';

const INDEXER_NAME = 'escrow_session_events';

class EscrowSessionIndexer {
    private isRunning = false;
    private cronHandle: schedule.Job | null = null;

    /**
     * Execute indexer run - processes all escrow events in block range.
     */
    async run(): Promise<void> {
        if (this.isRunning) {
            logger.debug('Escrow session indexer already running');
            return;
        }

        this.isRunning = true;
        const startTime = Date.now();

        try {
            logger.info('Escrow session indexer started');

            // Get current state
            const state = await db.getIndexerState(INDEXER_NAME);
            const currentBlock = await cronos.getCurrentBlockNumber();

            let fromBlock: number;
            if (!state || state.lastBlock === 0) {
                // Start from escrow contract deployment block
                fromBlock = INDEXER_CONFIG.ESCROW_CONTRACT_DEPLOY_BLOCK || currentBlock - INDEXER_CONFIG.MAX_BLOCKS_PER_RUN;
            } else {
                fromBlock = state.lastBlock + 1;
            }

            const toBlock = Math.min(fromBlock + INDEXER_CONFIG.MAX_BLOCKS_PER_RUN, currentBlock);

            if (fromBlock > toBlock) {
                logger.debug('No new blocks to index');
                return;
            }

            logger.info('Indexing escrow events', { fromBlock, toBlock, range: toBlock - fromBlock });

            // Process each event type
            const results = {
                sessionsCreated: await this.processSessionCreatedEvents(fromBlock, toBlock),
                deposited: await this.processDepositEvents(fromBlock, toBlock),
                released: await this.processReleaseEvents(fromBlock, toBlock),
                refunded: await this.processRefundEvents(fromBlock, toBlock),
                closed: await this.processCloseEvents(fromBlock, toBlock),
                authorized: await this.processAuthorizationEvents(fromBlock, toBlock),
                revoked: await this.processRevocationEvents(fromBlock, toBlock)
            };

            // Update indexer state
            await db.updateIndexerState(INDEXER_NAME, toBlock);

            const duration = Date.now() - startTime;
            const totalEvents = Object.values(results).reduce((a, b) => a + b, 0);

            logger.info('Escrow session indexer completed', {
                ...results,
                totalEvents,
                durationMs: duration,
                blocksProcessed: toBlock - fromBlock + 1
            });

        } catch (error) {
            logger.error('Escrow session indexer error', error as Error);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Process SessionCreated events.
     */
    private async processSessionCreatedEvents(fromBlock: number, toBlock: number): Promise<number> {
        try {
            const events = await cronos.queryEscrowEvents('SessionCreated', fromBlock, toBlock);

            for (const event of events) {
                const block = await cronos.getBlock(event.blockNumber);
                const timestamp = block ? new Date(block.timestamp * 1000).toISOString() : new Date().toISOString();

                await db.insertEscrowSession({
                    sessionId: event.args[0].toString(),
                    owner: event.args[1],
                    escrowAgent: event.args[2],
                    maxSpend: event.args[3].toString(),
                    expiry: new Date(Number(event.args[4]) * 1000).toISOString(),
                    deposited: '0',
                    released: '0',
                    isActive: true,
                    createdAt: timestamp,
                    createdTxHash: event.transactionHash,
                    createdBlock: event.blockNumber
                });

                logger.debug('Indexed SessionCreated', {
                    sessionId: event.args[0].toString(),
                    owner: event.args[1]
                });
            }

            return events.length;
        } catch (error) {
            logger.error('Failed to process SessionCreated events', error as Error);
            return 0;
        }
    }

    /**
     * Process FundsDeposited events.
     */
    private async processDepositEvents(fromBlock: number, toBlock: number): Promise<number> {
        try {
            const events = await cronos.queryEscrowEvents('FundsDeposited', fromBlock, toBlock);

            for (const event of events) {
                const block = await cronos.getBlock(event.blockNumber);
                const timestamp = block ? new Date(block.timestamp * 1000).toISOString() : new Date().toISOString();

                await db.insertSessionEvent({
                    sessionId: event.args[0].toString(),
                    eventType: 'DEPOSIT',
                    actor: event.args[1],
                    amount: event.args[2].toString(),
                    timestamp,
                    txHash: event.transactionHash,
                    blockNumber: event.blockNumber
                });

                // Update session deposited amount
                await db.incrementSessionDeposited(
                    event.args[0].toString(),
                    event.args[2].toString()
                );

                logger.debug('Indexed FundsDeposited', {
                    sessionId: event.args[0].toString(),
                    amount: event.args[2].toString()
                });
            }

            return events.length;
        } catch (error) {
            logger.error('Failed to process FundsDeposited events', error as Error);
            return 0;
        }
    }

    /**
     * Process PaymentReleased events - critical for tracking agent earnings.
     */
    private async processReleaseEvents(fromBlock: number, toBlock: number): Promise<number> {
        try {
            const events = await cronos.queryEscrowEvents('PaymentReleased', fromBlock, toBlock);

            for (const event of events) {
                const block = await cronos.getBlock(event.blockNumber);
                const timestamp = block ? new Date(block.timestamp * 1000).toISOString() : new Date().toISOString();

                await db.insertSessionEvent({
                    sessionId: event.args[0].toString(),
                    eventType: 'RELEASE',
                    actor: event.args[1], // agent address
                    amount: event.args[2].toString(),
                    executionId: event.args[3], // bytes32 execution ID
                    timestamp,
                    txHash: event.transactionHash,
                    blockNumber: event.blockNumber
                });

                // Update session released amount
                await db.incrementSessionReleased(
                    event.args[0].toString(),
                    event.args[2].toString()
                );

                // Update agent earnings
                await db.incrementAgentEarnings(
                    event.args[1],
                    event.args[2].toString()
                );

                logger.debug('Indexed PaymentReleased', {
                    sessionId: event.args[0].toString(),
                    agent: event.args[1],
                    amount: event.args[2].toString()
                });
            }

            return events.length;
        } catch (error) {
            logger.error('Failed to process PaymentReleased events', error as Error);
            return 0;
        }
    }

    /**
     * Process SessionRefunded events.
     */
    private async processRefundEvents(fromBlock: number, toBlock: number): Promise<number> {
        try {
            const events = await cronos.queryEscrowEvents('SessionRefunded', fromBlock, toBlock);

            for (const event of events) {
                const block = await cronos.getBlock(event.blockNumber);
                const timestamp = block ? new Date(block.timestamp * 1000).toISOString() : new Date().toISOString();

                await db.insertSessionEvent({
                    sessionId: event.args[0].toString(),
                    eventType: 'REFUND',
                    actor: event.args[1], // owner address
                    amount: event.args[2].toString(),
                    timestamp,
                    txHash: event.transactionHash,
                    blockNumber: event.blockNumber
                });

                logger.debug('Indexed SessionRefunded', {
                    sessionId: event.args[0].toString(),
                    amount: event.args[2].toString()
                });
            }

            return events.length;
        } catch (error) {
            logger.error('Failed to process SessionRefunded events', error as Error);
            return 0;
        }
    }

    /**
     * Process SessionClosed events.
     */
    private async processCloseEvents(fromBlock: number, toBlock: number): Promise<number> {
        try {
            const events = await cronos.queryEscrowEvents('SessionClosed', fromBlock, toBlock);

            for (const event of events) {
                const block = await cronos.getBlock(event.blockNumber);
                const timestamp = block ? new Date(block.timestamp * 1000).toISOString() : new Date().toISOString();

                await db.updateSessionClosed(
                    event.args[0].toString(),
                    timestamp,
                    event.transactionHash,
                    event.blockNumber
                );

                await db.insertSessionEvent({
                    sessionId: event.args[0].toString(),
                    eventType: 'CLOSE',
                    timestamp,
                    txHash: event.transactionHash,
                    blockNumber: event.blockNumber
                });

                logger.debug('Indexed SessionClosed', {
                    sessionId: event.args[0].toString()
                });
            }

            return events.length;
        } catch (error) {
            logger.error('Failed to process SessionClosed events', error as Error);
            return 0;
        }
    }

    /**
     * Process AgentAuthorized events.
     */
    private async processAuthorizationEvents(fromBlock: number, toBlock: number): Promise<number> {
        try {
            const events = await cronos.queryEscrowEvents('AgentAuthorized', fromBlock, toBlock);

            for (const event of events) {
                const block = await cronos.getBlock(event.blockNumber);
                const timestamp = block ? new Date(block.timestamp * 1000).toISOString() : new Date().toISOString();

                await db.insertSessionAgent({
                    sessionId: event.args[0].toString(),
                    agentAddress: event.args[1],
                    isAuthorized: true,
                    authorizedAt: timestamp,
                    txHash: event.transactionHash,
                    blockNumber: event.blockNumber
                });

                await db.insertSessionEvent({
                    sessionId: event.args[0].toString(),
                    eventType: 'AUTHORIZE',
                    actor: event.args[1],
                    timestamp,
                    txHash: event.transactionHash,
                    blockNumber: event.blockNumber
                });

                logger.debug('Indexed AgentAuthorized', {
                    sessionId: event.args[0].toString(),
                    agent: event.args[1]
                });
            }

            return events.length;
        } catch (error) {
            logger.error('Failed to process AgentAuthorized events', error as Error);
            return 0;
        }
    }

    /**
     * Process AgentRevoked events.
     */
    private async processRevocationEvents(fromBlock: number, toBlock: number): Promise<number> {
        try {
            const events = await cronos.queryEscrowEvents('AgentRevoked', fromBlock, toBlock);

            for (const event of events) {
                const block = await cronos.getBlock(event.blockNumber);
                const timestamp = block ? new Date(block.timestamp * 1000).toISOString() : new Date().toISOString();

                await db.updateSessionAgentRevoked(
                    event.args[0].toString(),
                    event.args[1],
                    timestamp
                );

                await db.insertSessionEvent({
                    sessionId: event.args[0].toString(),
                    eventType: 'REVOKE',
                    actor: event.args[1],
                    timestamp,
                    txHash: event.transactionHash,
                    blockNumber: event.blockNumber
                });

                logger.debug('Indexed AgentRevoked', {
                    sessionId: event.args[0].toString(),
                    agent: event.args[1]
                });
            }

            return events.length;
        } catch (error) {
            logger.error('Failed to process AgentRevoked events', error as Error);
            return 0;
        }
    }

    /**
     * Start scheduled indexer.
     */
    start(): schedule.Job {
        this.cronHandle = schedule.scheduleJob(INDEXER_CONFIG.CRON_ESCROW_INDEXER, async () => {
            await this.run();
        });
        logger.info('Escrow session indexer scheduled', { cron: INDEXER_CONFIG.CRON_ESCROW_INDEXER });
        return this.cronHandle;
    }

    /**
     * Stop scheduled indexer.
     */
    stop(): void {
        if (this.cronHandle) {
            this.cronHandle.cancel();
            this.cronHandle = null;
            logger.info('Escrow session indexer stopped');
        }
    }
}

export const escrowSessionIndexer = new EscrowSessionIndexer();
