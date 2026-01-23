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

// ============================================
// ESCROW SESSION DATABASE OPERATIONS
// ============================================

/**
 * Insert a new escrow session.
 */
export async function insertEscrowSession(session: {
    sessionId: string;
    owner: string;
    escrowAgent: string;
    maxSpend: string;
    expiry: string;
    deposited: string;
    released: string;
    isActive: boolean;
    createdAt: string;
    createdTxHash: string;
    createdBlock: number;
}): Promise<void> {
    try {
        const { error } = await supabase
            .from('escrow_sessions')
            .upsert({
                session_id: session.sessionId,
                owner_address: session.owner,
                escrow_agent: session.escrowAgent,
                max_spend: session.maxSpend,
                expiry: session.expiry,
                deposited: session.deposited,
                released: session.released,
                is_active: session.isActive,
                created_at: session.createdAt,
                created_tx_hash: session.createdTxHash,
                created_block: session.createdBlock,
                updated_at: new Date().toISOString()
            }, { onConflict: 'session_id' });

        if (error) {
            throw new Error(error.message);
        }
    } catch (error) {
        logger.error('Failed to insert escrow session', error as Error, { sessionId: session.sessionId });
        throw error;
    }
}

/**
 * Insert a session event for audit trail.
 */
export async function insertSessionEvent(event: {
    sessionId: string;
    eventType: 'DEPOSIT' | 'RELEASE' | 'REFUND' | 'CLOSE' | 'AUTHORIZE' | 'REVOKE';
    actor?: string;
    amount?: string;
    executionId?: string;
    timestamp: string;
    txHash: string;
    blockNumber: number;
}): Promise<void> {
    try {
        const { error } = await supabase
            .from('escrow_session_events')
            .insert({
                session_id: event.sessionId,
                event_type: event.eventType,
                actor_address: event.actor,
                amount: event.amount,
                execution_id: event.executionId,
                tx_hash: event.txHash,
                block_number: event.blockNumber,
                created_at: event.timestamp
            });

        if (error && error.code !== '23505') { // Ignore duplicate key
            throw new Error(error.message);
        }
    } catch (error) {
        logger.error('Failed to insert session event', error as Error, { txHash: event.txHash });
        throw error;
    }
}

/**
 * Increment session deposited amount.
 */
export async function incrementSessionDeposited(sessionId: string, amount: string): Promise<void> {
    try {
        // First get current value
        const { data, error: fetchError } = await supabase
            .from('escrow_sessions')
            .select('deposited')
            .eq('session_id', sessionId)
            .single();

        if (fetchError) {
            throw new Error(fetchError.message);
        }

        const currentDeposited = BigInt(data?.deposited || '0');
        const newDeposited = (currentDeposited + BigInt(amount)).toString();

        const { error } = await supabase
            .from('escrow_sessions')
            .update({
                deposited: newDeposited,
                updated_at: new Date().toISOString()
            })
            .eq('session_id', sessionId);

        if (error) {
            throw new Error(error.message);
        }
    } catch (error) {
        logger.error('Failed to increment session deposited', error as Error, { sessionId });
        throw error;
    }
}

/**
 * Increment session released amount.
 */
export async function incrementSessionReleased(sessionId: string, amount: string): Promise<void> {
    try {
        const { data, error: fetchError } = await supabase
            .from('escrow_sessions')
            .select('released')
            .eq('session_id', sessionId)
            .single();

        if (fetchError) {
            throw new Error(fetchError.message);
        }

        const currentReleased = BigInt(data?.released || '0');
        const newReleased = (currentReleased + BigInt(amount)).toString();

        const { error } = await supabase
            .from('escrow_sessions')
            .update({
                released: newReleased,
                updated_at: new Date().toISOString()
            })
            .eq('session_id', sessionId);

        if (error) {
            throw new Error(error.message);
        }
    } catch (error) {
        logger.error('Failed to increment session released', error as Error, { sessionId });
        throw error;
    }
}

/**
 * Update session as closed.
 */
