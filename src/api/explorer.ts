/**
 * Explorer API
 * 
 * REST endpoints for the Relay Core Explorer
 * Provides data for sessions, transactions, agents, and payments
 */

import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import logger from '../lib/logger.js';

const router = Router();

// ============================================
// OVERVIEW
// ============================================

/**
 * GET /api/explorer/overview
 * 
 * Get overview data for the explorer homepage
 */
router.get('/overview', async (req, res) => {
    try {
        // Fetch sessions
        const { data: sessions, error: sessionsError } = await supabase
            .from('escrow_sessions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);

        // Fetch recent payments
        const { data: payments, error: paymentsError } = await supabase
            .from('payments')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);

        // Fetch agents
        const { data: agents, error: agentsError } = await supabase
            .from('services')
            .select('*, reputations(*)')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(10);

        // Fetch on-chain transactions
        const { data: onChainTxns } = await supabase
            .from('on_chain_transactions')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(10);

        // Fetch RWA state transitions
        const { data: rwaTxns } = await supabase
            .from('rwa_state_transitions')
            .select('*')
            .order('transitioned_at', { ascending: false })
            .limit(10);

        // Fetch session payments
        const { data: sessionPayments } = await supabase
            .from('session_payments')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);

        // Merge all transactions and sort by timestamp
        interface MergedTx {
            txHash: string;
            type: string;
            from: string;
            to: string;
            value: string;
            status: string;
            timestamp: Date;
            blockNumber?: number;
            metadata?: Record<string, unknown>;
        }

        const transactions: MergedTx[] = [];

        (onChainTxns || []).forEach(tx => {
            transactions.push({
                txHash: tx.tx_hash,
                type: tx.type || 'transfer',
                from: tx.from_address,
                to: tx.to_address,
                value: tx.value || '0',
                status: tx.status,
                timestamp: new Date(tx.timestamp),
                blockNumber: tx.block_number
            });
        });

        (rwaTxns || []).forEach(t => {
            transactions.push({
                txHash: t.payment_hash || `rwa_${t.id}`,
                type: 'rwa_transition',
                from: t.agent_address || '',
                to: t.rwa_id || '',
                value: '0',
                status: 'success',
                timestamp: new Date(t.transitioned_at),
                metadata: {
                    rwaId: t.rwa_id,
                    fromState: t.from_state,
                    toState: t.to_state,
                    agentRole: t.agent_role
                }
            });
        });

        (sessionPayments || []).forEach(p => {
            transactions.push({
                txHash: p.tx_hash || p.facilitator_tx_hash || `session_${p.id}`,
                type: 'session_payment',
                from: p.session_id || '',
                to: p.agent_address || '',
                value: p.amount || '0',
                status: p.status || 'success',
                timestamp: new Date(p.created_at),
                metadata: {
                    sessionId: p.session_id,
                    agentName: p.agent_name
                }
            });
        });

        // Sort all by timestamp descending and take top 10
        transactions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        const topTransactions = transactions.slice(0, 10);

        // Calculate stats
        const totalSessions = sessions?.length || 0;
        const activeAgents = agents?.length || 0;
        const totalVolume = (payments || []).reduce((sum, p) =>
            sum + (parseFloat(p.amount) || 0), 0
        );

        // Calculate real success rate from payments
        const successfulPayments = (payments || []).filter(p => p.status === 'success' || p.status === 'settled').length;
        const totalPayments = (payments || []).length;
        const successRate = totalPayments > 0 ? Math.round((successfulPayments / totalPayments) * 100) : 100;

        res.json({
            stats: {
                totalSessions,
                activeAgents,
                totalVolume: totalVolume.toFixed(2),
                successRate
            },
            sessions: (sessions || []).map(s => ({
                sessionId: s.session_id,
                owner: s.owner_address || s.owner || '',
                totalDeposited: s.deposited || s.max_spend || '0',
                totalSpent: s.spent || s.released || '0',
                state: s.is_active ? 'active' : (s.closed_at ? 'closed' : 'pending'),
                agentCount: 0,
                createdAt: new Date(s.created_at),
                lastActivity: new Date(s.updated_at || s.created_at)
            })),
            transactions: topTransactions,
            agents: (agents || []).map(a => ({
                agentId: a.id,
                name: a.name,
                owner: a.owner_address,
                sessionsActive: 0,
                totalEarned: a.reputations?.[0]?.total_payments
                    ? (a.reputations[0].total_payments * parseFloat(a.price_per_call || '0')).toFixed(2)
                    : '0',
                successRate: a.reputations?.[0]?.reputation_score || 80,
                lastActive: new Date(a.last_active || a.created_at)
            })),
            payments: (payments || []).map(p => ({
                paymentId: p.payment_id,
                from: p.from_address,
                to: p.to_address,
                amount: p.amount || '0',
                status: p.status,
                timestamp: new Date(p.created_at)
            }))
        });
    } catch (error) {
        logger.error('Explorer overview error', error as Error);
        res.status(500).json({ error: 'Failed to fetch explorer data' });
    }
});

