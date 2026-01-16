/**
 * Repository Layer for Supabase Database Operations
 */

import { supabase } from '../../../lib/supabase.js';
import logger from '../../../lib/logger.js';

/**
 * Indexer state management.
 */
export async function getIndexerState(indexerName: string): Promise<{
    lastBlock: number;
    lastRunAt: string | null;
} | null> {
    try {
        const { data, error } = await supabase
            .from('indexer_state')
            .select('last_block, last_run_at')
            .eq('indexer_name', indexerName)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw new Error(error.message);
        }

        return data ? { lastBlock: data.last_block, lastRunAt: data.last_run_at } : null;
    } catch (error) {
        logger.error('Failed to get indexer state', error as Error, { indexerName });
        throw error;
    }
}

export async function updateIndexerState(
    indexerName: string,
    lastBlock: number
): Promise<void> {
    try {
        const { error } = await supabase
            .from('indexer_state')
            .upsert({
                indexer_name: indexerName,
                last_block: lastBlock,
                last_run_at: new Date().toISOString()
            }, { onConflict: 'indexer_name' });

        if (error) {
            throw new Error(error.message);
        }
    } catch (error) {
        logger.error('Failed to update indexer state', error as Error, { indexerName, lastBlock });
        throw error;
    }
}

/**
 * Payment records.
 */
export async function getUnindexedPayments(limit: number = 100): Promise<Array<{
    id: string;
    payment_id: string;
    tx_hash: string;
    from_address: string;
    to_address: string;
    amount: string;
    status: string;
}>> {
    try {
        const { data, error } = await supabase
            .from('payments')
            .select('id, payment_id, tx_hash, from_address, to_address, amount, status')
            .eq('block_number', 0)
            .eq('status', 'settled')
            .limit(limit);

        if (error) {
            throw new Error(error.message);
        }

        return data || [];
    } catch (error) {
        logger.error('Failed to get unindexed payments', error as Error);
        throw error;
    }
}

export async function updatePaymentBlockNumber(
    paymentId: string,
    blockNumber: number
): Promise<void> {
    try {
        const { error } = await supabase
            .from('payments')
            .update({ block_number: blockNumber })
            .eq('payment_id', paymentId);

        if (error) {
            throw new Error(error.message);
        }
    } catch (error) {
        logger.error('Failed to update payment block number', error as Error, { paymentId });
        throw error;
    }
}

/**
 * Agent records.
 */
export async function upsertAgent(agent: {
    agentId: number;
    ownerAddress: string;
    agentURI: string;
    isActive: boolean;
    registeredAt: string;
    registrationTxHash: string;
    registrationBlock: number;
}): Promise<void> {
    try {
        const { error } = await supabase
            .from('agents')
            .upsert({
                agent_id: agent.agentId,
                owner_address: agent.ownerAddress,
                agent_uri: agent.agentURI,
                is_active: agent.isActive,
                registered_at: agent.registeredAt,
                registration_tx_hash: agent.registrationTxHash,
                registration_block: agent.registrationBlock,
                updated_at: new Date().toISOString()
            }, { onConflict: 'agent_id' });

        if (error) {
            throw new Error(error.message);
        }
    } catch (error) {
        logger.error('Failed to upsert agent', error as Error, { agentId: agent.agentId });
        throw error;
    }
}

export async function updateAgentStatus(
    agentId: number,
    isActive: boolean
): Promise<void> {
    try {
        const { error } = await supabase
            .from('agents')
            .update({ is_active: isActive, updated_at: new Date().toISOString() })
            .eq('agent_id', agentId);

        if (error) {
            throw new Error(error.message);
        }
    } catch (error) {
        logger.error('Failed to update agent status', error as Error, { agentId });
        throw error;
    }
}

/**
 * Reputation records.
 */
