// ============================================
// BACKEND API HOOKS (Production)
// ============================================

import { useQuery, useMutation, invalidateQueries } from './hooks';
import { RelayApi } from '../services/api/relay-api';
import type { ServiceQueryParams, TradeQuoteRequest, TradeExecuteRequest, ClosePositionRequest } from '../types/api';

/**
 * Service Discovery - Get services with reputation scores
 */
export function useServiceDiscovery(params: ServiceQueryParams = {}) {
    return useQuery(
        `services:${JSON.stringify(params)}`,
        async () => await RelayApi.getServices(params),
        { staleTime: 60000, refetchInterval: 60000 }
    );
}

/**
 * Get reputation for a specific service
 */
export function useServiceReputation(serviceId: string) {
    return useQuery(
        `reputation:${serviceId}`,
        async () => await RelayApi.getReputation(serviceId),
        { enabled: !!serviceId, staleTime: 300000 }
    );
}

/**
 * Get service rankings leaderboard
 */
export function useServiceRankings(category?: string) {
    return useQuery(
        `rankings:${category || 'all'}`,
        async () => await RelayApi.getRankings(category),
        { staleTime: 60000, refetchInterval: 60000 }
    );
}

/**
 * Create a new service (mutation)
 */
export function useCreateService() {
    return useMutation(
        async (request: any) => {
            const result = await RelayApi.createService(request);
            if (result.error) throw new Error(result.error);
            return result.data;
        },
        {
            onSuccess: () => {
                invalidateQueries(['services']);
            }
        }
    );
}

/**
 * Get trade quote from best venue
 */
export function useTradeQuote(request: TradeQuoteRequest | null) {
    return useQuery(
        `quote:${JSON.stringify(request)}`,
        async () => {
            if (!request) return { data: null, error: null, requestId: '', cached: false, latency: 0 };
            return await RelayApi.getTradeQuote(request);
        },
        { enabled: !!request, staleTime: 10000 }
    );
}

/**
 * Execute trade (mutation)
 */
export function useTradeExecution() {
    return useMutation(
        async (request: TradeExecuteRequest) => {
            const result = await RelayApi.executeTrade(request);
            if (result.error) throw new Error(result.error);
            return result.data;
        },
        {
            onSuccess: () => {
                invalidateQueries(['positions', 'trades']);
            }
        }
    );
}

/**
 * Close position (mutation)
 */
export function useClosePosition() {
    return useMutation(
        async (request: ClosePositionRequest) => {
            const result = await RelayApi.closePosition(request);
            if (result.error) throw new Error(result.error);
            return result.data;
        },
        {
            onSuccess: () => {
                invalidateQueries(['positions', 'trades']);
            }
        }
    );
}

/**
 * Get user's open positions
 */
export function useOpenPositions(userAddress: string | undefined) {
    return useQuery(
        `positions:${userAddress}`,
        async () => {
            if (!userAddress) return { data: null, error: null, requestId: '', cached: false, latency: 0 };
            return await RelayApi.getUserPositions(userAddress);
        },
        { enabled: !!userAddress, refetchInterval: 30000 }
    );
}