export async function updateSessionClosed(
    sessionId: string,
    closedAt: string,
    closedTxHash: string,
    closedBlock: number
): Promise<void> {
    try {
        const { error } = await supabase
            .from('escrow_sessions')
            .update({
                is_active: false,
                closed_at: closedAt,
                closed_tx_hash: closedTxHash,
                closed_block: closedBlock,
                updated_at: new Date().toISOString()
            })
            .eq('session_id', sessionId);

        if (error) {
            throw new Error(error.message);
        }
    } catch (error) {
        logger.error('Failed to update session closed', error as Error, { sessionId });
        throw error;
    }
}

/**
 * Insert session agent authorization.
 */
export async function insertSessionAgent(agent: {
    sessionId: string;
    agentAddress: string;
    isAuthorized: boolean;
    authorizedAt: string;
    txHash: string;
    blockNumber: number;
}): Promise<void> {
    try {
        const { error } = await supabase
            .from('escrow_session_agents')
            .upsert({
                session_id: agent.sessionId,
                agent_address: agent.agentAddress,
                is_authorized: agent.isAuthorized,
                authorized_at: agent.authorizedAt,
                auth_tx_hash: agent.txHash,
                auth_block: agent.blockNumber,
                updated_at: new Date().toISOString()
            }, { onConflict: 'session_id,agent_address' });

        if (error) {
            throw new Error(error.message);
        }
    } catch (error) {
        logger.error('Failed to insert session agent', error as Error, {
            sessionId: agent.sessionId,
            agentAddress: agent.agentAddress
        });
        throw error;
    }
}

/**
 * Update session agent as revoked.
 */
export async function updateSessionAgentRevoked(
    sessionId: string,
    agentAddress: string,
    revokedAt: string
): Promise<void> {
    try {
        const { error } = await supabase
            .from('escrow_session_agents')
            .update({
                is_authorized: false,
                revoked_at: revokedAt,
                updated_at: new Date().toISOString()
            })
            .eq('session_id', sessionId)
            .eq('agent_address', agentAddress);

        if (error) {
            throw new Error(error.message);
        }
    } catch (error) {
        logger.error('Failed to update session agent revoked', error as Error, { sessionId, agentAddress });
        throw error;
    }
}

/**
 * Increment agent earnings from payments.
 */
export async function incrementAgentEarnings(agentAddress: string, amount: string): Promise<void> {
    try {
        // Get or create agent earnings record
        const { data: existing } = await supabase
            .from('agent_earnings')
            .select('total_earned')
            .eq('agent_address', agentAddress)
            .single();

        const currentEarned = BigInt(existing?.total_earned || '0');
        const newEarned = (currentEarned + BigInt(amount)).toString();

        const { error } = await supabase
            .from('agent_earnings')
            .upsert({
                agent_address: agentAddress,
                total_earned: newEarned,
                updated_at: new Date().toISOString()
            }, { onConflict: 'agent_address' });

        if (error) {
            throw new Error(error.message);
        }
    } catch (error) {
        logger.error('Failed to increment agent earnings', error as Error, { agentAddress });
        // Don't throw - this is supplementary data
    }
}

/**
 * Get active sessions for an owner.
 */
export async function getActiveSessionsForOwner(ownerAddress: string): Promise<Array<{
    sessionId: string;
    escrowAgent: string;
    maxSpend: string;
    deposited: string;
    released: string;
    expiry: string;
    createdAt: string;
}>> {
    try {
        const { data, error } = await supabase
            .from('escrow_sessions')
            .select('session_id, escrow_agent, max_spend, deposited, released, expiry, created_at')
            .eq('owner_address', ownerAddress)
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) {
            throw new Error(error.message);
        }

        return (data || []).map(s => ({
            sessionId: s.session_id,
            escrowAgent: s.escrow_agent,
            maxSpend: s.max_spend,
            deposited: s.deposited,
            released: s.released,
            expiry: s.expiry,
            createdAt: s.created_at
        }));
    } catch (error) {
        logger.error('Failed to get active sessions for owner', error as Error, { ownerAddress });
        throw error;
    }
}

/**
 * Get session events for audit.
 */