// ============================================
// SESSIONS
// ============================================

/**
 * GET /api/explorer/sessions
 */
router.get('/sessions', async (req, res) => {
    try {
        const { limit = 50, offset = 0, state } = req.query;

        let query = supabase
            .from('escrow_sessions')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(Number(offset), Number(offset) + Number(limit) - 1);

        if (state === 'active') {
            query = query.eq('is_active', true);
        } else if (state === 'closed') {
            query = query.eq('is_active', false);
        }

        const { data, error, count } = await query;

        if (error) throw error;

        res.json({
            sessions: (data || []).map(s => ({
                sessionId: s.session_id,
                owner: s.owner_address || '',
                totalDeposited: s.deposited || s.max_spend || '0',
                totalSpent: s.spent || s.released || '0',
                state: s.is_active ? 'active' : (s.closed_at ? 'closed' : 'pending'),
                agentCount: 0,
                createdAt: new Date(s.created_at),
                lastActivity: new Date(s.updated_at || s.created_at)
            })),
            total: count,
            offset: Number(offset),
            limit: Number(limit)
        });
    } catch (error) {
        logger.error('Sessions fetch error', error as Error);
        res.status(500).json({ error: 'Failed to fetch sessions' });
    }
});

/**
 * GET /api/explorer/sessions/:sessionId
 */
router.get('/sessions/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;

        // Fetch session with correct column names
        const { data: session, error } = await supabase
            .from('escrow_sessions')
            .select('*')
            .eq('session_id', sessionId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Session not found' });
            }
            throw error;
        }

        // Fetch session payments (agent payments)
        const { data: payments } = await supabase
            .from('session_payments')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: false });

        // Fetch escrow refunds for this session
        const { data: refunds } = await supabase
            .from('escrow_refunds')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: false });

        // Build events from payments and refunds
        const events: any[] = [];

        // Add payment events
        (payments || []).forEach((p: any) => {
            events.push({
                id: p.id,
                type: 'agent_payment',
                txHash: p.tx_hash || p.facilitator_tx_hash,
                timestamp: new Date(p.created_at),
                data: {
                    agentName: p.agent_name,
                    agentAddress: p.agent_address,
                    amount: p.amount,
                    method: p.payment_method
                }
            });
        });

        // Add refund events
        (refunds || []).forEach((r: any) => {
            events.push({
                id: r.id,
                type: 'refund',
                txHash: r.tx_hash,
                timestamp: new Date(r.created_at),
                data: {
                    amount: r.amount,
                    reason: r.reason
                }
            });
        });

        // Sort events by timestamp
        events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        // Build unique agents list from payments
        const agentMap = new Map();
        (payments || []).forEach((p: any) => {
            const existing = agentMap.get(p.agent_address) || { totalSpend: 0, authorizedAt: p.created_at };
            agentMap.set(p.agent_address, {
                agentId: p.agent_address,
                agentName: p.agent_name,
                isAuthorized: true,
                totalSpend: (parseFloat(existing.totalSpend) + parseFloat(p.amount || '0')).toFixed(6),
                authorizedAt: new Date(Math.min(new Date(existing.authorizedAt).getTime(), new Date(p.created_at).getTime()))
            });
        });

        // Calculate spent from payments or use stored value
        const spent = parseFloat(session.spent || '0') ||
            (payments || []).reduce((sum: number, p: any) => sum + parseFloat(p.amount || '0'), 0);

        res.json({
            session: {
                sessionId: session.session_id,
                owner: session.owner_address || session.owner || '',
                totalDeposited: session.deposited || session.max_spend || '0',
                totalSpent: spent.toFixed(6),
                maxSpend: session.max_spend || '0',
                remaining: (parseFloat(session.deposited || '0') - spent).toFixed(6),
                state: session.is_active ? 'active' : (session.closed_at ? 'closed' : 'pending'),
                createdAt: new Date(session.created_at),
                expiresAt: session.expiry ? new Date(session.expiry) : null,
                closedAt: session.closed_at ? new Date(session.closed_at) : null,
                depositTxHash: session.created_tx_hash,
                events,
                agents: Array.from(agentMap.values()),
                paymentCount: payments?.length || 0
            }
        });
    } catch (error) {
        logger.error('Session detail error', error as Error);
        res.status(500).json({ error: 'Failed to fetch session' });
    }
});

