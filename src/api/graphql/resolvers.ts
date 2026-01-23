import { supabase } from '../../lib/supabase.js';
import { multiDexAggregator, priceAggregator } from '../../services/prices/price-aggregator.js';
import { zauthClient } from '../../services/zauth/zauth-client.js';

/**
 * GraphQL Resolvers for Relay Core
 */

export const resolvers = {
    Query: {
        // Get single payment
        async payment(_: any, { paymentId }: { paymentId: string }) {
            const { data, error } = await supabase
                .from('payments')
                .select('*')
                .eq('payment_id', paymentId)
                .single();

            if (error) throw new Error(error.message);
            return formatPayment(data);
        },

        // Get payments with filters
        async payments(
            _: any,
            { fromAddress, toAddress, status, limit = 100, offset = 0 }: any
        ) {
            let query = supabase.from('payments').select('*');

            if (fromAddress) query = query.eq('from_address', fromAddress);
            if (toAddress) query = query.eq('to_address', toAddress);
            if (status) query = query.eq('status', status.toLowerCase());

            query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

            const { data, error } = await query;
            if (error) throw new Error(error.message);

            return data.map(formatPayment);
        },

        // Get agent reputation
        async agent(_: any, { address }: { address: string }) {
            const { data, error } = await supabase
                .from('agent_reputation')
                .select('*')
                .eq('agent_address', address)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // No reputation yet
                    return {
                        address,
                        reputationScore: 0,
                        totalPaymentsSent: '0',
                        totalPaymentsReceived: '0',
                        successfulTransactions: 0,
                        failedTransactions: 0,
                        lastActive: null,
                        successRate: 0,
                    };
                }
                throw new Error(error.message);
            }

            return formatAgent(data);
        },

        // Get agents with filters
        async agents(_: any, { minReputation = 0, limit = 100, offset = 0 }: any) {
            const { data, error } = await supabase
                .from('agent_reputation')
                .select('*')
                .gte('reputation_score', minReputation)
                .order('reputation_score', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) throw new Error(error.message);
            return data.map(formatAgent);
        },

        // Reputation leaderboard
        async reputationLeaderboard(_: any, { limit = 10 }: { limit: number }) {
            const { data, error } = await supabase
                .from('agent_reputation')
                .select('*')
                .order('reputation_score', { ascending: false })
                .limit(limit);

            if (error) throw new Error(error.message);
            return data.map(formatAgent);
        },

        // Agent activity
        async agentActivity(
            _: any,
            { address, activityType, limit = 100 }: any
        ) {
            let query = supabase
                .from('agent_activity')
                .select('*')
                .eq('agent_address', address);

            if (activityType) query = query.eq('activity_type', activityType);

            query = query.order('timestamp', { ascending: false }).limit(limit);

            const { data, error } = await query;
            if (error) throw new Error(error.message);

            return data.map(formatActivity);
        },

        // Payment statistics
        async paymentStats(
            _: any,
            { fromAddress, toAddress, startTime, endTime }: any
        ) {
            let query = supabase.from('payments').select('*').eq('status', 'settled');

            if (fromAddress) query = query.eq('from_address', fromAddress);
            if (toAddress) query = query.eq('to_address', toAddress);
            if (startTime) query = query.gte('timestamp', startTime);
            if (endTime) query = query.lte('timestamp', endTime);

            const { data, error } = await query;
            if (error) throw new Error(error.message);

            const uniquePayers = new Set(data.map(p => p.from_address)).size;
            const uniqueReceivers = new Set(data.map(p => p.to_address)).size;
            const totalVolume = data.reduce((sum, p) => sum + BigInt(p.amount), 0n);
            const avgPayment = data.length > 0 ? totalVolume / BigInt(data.length) : 0n;

            return {
                totalVolume: totalVolume.toString(),
                totalPayments: data.length,
                uniquePayers,
                uniqueReceivers,
                averagePayment: avgPayment.toString(),
            };
        },

        // Find agents by service type
        async findAgentsByService(
            _: any,
            { serviceType, minReputation = 0 }: any
        ) {
            // Query agent_activity for service registrations
            const { data: activities, error: actError } = await supabase
                .from('agent_activity')
                .select('agent_address')
                .eq('activity_type', 'service_registered')
                .contains('metadata', { serviceType });

            if (actError) throw new Error(actError.message);

            const agentAddresses = [...new Set(activities.map(a => a.agent_address))];

            if (agentAddresses.length === 0) return [];

            // Get reputation for these agents
            const { data: agents, error: repError } = await supabase
                .from('agent_reputation')
                .select('*')
                .in('agent_address', agentAddresses)
                .gte('reputation_score', minReputation)
                .order('reputation_score', { ascending: false });

            if (repError) throw new Error(repError.message);

            return agents.map(formatAgent);
        },

        // Service queries
        async service(_: any, { id }: { id: string }) {
            const { data, error } = await supabase
                .from('services')
                .select(`
                    *,
                    reputations (
                        total_payments,
                        successful_payments,
                        failed_payments,
                        avg_latency_ms,
                        unique_payers,
                        reputation_score
                    )
                `)
                .eq('id', id)
                .single();

            if (error) throw new Error(error.message);
            return await formatService(data);
        },

        async services(_: any, { category, minReputation = 0, isActive, limit = 100, offset = 0 }: any) {
            let query = supabase
                .from('services')
                .select(`
                    *,
                    reputations (
                        total_payments,
                        successful_payments,
                        failed_payments,
                        avg_latency_ms,
                        unique_payers,
                        reputation_score
                    )
                `);

            if (category) query = query.eq('category', category);
            if (isActive !== undefined) query = query.eq('is_active', isActive);

            query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

            const { data, error } = await query;
            if (error) throw new Error(error.message);

            // Filter by reputation if needed
            let services = await Promise.all(data.map(formatService));
            if (minReputation > 0) {
                services = services.filter(s => (s.reputation?.reputationScore || 0) >= minReputation);
            }

            return services;
        },

        async serviceLeaderboard(_: any, { limit = 10 }: { limit: number }) {
            const { data, error } = await supabase
                .from('services')
                .select(`
                    *,
                    reputations (
                        total_payments,
                        successful_payments,
                        failed_payments,
                        avg_latency_ms,
                        unique_payers,
                        reputation_score
                    )
                `)
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(limit * 2); // Get more to sort by reputation

            if (error) throw new Error(error.message);

            const formatted = await Promise.all(data.map(formatService));
            return formatted
                .sort((a, b) => (b.reputation?.reputationScore || 0) - (a.reputation?.reputationScore || 0))
                .slice(0, limit);
        },

        // DEX venue queries
        async venue(_: any, { id }: { id: string }) {
            const { data, error } = await supabase
                .from('dex_venues')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw new Error(error.message);
            return await formatVenue(data);
        },

        async venues(_: any, { chain, isActive }: any) {
            let query = supabase.from('dex_venues').select('*');

            if (chain) query = query.eq('chain', chain);
            if (isActive !== undefined) query = query.eq('is_active', isActive);

            const { data, error } = await query;
            if (error) throw new Error(error.message);

            return await Promise.all(data.map(formatVenue));
        },

        async venueLeaderboard(_: any, { limit = 10 }: { limit: number }) {
            const { data, error } = await supabase
                .from('dex_venues')
                .select('*')
                .eq('is_active', true)
                .limit(limit * 2); // Get more to sort by reputation

            if (error) throw new Error(error.message);

            // Calculate reputation and sort
            const formatted = await Promise.all(data.map(formatVenue));
            return formatted
                .sort((a, b) => b.reputation.reputationScore - a.reputation.reputationScore)
                .slice(0, limit);
        },

        // Trade queries
        async trade(_: any, { id }: { id: string }) {
            const { data, error } = await supabase
                .from('trades')
                .select(`
                    *,
                    dex_venues (*)
                `)
                .eq('id', id)
                .single();

            if (error) throw new Error(error.message);
            return await formatTrade(data);
        },

        async trades(_: any, { userAddress, venueId, status, limit = 100, offset = 0 }: any) {
            let query = supabase
                .from('trades')
                .select(`
                    *,
                    dex_venues (*)
                `);

            if (userAddress) query = query.eq('user_address', userAddress);
            if (venueId) query = query.eq('venue_id', venueId);
            if (status) query = query.eq('status', status);

            query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

            const { data, error } = await query;
            if (error) throw new Error(error.message);

            return await Promise.all(data.map(formatTrade));
        },

        // Identity resolution queries
        async identity(_: any, { socialId }: { socialId: string }) {
            const { data, error } = await supabase
                .from('identity_mappings')
                .select('*')
                .eq('social_id', socialId.toLowerCase())
                .single();

            if (error) {
                if (error.code === 'PGRST116') return null;
                throw new Error(error.message);
            }

            return {
                id: data.id,
                socialId: data.social_id,
                walletAddress: data.wallet_address,
                platform: data.platform,
                verified: data.verified,
                createdAt: data.created_at,
            };
        },

        async walletIdentities(_: any, { walletAddress }: { walletAddress: string }) {
            const { data, error } = await supabase
                .from('identity_mappings')
                .select('*')
                .eq('wallet_address', walletAddress.toLowerCase());

            if (error) throw new Error(error.message);

            return data.map(d => ({
                id: d.id,
                socialId: d.social_id,
                walletAddress: d.wallet_address,
                platform: d.platform,
                verified: d.verified,
                createdAt: d.created_at,
            }));
        },

        // Outcome queries
        async outcomes(_: any, { paymentId }: { paymentId: string }) {
            const { data, error } = await supabase
                .from('outcomes')
                .select('*')
                .eq('payment_id', paymentId);

            if (error) throw new Error(error.message);

            return data.map(d => ({
                id: d.id,
                paymentId: d.payment_id,
                outcomeType: d.outcome_type,
                latencyMs: d.latency_ms,
                evidence: d.evidence,
                createdAt: d.created_at,
            }));
        },

        // Live prices from multi-DEX aggregator
        async livePrices(_: any, { symbols }: { symbols?: string[] }) {
            const pairs = symbols || ['BTC/USD', 'ETH/USD', 'CRO/USD'];

            const results = await Promise.all(
                pairs.map(async (symbol) => {
                    const price = await multiDexAggregator.getAggregatedPrice(symbol as any);
                    return {
                        symbol,
                        price: price.bestPrice,
                        source: price.bestSource,
                        sources: price.sources.map(s => ({
                            name: s.name,
                            price: s.price,
                            latencyMs: s.latencyMs,
                        })),
                        latencyMs: price.totalLatencyMs,
                        timestamp: price.aggregatedAt,
                    };
                })
            );

            return results;
        },

        // Current prices (simple)
        async currentPrices() {
            const prices = await priceAggregator.getCurrentPrices();
            return {
                btcUsd: prices.btcUsd,
                ethUsd: prices.ethUsd,
                croUsd: prices.croUsd,
                usdcUsd: prices.usdcUsd,
                timestamp: prices.timestamp,
            };
        },

        // Indexer queries
        async serviceGraph() {
            const { graphIndexer } = await import('../../services/indexer/graph-indexer.js');
            return await graphIndexer.getServiceGraph();
        },

        async serviceDependencies(_: any, { serviceId }: { serviceId: string }) {
            const { graphIndexer } = await import('../../services/indexer/graph-indexer.js');
            return await graphIndexer.getServiceDependencies(serviceId);
        },

        async serviceDependents(_: any, { serviceId }: { serviceId: string }) {
            const { graphIndexer } = await import('../../services/indexer/graph-indexer.js');
            return await graphIndexer.getServiceDependents(serviceId);
        },

        // Perp indexer queries
        async perpOpenPositions(_: any, { trader }: { trader?: string }) {
            const { perpIndexer } = await import('../../services/indexer/perp-indexer.js');
            return await perpIndexer.getOpenPositions(trader);
        },

        async perpRecentTrades(_: any, { pair, limit = 50 }: { pair?: string; limit?: number }) {
            const { perpIndexer } = await import('../../services/indexer/perp-indexer.js');
            return await perpIndexer.getRecentTrades(pair, limit);
        },

        async perpTraderStats(_: any, { trader }: { trader: string }) {
            const { perpIndexer } = await import('../../services/indexer/perp-indexer.js');
            return await perpIndexer.getTraderStats(trader);
        },

        // Task artifact queries
        async task(_: any, { taskId }: { taskId: string }) {
            const { data, error } = await supabase
                .from('task_artifacts')
                .select('*')
                .eq('task_id', taskId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') return null;
                throw new Error(error.message);
            }

            return {
                taskId: data.task_id,
                agentId: data.agent_id,
                serviceId: data.service_id,
                sessionId: data.session_id,
                state: data.state,
                paymentId: data.payment_id,
                facilitatorTx: data.facilitator_tx,
                retries: data.retries,
                createdAt: data.created_at,
                updatedAt: data.updated_at,
                completedAt: data.completed_at,
                inputs: data.inputs,
                outputs: data.outputs,
                error: data.error,
                metrics: data.metrics,
            };
        },

        async tasks(_: any, { agentId, serviceId, sessionId, state, limit = 100 }: any) {
            let query = supabase.from('task_artifacts').select('*');

            if (agentId) query = query.eq('agent_id', agentId);
            if (serviceId) query = query.eq('service_id', serviceId);
            if (sessionId) query = query.eq('session_id', sessionId);
            if (state) query = query.eq('state', state);

            query = query.order('created_at', { ascending: false }).limit(limit);

            const { data, error } = await query;
            if (error) throw new Error(error.message);

            return data.map(d => ({
                taskId: d.task_id,
                agentId: d.agent_id,
                serviceId: d.service_id,
                sessionId: d.session_id,
                state: d.state,
                paymentId: d.payment_id,
                facilitatorTx: d.facilitator_tx,
                retries: d.retries,
                createdAt: d.created_at,
                updatedAt: d.updated_at,
                completedAt: d.completed_at,
                inputs: d.inputs,
                outputs: d.outputs,
                error: d.error,
                metrics: d.metrics,
            }));
        },

        async taskStats(_: any, { agentId }: { agentId?: string }) {
            let query = supabase.from('task_artifacts').select('state, metrics');

            if (agentId) query = query.eq('agent_id', agentId);

            const { data, error } = await query;
            if (error) throw new Error(error.message);

            const total = data.length;
            const pending = data.filter(d => d.state === 'pending').length;
            const settled = data.filter(d => d.state === 'settled').length;
            const failed = data.filter(d => d.state === 'failed').length;

            const durations = data
                .filter(d => d.metrics?.total_ms)
                .map(d => d.metrics.total_ms);

            const avgDurationMs = durations.length > 0
                ? durations.reduce((a, b) => a + b, 0) / durations.length
                : 0;

            return {
                total,
                pending,
                settled,
                failed,
                successRate: total > 0 ? settled / total : 0,
                avgDurationMs: Math.round(avgDurationMs),
            };
        },
    },

    Mutation: {
        // Link identity
        async linkIdentity(_: any, { socialId, walletAddress, platform }: any) {
            const { data, error } = await supabase
                .from('identity_mappings')
                .upsert({
                    social_id: socialId.toLowerCase(),
                    wallet_address: walletAddress.toLowerCase(),
                    platform,
                    verified: false,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'social_id' })
                .select()
                .single();

            if (error) throw new Error(error.message);

            return {
                id: data.id,
                socialId: data.social_id,
                walletAddress: data.wallet_address,
                platform: data.platform,
                verified: data.verified,
                createdAt: data.created_at,
            };
        },

        // Record outcome
        async recordOutcome(_: any, { paymentId, outcomeType, latencyMs, evidence }: any) {
            const { data, error } = await supabase
                .from('outcomes')
                .insert({
                    payment_id: paymentId,
                    outcome_type: outcomeType,
                    latency_ms: latencyMs,
                    evidence,
                })
                .select()
                .single();

            if (error) throw new Error(error.message);

            return {
                id: data.id,
                paymentId: data.payment_id,
                outcomeType: data.outcome_type,
                latencyMs: data.latency_ms,
                evidence: data.evidence,
                createdAt: data.created_at,
            };
        },
    },
};