export async function getSessionEvents(sessionId: string): Promise<Array<{
    eventType: string;
    actor: string | null;
    amount: string | null;
    txHash: string;
    blockNumber: number;
    createdAt: string;
}>> {
    try {
        const { data, error } = await supabase
            .from('escrow_session_events')
            .select('event_type, actor_address, amount, tx_hash, block_number, created_at')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true });

        if (error) {
            throw new Error(error.message);
        }

        return (data || []).map(e => ({
            eventType: e.event_type,
            actor: e.actor_address,
            amount: e.amount,
            txHash: e.tx_hash,
            blockNumber: e.block_number,
            createdAt: e.created_at
        }));
    } catch (error) {
        logger.error('Failed to get session events', error as Error, { sessionId });
        throw error;
    }
}

// ============================================
// TRANSACTION INDEXER DATABASE OPERATIONS
// ============================================

/**
 * Get transactions that need chain confirmation.
 */
export async function getTransactionsToIndex(limit: number = 100): Promise<Array<{
    transaction_id: string;
    tx_hash: string | null;
    status: string;
    chain_id: number;
    expires_at: string;
    tool: string;
    session_id: string | null;
    agent_id: string | null;
}>> {
    try {
        const { data, error } = await supabase
            .from('pending_transactions')
            .select('transaction_id, tx_hash, status, chain_id, expires_at, tool, session_id, agent_id')
            .in('status', ['broadcast', 'pending'])
            .order('created_at', { ascending: true })
            .limit(limit);

        if (error) {
            throw new Error(error.message);
        }

        return data || [];
    } catch (error) {
        logger.error('Failed to get transactions to index', error as Error);
        throw error;
    }
}

/**
 * Update transaction status with metadata.
 */
export async function updateTransactionStatus(
    transactionId: string,
    status: 'confirmed' | 'failed' | 'expired',
    metadata: {
        block_number?: number;
        block_hash?: string;
        gas_used?: string;
        confirmed_at?: string;
        error_message?: string;
    }
): Promise<void> {
    try {
        const updateData: Record<string, unknown> = { status };

        if (metadata.block_number !== undefined) updateData.block_number = metadata.block_number;
        if (metadata.block_hash) updateData.block_hash = metadata.block_hash;
        if (metadata.gas_used) updateData.gas_used = metadata.gas_used;
        if (metadata.confirmed_at) updateData.confirmed_at = metadata.confirmed_at;
        if (metadata.error_message) updateData.error_message = metadata.error_message;

        const { error } = await supabase
            .from('pending_transactions')
            .update(updateData)
            .eq('transaction_id', transactionId);

        if (error) {
            throw new Error(error.message);
        }
    } catch (error) {
        logger.error('Failed to update transaction status', error as Error, { transactionId });
        throw error;
    }
}

/**
 * Insert transaction state change for audit.
 */
export async function insertTransactionStateChange(
    transactionId: string,
    status: string,
    metadata: Record<string, unknown>
): Promise<void> {
    try {
        const { error } = await supabase
            .from('pending_tx_state_history')
            .insert({
                transaction_id: transactionId,
                status,
                metadata,
                created_at: new Date().toISOString()
            });

        if (error && error.code !== '23505') {
            throw new Error(error.message);
        }
    } catch (error) {
        logger.error('Failed to insert transaction state change', error as Error, { transactionId });
        // Don't throw - this is audit data
    }
}

/**
 * Upsert on-chain transaction record.
 */
export async function upsertOnChainTransaction(tx: {
    txHash: string;
    chainId: number;
    blockNumber: number;
    blockHash: string;
    from: string;
    to: string;
    value: string;
    gasUsed: string;
    gasPrice: string;
    status: 'success' | 'failed';
    timestamp: string;
    tool: string;
    sessionId: string | null;
    agentId: string | null;
    pendingTxId: string;
}): Promise<void> {
    try {
        const { error } = await supabase
            .from('on_chain_transactions')
            .upsert({
                tx_hash: tx.txHash,
                chain_id: tx.chainId,
                block_number: tx.blockNumber,
                block_hash: tx.blockHash,
                from_address: tx.from,
                to_address: tx.to,
                value: tx.value,
                gas_used: tx.gasUsed,
                gas_price: tx.gasPrice,
                status: tx.status,
                timestamp: tx.timestamp,
                tool: tx.tool,
                session_id: tx.sessionId,
                agent_id: tx.agentId,
                pending_tx_id: tx.pendingTxId,
                created_at: new Date().toISOString()
            }, { onConflict: 'tx_hash' });

        if (error) {
            throw new Error(error.message);
        }
    } catch (error) {
        logger.error('Failed to upsert on-chain transaction', error as Error, { txHash: tx.txHash });
        throw error;
    }
}