// ============================================
// TRANSACTIONS
// ============================================

/**
 * GET /api/explorer/transactions
 *
 * Fetches all transactions including on-chain, RWA state transitions, and session payments.
 * Type filter: 'transfer', 'agent_payment', 'rwa_transition', 'session_payment'
 */
router.get('/transactions', async (req, res) => {
    try {
        const { limit = 50, offset = 0, type } = req.query;
        const limitNum = Number(limit);
        const offsetNum = Number(offset);

        interface Transaction {
            txHash: string;
            type: string;
            from: string;
            to: string;
            value: string;
            status: string;
            timestamp: Date;
            blockNumber?: number;
            gasUsed?: string;
            metadata?: Record<string, unknown>;
        }

        const allTransactions: Transaction[] = [];

        // Fetch on-chain transactions (unless filtering for specific non-chain type)
        if (!type || type === 'transfer' || type === 'agent_payment') {
            let onChainQuery = supabase
                .from('on_chain_transactions')
                .select('*')
                .order('timestamp', { ascending: false })
                .limit(limitNum + offsetNum);

            if (type) {
                onChainQuery = onChainQuery.eq('type', type);
            }

            const { data: onChainData } = await onChainQuery;

            (onChainData || []).forEach(tx => {
                allTransactions.push({
                    txHash: tx.tx_hash,
                    type: tx.type || 'transfer',
                    from: tx.from_address,
                    to: tx.to_address,
                    value: tx.value || '0',
                    status: tx.status,
                    timestamp: new Date(tx.timestamp),
                    blockNumber: tx.block_number,
                    gasUsed: tx.gas_used
                });
            });
        }

        // Fetch RWA state transitions
        if (!type || type === 'rwa_transition') {
            const { data: rwaData } = await supabase
                .from('rwa_state_transitions')
                .select('*')
                .order('transitioned_at', { ascending: false })
                .limit(limitNum + offsetNum);

            (rwaData || []).forEach(t => {
                allTransactions.push({
                    txHash: t.payment_hash || `rwa_${t.id}`,
                    type: 'rwa_transition',
                    from: t.agent_address || '',
                    to: t.rwa_id || '',
                    value: '0',
                    status: 'success',
                    timestamp: new Date(t.transitioned_at),
                    metadata: {
                        rwaId: t.rwa_id,
                        fromState: t.from_state,
                        toState: t.to_state,
                        agentRole: t.agent_role
                    }
                });
            });
        }

        // Fetch session payments
        if (!type || type === 'session_payment') {
            const { data: sessionPayData } = await supabase
                .from('session_payments')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limitNum + offsetNum);

            (sessionPayData || []).forEach(p => {
                allTransactions.push({
                    txHash: p.tx_hash || p.facilitator_tx_hash || `session_${p.id}`,
                    type: 'session_payment',
                    from: p.session_id || '',
                    to: p.agent_address || '',
                    value: p.amount || '0',
                    status: p.status || 'success',
                    timestamp: new Date(p.created_at),
                    metadata: {
                        sessionId: p.session_id,
                        agentName: p.agent_name,
                        paymentMethod: p.payment_method
                    }
                });
            });
        }

        // Sort all by timestamp descending
        allTransactions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        // Apply pagination
        const paginatedTxns = allTransactions.slice(offsetNum, offsetNum + limitNum);

        res.json({
            transactions: paginatedTxns,
            total: allTransactions.length,
            offset: offsetNum,
            limit: limitNum
        });
    } catch (error) {
        logger.error('Transactions fetch error', error as Error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

/**
 * GET /api/explorer/transactions/:txHash
 */
router.get('/transactions/:txHash', async (req, res) => {
    try {
        const { txHash } = req.params;

        const { data: tx, error } = await supabase
            .from('on_chain_transactions')
            .select('*')
            .eq('tx_hash', txHash)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Transaction not found' });
            }
            throw error;
        }

        res.json({ transaction: tx });
    } catch (error) {
        logger.error('Transaction detail error', error as Error);
        res.status(500).json({ error: 'Failed to fetch transaction' });
    }
});

// ============================================
// AGENTS
// ============================================

/**
 * GET /api/explorer/agents
 */
router.get('/agents', async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;

        const { data, error, count } = await supabase
            .from('services')
            .select('*, reputations(*)', { count: 'exact' })
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .range(Number(offset), Number(offset) + Number(limit) - 1);

        if (error) throw error;

        res.json({
            agents: (data || []).map(a => ({
                agentId: a.id,
                name: a.name,
                owner: a.owner_address,
                category: a.category,
                pricePerCall: a.price_per_call,
                totalCalls: a.reputations?.[0]?.total_payments || 0,
                successRate: a.reputations?.[0]?.reputation_score || 80,
                avgLatency: a.reputations?.[0]?.avg_latency_ms || 0,
                createdAt: new Date(a.created_at)
            })),
            total: count,
            offset: Number(offset),
            limit: Number(limit)
        });
    } catch (error) {
        logger.error('Agents fetch error', error as Error);
        res.status(500).json({ error: 'Failed to fetch agents' });
    }
});

