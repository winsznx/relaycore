import { apiClient, type ApiResponse } from '../../lib/api-client.js';
import { supabase } from '../../lib/supabase.js';
import { reputationEngine } from '../reputation/reputation-engine.js';
import { tradeRouter } from '../perpai/trade-router.js';
import type {
    ServiceQueryParams, ServiceResponse, CreateServiceRequest,
    TradeQuoteRequest, TradeExecuteRequest, TradeQuoteResponse, TradeExecuteResponse,
    ClosePositionRequest, ClosePositionResponse
} from '../../types/api';



export const RelayApi = {
    // ============================================
    // SERVICE DISCOVERY
    // ============================================

    async getServices(params: ServiceQueryParams = {}): Promise<ApiResponse<ServiceResponse>> {
        try {
            let query = supabase
                .from('services')
                .select('*, reputations(*)')
                .eq('is_active', true);

            if (params.category) query = query.eq('category', params.category);
            if (params.minReputation) query = query.gte('reputations.reputation_score', params.minReputation);
            if (params.maxPrice) query = query.lte('price_per_call', params.maxPrice);

            const sortColumn = params.sortBy === 'price' ? 'price_per_call' : 'reputations.reputation_score';
            query = query.order(sortColumn, { ascending: params.sortBy === 'price' });

            if (params.limit) query = query.limit(params.limit);
            if (params.offset) query = query.range(params.offset, params.offset + (params.limit || 10) - 1);

            const { data, error } = await query;

            if (error) throw error;

            const services = (data || []).map(s => ({
                id: s.id,
                name: s.name,
                description: s.description,
                category: s.category,
                endpointUrl: s.endpoint_url,
                pricePerCall: parseFloat(s.price_per_call),
                currency: s.currency,
                reputation: {
                    score: s.reputations?.[0]?.reputation_score || 0,
                    successRate: s.reputations?.[0]?.success_rate || 0,
                    totalPayments: s.reputations?.[0]?.total_payments || 0,
                    avgLatencyMs: s.reputations?.[0]?.avg_latency_ms || 0
                },
                lastActive: s.last_active
            }));

            return {
                data: {
                    services,
                    total: services.length,
                    page: Math.floor((params.offset || 0) / (params.limit || 10)),
                    pageSize: params.limit || 10
                },
                error: null,
                requestId: crypto.randomUUID(),
                cached: false,
                latency: 0
            };
        } catch (error: any) {
            return {
                data: null,
                error: error.message,
                requestId: crypto.randomUUID(),
                cached: false,
                latency: 0
            };
        }
    },

    async createService(request: CreateServiceRequest): Promise<ApiResponse<{ serviceId: string }>> {
        try {
            const { data, error } = await supabase
                .from('services')
                .insert({
                    owner_address: request.ownerAddress,
                    name: request.name,
                    description: request.description,
                    category: request.category,
                    endpoint_url: request.endpointUrl,
                    price_per_call: request.pricePerCall,
                    currency: request.currency,
                    metadata: request.metadata || {}
                })
                .select()
                .single();

            if (error) throw error;

            return {
                data: { serviceId: data.id },
                error: null,
                requestId: crypto.randomUUID(),
                cached: false,
                latency: 0
            };
        } catch (error: any) {
            return {
                data: null,
                error: error.message,
                requestId: crypto.randomUUID(),
                cached: false,
                latency: 0
            };
        }
    },

    // ============================================
    // REPUTATION
    // ============================================

    async getReputation(serviceId: string) {
        try {
            const score = await reputationEngine.calculateReputation(serviceId);
            return {
                data: score,
                error: null,
                requestId: crypto.randomUUID(),
                cached: false,
                latency: 0
            };
        } catch (error: any) {
            return {
                data: null,
                error: error.message,
                requestId: crypto.randomUUID(),
                cached: false,
                latency: 0
            };
        }
    },

    async getRankings(category?: string) {
        try {
            const { data, error } = await reputationEngine.getTopServices(category, 100);

            if (error) throw error;

            const rankings = (data || []).map((s, index) => ({
                rank: index + 1,
                serviceId: s.id,
                serviceName: s.name,
                category: s.category,
                reputationScore: s.reputations?.[0]?.reputation_score || 0,
                successRate: s.reputations?.[0]?.success_rate || 0,
                totalPayments: s.reputations?.[0]?.total_payments || 0
            }));

            return {
                data: { rankings, updatedAt: new Date().toISOString() },
                error: null,
                requestId: crypto.randomUUID(),
                cached: false,
                latency: 0
            };
        } catch (error: any) {
            return {
                data: null,
                error: error.message,
                requestId: crypto.randomUUID(),
                cached: false,
                latency: 0
            };
        }
    },

    // ============================================
    // TRADING
    // ============================================

    async getTradeQuote(request: TradeQuoteRequest): Promise<ApiResponse<TradeQuoteResponse>> {
        try {
            const quote = await tradeRouter.getQuote(request);
            return {
                data: quote,
                error: null,
                requestId: crypto.randomUUID(),
                cached: false,
                latency: 0
            };
        } catch (error: any) {
            return {
                data: null,
                error: error.message,
                requestId: crypto.randomUUID(),
                cached: false,
                latency: 0
            };
        }
    },

    async executeTrade(request: TradeExecuteRequest): Promise<ApiResponse<TradeExecuteResponse>> {
        try {
            const result = await tradeRouter.executeTrade(request);
            return {
                data: result,
                error: null,
                requestId: crypto.randomUUID(),
                cached: false,
                latency: 0
            };
        } catch (error: any) {
            return {
                data: null,
                error: error.message,
                requestId: crypto.randomUUID(),
                cached: false,
                latency: 0
            };
        }
    },

    async closePosition(request: ClosePositionRequest): Promise<ApiResponse<ClosePositionResponse>> {
        try {
            const result = await tradeRouter.closePosition(request.tradeId, request.userAddress);
            return {
                data: result,
                error: null,
                requestId: crypto.randomUUID(),
                cached: false,
                latency: 0
            };
        } catch (error: any) {
            return {
                data: null,
                error: error.message,
                requestId: crypto.randomUUID(),
                cached: false,
                latency: 0
            };
        }
    },

    async getUserPositions(userAddress: string) {
        try {
            const { data, error } = await supabase
                .from('trades')
                .select('*, dex_venues(name)')
                .eq('user_address', userAddress)
                .eq('status', 'open')
                .order('created_at', { ascending: false });

            if (error) throw error;

            const positions = (data || []).map(t => ({
                id: t.id,
                venue: t.dex_venues?.name || 'Unknown',
                pair: t.pair,
                side: t.side,
                leverage: parseFloat(t.leverage),
                sizeUsd: parseFloat(t.size_usd),
                entryPrice: parseFloat(t.entry_price),
                currentPrice: parseFloat(t.entry_price) * 1.02, // Placeholder
                pnl: 0, // Calculate from current price
                pnlPercentage: 0,
                liquidationPrice: parseFloat(t.liquidation_price),
                openedAt: t.created_at
            }));

            return {
                data: { positions },
                error: null,
                requestId: crypto.randomUUID(),
                cached: false,
                latency: 0
            };
        } catch (error: any) {
            return {
                data: null,
                error: error.message,
                requestId: crypto.randomUUID(),
                cached: false,
                latency: 0
            };
        }
    },

    // ============================================
    // LEGACY METHODS
    // ============================================

    async getRecentTrades(limit = 10) {
        return apiClient.query('trades', {
            select: '*, dex_venues(name)',
            order: { column: 'created_at', ascending: false },
            limit,
            cache: true,
            cacheTTL: 30000
        });
    },

    async getVenues() {
        return apiClient.query('dex_venues', {
            select: '*, reputations(*)',
            filter: { is_active: true },
            order: { column: 'name', ascending: true },
            cache: true,
            cacheTTL: 60000
        });
    },

    invalidateCache(pattern?: string) {
        apiClient.invalidateCache(pattern);
    },

    get raw() {
        return apiClient.raw;
    },

    // ============================================
    // ESCROW SESSIONS (ACPS)
    // ============================================

    async getSession(sessionId: number) {
        try {
            const { data, error } = await supabase
                .from('escrow_sessions')
                .select('*')
                .eq('session_id', sessionId)
                .single();

            if (error) throw error;

            return {
                data: {
                    sessionId: data.session_id,
                    owner: data.owner_address,
                    deposited: data.deposited,
                    released: data.released,
                    remaining: parseFloat(data.deposited) - parseFloat(data.released),
                    maxSpend: data.max_spend,
                    expiry: new Date(data.expires_at).getTime() / 1000,
                    active: data.status === 'active',
                    authorizedAgents: data.authorized_agents
                },
                error: null,
                requestId: crypto.randomUUID()
            };
        } catch (error: any) {
            return { data: null, error: error.message, requestId: crypto.randomUUID() };
        }
    },

    async checkSessionAllowance(sessionId: number, agentAddress: string, amount: string) {
        try {
            const { data, error } = await supabase
                .rpc('check_session_allowance', {
                    p_session_id: sessionId,
                    p_agent_address: agentAddress,
                    p_amount: parseFloat(amount)
                });

            if (error) throw error;

            const result = data?.[0] || { allowed: false, reason: 'Unknown', remaining: 0 };
            return {
                data: {
                    allowed: result.allowed,
                    reason: result.reason,
                    remaining: result.remaining
                },
                error: null,
                requestId: crypto.randomUUID()
            };
        } catch (error: any) {
            return { data: null, error: error.message, requestId: crypto.randomUUID() };
        }
    },

    async getSessionPayments(sessionId: number, limit = 20) {
        try {
            const { data, error } = await supabase
                .from('escrow_payments')
                .select('*')
                .eq('session_id', sessionId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;

            return {
                data: {
                    payments: data || [],
                    count: data?.length || 0
                },
                error: null,
                requestId: crypto.randomUUID()
            };
        } catch (error: any) {
            return { data: null, error: error.message, requestId: crypto.randomUUID() };
        }
    },

    async recordSessionPayment(sessionId: number, agentAddress: string, amount: string, executionId: string, txHash: string) {
        try {
            const { error: paymentError } = await supabase
                .from('escrow_payments')
                .insert({
                    session_id: sessionId,
                    agent_address: agentAddress,
                    amount: parseFloat(amount),
                    execution_id: executionId,
                    tx_hash: txHash
                });

            if (paymentError) throw paymentError;

            // Update session released amount
            const { data: session } = await supabase
                .from('escrow_sessions')
                .select('released')
                .eq('session_id', sessionId)
                .single();

            const newReleased = parseFloat(session?.released || '0') + parseFloat(amount);

            await supabase
                .from('escrow_sessions')
                .update({ released: newReleased })
                .eq('session_id', sessionId);

            return {
                data: { success: true, txHash },
                error: null,
                requestId: crypto.randomUUID()
            };
        } catch (error: any) {
            return { data: null, error: error.message, requestId: crypto.randomUUID() };
        }
    },

    async closeSession(sessionId: number, refundTxHash?: string) {
        try {
            const { error } = await supabase
                .from('escrow_sessions')
                .update({
                    status: 'closed',
                    closed_at: new Date().toISOString()
                })
                .eq('session_id', sessionId);

            if (error) throw error;

            if (refundTxHash) {
                const { data: session } = await supabase
                    .from('escrow_sessions')
                    .select('deposited, released')
                    .eq('session_id', sessionId)
                    .single();

                const refundAmount = parseFloat(session?.deposited || '0') - parseFloat(session?.released || '0');

                await supabase.from('escrow_refunds').insert({
                    session_id: sessionId,
                    amount: refundAmount,
                    tx_hash: refundTxHash
                });
            }

            return {
                data: { success: true },
                error: null,
                requestId: crypto.randomUUID()
            };
        } catch (error: any) {
            return { data: null, error: error.message, requestId: crypto.randomUUID() };
        }
    }
};

export type { ApiResponse };