/**
 * Get on-chain transactions for an agent.
 */
export async function getAgentTransactions(agentId: string, limit: number = 50): Promise<Array<{
    txHash: string;
    chainId: number;
    blockNumber: number;
    tool: string;
    status: string;
    gasUsed: string;
    timestamp: string;
}>> {
    try {
        const { data, error } = await supabase
            .from('on_chain_transactions')
            .select('tx_hash, chain_id, block_number, tool, status, gas_used, timestamp')
            .eq('agent_id', agentId)
            .order('timestamp', { ascending: false })
            .limit(limit);

        if (error) {
            throw new Error(error.message);
        }

        return (data || []).map(t => ({
            txHash: t.tx_hash,
            chainId: t.chain_id,
            blockNumber: t.block_number,
            tool: t.tool,
            status: t.status,
            gasUsed: t.gas_used,
            timestamp: t.timestamp
        }));
    } catch (error) {
        logger.error('Failed to get agent transactions', error as Error, { agentId });
        throw error;
    }
}

/**
 * Get on-chain transactions for a session.
 */
export async function getSessionTransactions(sessionId: string): Promise<Array<{
    txHash: string;
    blockNumber: number;
    tool: string;
    status: string;
    agentId: string | null;
    timestamp: string;
}>> {
    try {
        const { data, error } = await supabase
            .from('on_chain_transactions')
            .select('tx_hash, block_number, tool, status, agent_id, timestamp')
            .eq('session_id', sessionId)
            .order('timestamp', { ascending: true });

        if (error) {
            throw new Error(error.message);
        }

        return (data || []).map(t => ({
            txHash: t.tx_hash,
            blockNumber: t.block_number,
            tool: t.tool,
            status: t.status,
            agentId: t.agent_id,
            timestamp: t.timestamp
        }));
    } catch (error) {
        logger.error('Failed to get session transactions', error as Error, { sessionId });
        throw error;
    }
}

/**
 * Get transaction statistics.
 */
export async function getTransactionStats(): Promise<{
    total: number;
    confirmed: number;
    failed: number;
    pending: number;
    last24h: number;
}> {
    try {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

        const [total, confirmed, failed, pending, recent] = await Promise.all([
            supabase.from('on_chain_transactions').select('tx_hash', { count: 'exact', head: true }),
            supabase.from('on_chain_transactions').select('tx_hash', { count: 'exact', head: true }).eq('status', 'success'),
            supabase.from('on_chain_transactions').select('tx_hash', { count: 'exact', head: true }).eq('status', 'failed'),
            supabase.from('pending_transactions').select('transaction_id', { count: 'exact', head: true }).eq('status', 'pending'),
            supabase.from('on_chain_transactions').select('tx_hash', { count: 'exact', head: true }).gte('timestamp', yesterday)
        ]);

        return {
            total: total.count || 0,
            confirmed: confirmed.count || 0,
            failed: failed.count || 0,
            pending: pending.count || 0,
            last24h: recent.count || 0
        };
    } catch (error) {
        logger.error('Failed to get transaction stats', error as Error);
        return { total: 0, confirmed: 0, failed: 0, pending: 0, last24h: 0 };
    }
}

// ============================================
// X402 FACILITATOR PAYMENT OPERATIONS
// ============================================

/**
 * Insert x402 payment record.
 */