// ============================================
// PAYMENTS
// ============================================

/**
 * GET /api/explorer/payments
 */
router.get('/payments', async (req, res) => {
    try {
        const { limit = 50, offset = 0, status } = req.query;

        let query = supabase
            .from('payments')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(Number(offset), Number(offset) + Number(limit) - 1);

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error, count } = await query;

        if (error) throw error;

        res.json({
            payments: (data || []).map(p => ({
                paymentId: p.payment_id,
                from: p.from_address,
                to: p.to_address,
                amount: p.amount || '0',
                status: p.status,
                timestamp: new Date(p.created_at)
            })),
            total: count,
            offset: Number(offset),
            limit: Number(limit)
        });
    } catch (error) {
        logger.error('Payments fetch error', error as Error);
        res.status(500).json({ error: 'Failed to fetch payments' });
    }
});

// ============================================
// SEARCH
// ============================================

/**
 * GET /api/explorer/search
 */
router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || String(q).length < 3) {
            return res.status(400).json({ error: 'Query too short (min 3 chars)' });
        }

        const query = String(q).toLowerCase();
        const results: any[] = [];

        // Search sessions
        const { data: sessions } = await supabase
            .from('escrow_sessions')
            .select('session_id, owner_address, is_active, closed_at')
            .or(`session_id.ilike.%${query}%,owner_address.ilike.%${query}%`)
            .limit(5);

        if (sessions) {
            results.push(...sessions.map(s => ({
                type: 'session',
                id: s.session_id,
                label: `Session ${s.session_id.slice(0, 10)}...`,
                state: s.is_active ? 'active' : (s.closed_at ? 'closed' : 'pending')
            })));
        }

        // Search transactions
        const { data: txs } = await supabase
            .from('on_chain_transactions')
            .select('tx_hash, type, status')
            .ilike('tx_hash', `%${query}%`)
            .limit(5);

        if (txs) {
            results.push(...txs.map(tx => ({
                type: 'transaction',
                id: tx.tx_hash,
                label: `Tx ${tx.tx_hash.slice(0, 10)}...`,
                status: tx.status
            })));
        }

        // Search agents
        const { data: agents } = await supabase
            .from('services')
            .select('id, name, owner_address')
            .or(`name.ilike.%${query}%,owner_address.ilike.%${query}%`)
            .limit(5);

        if (agents) {
            results.push(...agents.map(a => ({
                type: 'agent',
                id: a.id,
                label: a.name,
                owner: a.owner_address
            })));
        }

        res.json({ results, query: q });
    } catch (error) {
        logger.error('Search error', error as Error);
        res.status(500).json({ error: 'Search failed' });
    }
});

export default router;