// Formatters
function formatPayment(data: any) {
    return {
        id: data.id,
        paymentId: data.payment_id,
        txHash: data.tx_hash,
        fromAddress: data.from_address,
        toAddress: data.to_address,
        amount: data.amount,
        tokenAddress: data.token_address,
        resourceUrl: data.resource_url,
        status: data.status.toUpperCase(),
        blockNumber: data.block_number,
        timestamp: data.timestamp,
    };
}

function formatAgent(data: any) {
    const total = data.successful_transactions + data.failed_transactions;
    const successRate = total > 0 ? data.successful_transactions / total : 0;

    return {
        address: data.agent_address,
        reputationScore: data.reputation_score,
        totalPaymentsSent: data.total_payments_sent,
        totalPaymentsReceived: data.total_payments_received,
        successfulTransactions: data.successful_transactions,
        failedTransactions: data.failed_transactions,
        lastActive: data.last_active,
        successRate,
    };
}

function formatActivity(data: any) {
    return {
        id: data.id,
        agentAddress: data.agent_address,
        activityType: data.activity_type,
        metadata: data.metadata,
        blockNumber: data.block_number,
        timestamp: data.timestamp,
    };
}

async function formatService(data: any) {
    const rep = Array.isArray(data.reputations) ? data.reputations[0] : data.reputations;

    // Fetch ZAUTH health status if endpoint URL exists
    let health = null;
    if (data.endpoint_url) {
        try {
            const zauthEndpoint = await zauthClient.getEndpoint(data.endpoint_url);
            if (zauthEndpoint) {
                health = {
                    status: zauthEndpoint.status,
                    successRate: zauthEndpoint.successRate,
                    lastTestedAt: zauthEndpoint.lastTestedAt,
                    reliable: zauthEndpoint.status === 'WORKING' && zauthEndpoint.successRate >= 80,
                    warning: zauthEndpoint.status === 'FLAKY' ? 'Endpoint has intermittent failures' : undefined,
                };
            } else {
                health = {
                    status: 'UNTESTED',
                    successRate: null,
                    lastTestedAt: null,
                    reliable: false,
                    warning: 'Endpoint not verified by ZAUTH',
                };
            }
        } catch (error) {
            console.error('ZAUTH lookup failed:', error);
            health = {
                status: 'UNKNOWN',
                successRate: null,
                lastTestedAt: null,
                reliable: false,
                warning: 'Could not verify endpoint health',
            };
        }
    }

    return {
        id: data.id,
        ownerAddress: data.owner_address,
        name: data.name,
        description: data.description,
        category: data.category,
        endpointUrl: data.endpoint_url,
        pricePerCall: data.price_per_call,
        isActive: data.is_active,
        createdAt: data.created_at,
        reputation: rep ? {
            totalPayments: rep.total_payments || 0,
            successfulPayments: rep.successful_payments || 0,
            failedPayments: rep.failed_payments || 0,
            avgLatencyMs: rep.avg_latency_ms || 0,
            uniquePayers: rep.unique_payers || 0,
            reputationScore: rep.reputation_score || 0,
            successRate: rep.total_payments > 0
                ? (rep.successful_payments / rep.total_payments) * 100
                : 0,
        } : null,
        health,
    };
}