export async function insertX402Payment(payment: {
    paymentId: string;
    chainId: number;
    payerAddress: string;
    payeeAddress: string;
    amount: string;
    tokenAddress: string;
    status: 'pending' | 'settled' | 'failed' | 'refunded';
    resourceId?: string;
    resourceUrl?: string;
    paymentHeader?: string;
    agentId?: string;
    sessionId?: string;
    tool?: string;
}): Promise<void> {
    try {
        const { error } = await supabase
            .from('x402_payments')
            .insert({
                payment_id: payment.paymentId,
                chain_id: payment.chainId,
                payer_address: payment.payerAddress,
                payee_address: payment.payeeAddress,
                amount: payment.amount,
                token_address: payment.tokenAddress,
                status: payment.status,
                resource_id: payment.resourceId,
                resource_url: payment.resourceUrl,
                payment_header: payment.paymentHeader,
                agent_id: payment.agentId,
                session_id: payment.sessionId,
                tool: payment.tool,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

        if (error && error.code !== '23505') {
            throw new Error(error.message);
        }
    } catch (error) {
        logger.error('Failed to insert x402 payment', error as Error, { paymentId: payment.paymentId });
        throw error;
    }
}

/**
 * Update x402 payment status with facilitator response.
 */
export async function updateX402PaymentSettled(
    paymentId: string,
    settlementData: {
        facilitatorTxHash?: string;
        settlementTxHash?: string;
        settlementBlock?: number;
        facilitatorResponse?: Record<string, unknown>;
    }
): Promise<void> {
    try {
        const { error } = await supabase
            .from('x402_payments')
            .update({
                status: 'settled',
                facilitator_tx_hash: settlementData.facilitatorTxHash,
                settlement_tx_hash: settlementData.settlementTxHash,
                settlement_block: settlementData.settlementBlock,
                facilitator_response: settlementData.facilitatorResponse,
                settled_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('payment_id', paymentId);

        if (error) {
            throw new Error(error.message);
        }
    } catch (error) {
        logger.error('Failed to update x402 payment settled', error as Error, { paymentId });
        throw error;
    }
}

/**
 * Update x402 payment as failed.
 */
export async function updateX402PaymentFailed(
    paymentId: string,
    errorResponse?: Record<string, unknown>
): Promise<void> {
    try {
        const { error } = await supabase
            .from('x402_payments')
            .update({
                status: 'failed',
                facilitator_response: errorResponse,
                updated_at: new Date().toISOString()
            })
            .eq('payment_id', paymentId);

        if (error) {
            throw new Error(error.message);
        }
    } catch (error) {
        logger.error('Failed to update x402 payment failed', error as Error, { paymentId });
        throw error;
    }
}

/**
 * Get x402 payments for an agent.
 */
export async function getAgentX402Payments(agentId: string, limit: number = 50): Promise<Array<{
    paymentId: string;
    amount: string;
    status: string;
    payerAddress: string;
    tool: string | null;
    createdAt: string;
    settledAt: string | null;
}>> {
    try {
        const { data, error } = await supabase
            .from('x402_payments')
            .select('payment_id, amount, status, payer_address, tool, created_at, settled_at')
            .eq('payee_address', agentId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            throw new Error(error.message);
        }

        return (data || []).map(p => ({
            paymentId: p.payment_id,
            amount: p.amount,
            status: p.status,
            payerAddress: p.payer_address,
            tool: p.tool,
            createdAt: p.created_at,
            settledAt: p.settled_at
        }));
    } catch (error) {
        logger.error('Failed to get agent x402 payments', error as Error, { agentId });
        throw error;
    }
}

// ============================================
// MCP INVOCATION LOGGING
// ============================================

/**
 * Log MCP tool invocation.
 */
export async function logMcpInvocation(invocation: {
    invocationId: string;
    toolName: string;
    params: Record<string, unknown>;
    resultStatus: 'success' | 'error';
    resultData?: unknown;
    errorMessage?: string;
    durationMs?: number;
    agentId?: string;
    sessionId?: string;
    userAddress?: string;
    pendingTxId?: string;
    onChainTxHash?: string;
}): Promise<void> {
    try {
        const { error } = await supabase
            .from('mcp_invocations')
            .insert({
                invocation_id: invocation.invocationId,
                tool_name: invocation.toolName,
                params: invocation.params,
                result_status: invocation.resultStatus,
                result_data: invocation.resultData,
                error_message: invocation.errorMessage,
                duration_ms: invocation.durationMs,
                agent_id: invocation.agentId,
                session_id: invocation.sessionId,
                user_address: invocation.userAddress,
                pending_tx_id: invocation.pendingTxId,
                on_chain_tx_hash: invocation.onChainTxHash,
                created_at: new Date().toISOString()
            });

        if (error && error.code !== '23505') {
            throw new Error(error.message);
        }
    } catch (error) {
        logger.error('Failed to log MCP invocation', error as Error, {
            toolName: invocation.toolName
        });
        // Don't throw - this is audit data
    }
}

/**
 * Get MCP invocations for an agent.
 */
export async function getAgentMcpInvocations(agentId: string, limit: number = 100): Promise<Array<{
    invocationId: string;
    toolName: string;
    resultStatus: string;
    durationMs: number | null;
    createdAt: string;
    txHash: string | null;
}>> {
    try {
        const { data, error } = await supabase
            .from('mcp_invocations')
            .select('invocation_id, tool_name, result_status, duration_ms, created_at, on_chain_tx_hash')
            .eq('agent_id', agentId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            throw new Error(error.message);
        }

        return (data || []).map(i => ({
            invocationId: i.invocation_id,
            toolName: i.tool_name,
            resultStatus: i.result_status,
            durationMs: i.duration_ms,
            createdAt: i.created_at,
            txHash: i.on_chain_tx_hash
        }));
    } catch (error) {
        logger.error('Failed to get agent MCP invocations', error as Error, { agentId });
        throw error;
    }
}

/**
 * Get tool usage statistics.
 */
export async function getToolUsageStats(): Promise<Array<{
    toolName: string;
    totalCalls: number;
    successCount: number;
    errorCount: number;
    avgDurationMs: number;
}>> {
    try {
        // Get all invocations grouped by tool
        const { data, error } = await supabase
            .from('mcp_invocations')
            .select('tool_name, result_status, duration_ms');

        if (error) {
            throw new Error(error.message);
        }

        // Aggregate manually
        const statsMap = new Map<string, {
            total: number;
            success: number;
            error: number;
            totalDuration: number;
        }>();

        for (const row of data || []) {
            const existing = statsMap.get(row.tool_name) || {
                total: 0, success: 0, error: 0, totalDuration: 0
            };
            existing.total++;
            if (row.result_status === 'success') existing.success++;
            if (row.result_status === 'error') existing.error++;
            if (row.duration_ms) existing.totalDuration += row.duration_ms;
            statsMap.set(row.tool_name, existing);
        }

        return Array.from(statsMap.entries()).map(([toolName, stats]) => ({
            toolName,
            totalCalls: stats.total,
            successCount: stats.success,
            errorCount: stats.error,
            avgDurationMs: stats.total > 0 ? Math.round(stats.totalDuration / stats.total) : 0
        })).sort((a, b) => b.totalCalls - a.totalCalls);
    } catch (error) {
        logger.error('Failed to get tool usage stats', error as Error);
        return [];
    }
}

/**
 * Get complete agentic flow for a session.
 * Returns all related data: transactions, payments, invocations.
 */
export async function getSessionAgenticFlow(sessionId: string): Promise<{
    session: unknown;
    events: unknown[];
    transactions: unknown[];
    payments: unknown[];
    invocations: unknown[];
}> {
    try {
        const [session, events, transactions, payments, invocations] = await Promise.all([
            supabase.from('escrow_sessions').select('*').eq('session_id', sessionId).single(),
            supabase.from('escrow_session_events').select('*').eq('session_id', sessionId).order('created_at'),
            supabase.from('on_chain_transactions').select('*').eq('session_id', sessionId).order('timestamp'),
            supabase.from('x402_payments').select('*').eq('session_id', sessionId).order('created_at'),
            supabase.from('mcp_invocations').select('*').eq('session_id', sessionId).order('created_at')
        ]);

        return {
            session: session.data,
            events: events.data || [],
            transactions: transactions.data || [],
            payments: payments.data || [],
            invocations: invocations.data || []
        };
    } catch (error) {
        logger.error('Failed to get session agentic flow', error as Error, { sessionId });
        throw error;
    }
}