export async function upsertReputation(reputation: {
    agentAddress: string;
    tag: string;
    score: number;
    feedbackCount: number;
    successfulTransactions: number;
    failedTransactions: number;
}): Promise<void> {
    try {
        const total = reputation.successfulTransactions + reputation.failedTransactions;
        const successRate = total > 0 ? reputation.successfulTransactions / total : 0;

        const { error } = await supabase
            .from('agent_reputation')
            .upsert({
                agent_address: reputation.agentAddress,
                tag: reputation.tag,
                reputation_score: reputation.score,
                feedback_count: reputation.feedbackCount,
                successful_transactions: reputation.successfulTransactions,
                failed_transactions: reputation.failedTransactions,
                success_rate: successRate,
                last_calculated: new Date().toISOString()
            }, { onConflict: 'agent_address,tag' });

        if (error) {
            throw new Error(error.message);
        }
    } catch (error) {
        logger.error('Failed to upsert reputation', error as Error, {
            agentAddress: reputation.agentAddress
        });
        throw error;
    }
}

export async function insertFeedbackEvent(feedback: {
    subjectAddress: string;
    submitterAddress: string;
    tag: string;
    score: number;
    comment: string;
    txHash: string;
    blockNumber: number;
    timestamp: string;
}): Promise<void> {
    try {
        const { error } = await supabase
            .from('feedback_events')
            .insert({
                subject_address: feedback.subjectAddress,
                submitter_address: feedback.submitterAddress,
                tag: feedback.tag,
                score: feedback.score,
                comment: feedback.comment,
                tx_hash: feedback.txHash,
                block_number: feedback.blockNumber,
                created_at: feedback.timestamp
            });

        if (error && error.code !== '23505') {
            throw new Error(error.message);
        }
    } catch (error) {
        logger.error('Failed to insert feedback event', error as Error, { txHash: feedback.txHash });
        throw error;
    }
}

/**
 * Trade records.
 */
export async function insertTrade(trade: {
    userId: string;
    venueId: string;
    pair: string;
    side: string;
    size: number;
    price: number;
    leverage: number;
    status: string;
    txHash?: string;
    blockNumber?: number;
}): Promise<string> {
    try {
        const { data, error } = await supabase
            .from('trades')
            .insert({
                user_id: trade.userId,
                venue_id: trade.venueId,
                pair: trade.pair,
                side: trade.side,
                size: trade.size,
                price: trade.price,
                leverage: trade.leverage,
                status: trade.status,
                tx_hash: trade.txHash,
                block_number: trade.blockNumber,
                created_at: new Date().toISOString()
            })
            .select('id')
            .single();

        if (error) {
            throw new Error(error.message);
        }

        return data.id;
    } catch (error) {
        logger.error('Failed to insert trade', error as Error);
        throw error;
    }
}

/**
 * Aggregate queries for calculations.
 */
export async function getPaymentStats(agentAddress: string): Promise<{
    totalReceived: number;
    totalSent: number;
    successCount: number;
    failCount: number;
}> {
    try {
        const { data: received } = await supabase
            .from('payments')
            .select('amount, status')
            .eq('to_address', agentAddress);

        const { data: sent } = await supabase
            .from('payments')
            .select('amount, status')
            .eq('from_address', agentAddress);

        const successReceived = (received || []).filter(p => p.status === 'settled');
        const failReceived = (received || []).filter(p => p.status === 'failed');

        return {
            totalReceived: successReceived.reduce((sum, p) => sum + Number(p.amount), 0),
            totalSent: (sent || []).reduce((sum, p) => sum + Number(p.amount), 0),
            successCount: successReceived.length,
            failCount: failReceived.length
        };
    } catch (error) {
        logger.error('Failed to get payment stats', error as Error, { agentAddress });
        throw error;
    }
}

export async function getAllAgentAddresses(): Promise<string[]> {
    try {
        const { data, error } = await supabase
            .from('agents')
            .select('owner_address')
            .eq('is_active', true);

        if (error) {
            throw new Error(error.message);
        }

        return [...new Set((data || []).map(a => a.owner_address))];
    } catch (error) {
        logger.error('Failed to get agent addresses', error as Error);
        throw error;
    }
}