async function formatVenue(data: any) {
    // Calculate real reputation from trades table
    const { data: trades } = await supabase
        .from('trades')
        .select('status, created_at, closed_at, entry_price, exit_price, size_usd')
        .eq('venue_id', data.id);

    const totalTrades = trades?.length || 0;
    const successfulTrades = trades?.filter(t => t.status === 'closed').length || 0;
    const failedTrades = trades?.filter(t => t.status === 'failed').length || 0;

    // Calculate average execution latency (time from creation to first update)
    const latencies = trades
        ?.filter(t => t.closed_at && t.created_at)
        .map(t => {
            const created = new Date(t.created_at).getTime();
            const closed = new Date(t.closed_at).getTime();
            return closed - created;
        }) || [];

    const avgLatencyMs = latencies.length > 0
        ? Math.round(latencies.reduce((sum, l) => sum + l, 0) / latencies.length)
        : 0;

    // Calculate average slippage in basis points
    const slippages = trades
        ?.filter(t => t.entry_price && t.exit_price && t.status === 'closed')
        .map(t => {
            const expectedPrice = t.entry_price;
            const actualPrice = t.exit_price;
            const slippage = Math.abs((actualPrice - expectedPrice) / expectedPrice) * 10000;
            return slippage;
        }) || [];

    const avgSlippageBps = slippages.length > 0
        ? Math.round(slippages.reduce((sum, s) => sum + s, 0) / slippages.length)
        : 0;

    // Calculate reputation score (0-100)
    // Formula: Base score from success rate, penalties for high latency/slippage
    const successRate = totalTrades > 0 ? successfulTrades / totalTrades : 0;
    const baseScore = successRate * 100;

    // Penalty for high latency (>5s = -10 points)
    const latencyPenalty = Math.min(10, (avgLatencyMs / 5000) * 10);

    // Penalty for high slippage (>50bps = -10 points)
    const slippagePenalty = Math.min(10, (avgSlippageBps / 50) * 10);

    // Bonus for high volume (logarithmic scale)
    const volumeBonus = totalTrades > 0 ? Math.min(20, Math.log10(totalTrades) * 5) : 0;

    const reputationScore = Math.max(0, Math.min(100,
        baseScore - latencyPenalty - slippagePenalty + volumeBonus
    ));

    return {
        id: data.id,
        name: data.name,
        contractAddress: data.contract_address,
        chain: data.chain,
        maxLeverage: data.max_leverage,
        tradingFeeBps: data.trading_fee_bps,
        isActive: data.is_active,
        reputation: {
            totalTrades,
            successfulTrades,
            failedTrades,
            avgLatencyMs,
            avgSlippageBps,
            reputationScore: Math.round(reputationScore * 10) / 10,
            successRate: Math.round(successRate * 1000) / 10, // percentage with 1 decimal
        },
    };
}

async function formatTrade(data: any) {
    return {
        id: data.id,
        userAddress: data.user_address,
        venue: data.dex_venues ? await formatVenue(data.dex_venues) : null,
        pair: data.pair,
        side: data.side,
        leverage: data.leverage,
        sizeUsd: data.size_usd,
        entryPrice: data.entry_price,
        exitPrice: data.exit_price,
        pnlUsd: data.pnl_usd,
        status: data.status,
        txHash: data.tx_hash,
        createdAt: data.created_at,
        closedAt: data.closed_at,
    };
}

export default resolvers;
