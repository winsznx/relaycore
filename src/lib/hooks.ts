/**
 * Production-grade React Hooks for Data Fetching
 * 
 * Features:
 * - SWR-like stale-while-revalidate pattern
 * - Optimistic updates
 * - Automatic refetching
 * - Error boundaries integration
 * - Loading states with skeleton support
 * - Real-time subscriptions
 * - Prefetching
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient, type ApiResponse, type ApiError } from './api-client';

// ============================================
// TYPES
// ============================================

export interface UseQueryOptions<T> {
    enabled?: boolean;
    refetchInterval?: number;
    refetchOnWindowFocus?: boolean;
    staleTime?: number;
    cacheTime?: number;
    onSuccess?: (data: T) => void;
    onError?: (error: ApiError) => void;
    retry?: boolean;
    initialData?: T;
}

export interface UseQueryResult<T> {
    data: T | null;
    error: ApiError | null;
    isLoading: boolean;
    isRefetching: boolean;
    isError: boolean;
    isSuccess: boolean;
    refetch: () => Promise<void>;
    requestId: string | null;
}

export interface UseMutationOptions<TData, TVariables> {
    onSuccess?: (data: TData, variables: TVariables) => void;
    onError?: (error: ApiError, variables: TVariables) => void;
    onSettled?: (data: TData | null, error: ApiError | null, variables: TVariables) => void;
    optimisticUpdate?: (variables: TVariables) => TData;
    invalidateQueries?: string[];
}

export interface UseMutationResult<TData, TVariables> {
    mutate: (variables: TVariables) => Promise<TData | null>;
    mutateAsync: (variables: TVariables) => Promise<TData>;
    data: TData | null;
    error: ApiError | null;
    isLoading: boolean;
    isError: boolean;
    isSuccess: boolean;
    reset: () => void;
}

// ============================================
// QUERY CACHE (Global)
// ============================================

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    staleTime: number;
}

const queryCache = new Map<string, CacheEntry<any>>();
const querySubscribers = new Map<string, Set<() => void>>();

function notifySubscribers(queryKey: string): void {
    querySubscribers.get(queryKey)?.forEach(callback => callback());
}

export function invalidateQueries(patterns: string[]): void {
    for (const pattern of patterns) {
        for (const key of queryCache.keys()) {
            if (key.includes(pattern)) {
                queryCache.delete(key);
                notifySubscribers(key);
            }
        }
    }
}

// ============================================
// useQuery Hook - SIMPLIFIED and STABLE
// ============================================

export function useQuery<T>(
    queryKey: string,
    queryFn: () => Promise<ApiResponse<T>>,
    options: UseQueryOptions<T> = {}
): UseQueryResult<T> {
    const {
        enabled = true,
        refetchInterval,
        refetchOnWindowFocus = false, // Disabled by default to reduce complexity
        staleTime = 30000,
        onSuccess,
        onError,
        initialData,
    } = options;

    const [data, setData] = useState<T | null>(initialData ?? null);
    const [error, setError] = useState<ApiError | null>(null);
    const [isLoading, setIsLoading] = useState(!initialData && enabled);
    const [isRefetching, setIsRefetching] = useState(false);
    const [requestId, setRequestId] = useState<string | null>(null);

    const mountedRef = useRef(true);
    const queryFnRef = useRef(queryFn);
    const onSuccessRef = useRef(onSuccess);
    const onErrorRef = useRef(onError);
    const fetchingRef = useRef(false);

    // Keep refs updated
    useEffect(() => {
        queryFnRef.current = queryFn;
        onSuccessRef.current = onSuccess;
        onErrorRef.current = onError;
    });

    // Stable fetch function using refs
    const fetchData = useCallback(async (isRefetch = false) => {
        if (!enabled || fetchingRef.current) return;

        // Check cache first
        const cached = queryCache.get(queryKey);
        const now = Date.now();

        if (cached && now - cached.timestamp < cached.staleTime) {
            if (!isRefetch) {
                setData(cached.data);
                setIsLoading(false);
                setError(null);
            }
            return;
        }

        fetchingRef.current = true;

        if (!isRefetch && !data) {
            setIsLoading(true);
        }
        if (isRefetch) {
            setIsRefetching(true);
        }

        try {
            const response = await queryFnRef.current();

            if (!mountedRef.current) return;

            if (response.error) {
                setError(response.error);
                setIsLoading(false);
                setIsRefetching(false);
                setRequestId(response.requestId);
                onErrorRef.current?.(response.error);
            } else {
                // Update cache
                queryCache.set(queryKey, {
                    data: response.data,
                    timestamp: Date.now(),
                    staleTime,
                });

                setData(response.data);
                setError(null);
                setIsLoading(false);
                setIsRefetching(false);
                setRequestId(response.requestId);
                onSuccessRef.current?.(response.data!);
            }
        } catch (err) {
            if (!mountedRef.current) return;
            setError({ message: (err as Error).message, code: 'FETCH_ERROR', status: 500 });
            setIsLoading(false);
            setIsRefetching(false);
        } finally {
            fetchingRef.current = false;
        }
    }, [queryKey, enabled, staleTime, data]);

    // Initial fetch - only when enabled changes or queryKey changes
    useEffect(() => {
        if (enabled) {
            fetchData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [queryKey, enabled]);

    // Refetch interval
    useEffect(() => {
        if (!refetchInterval || !enabled) return;

        const intervalId = window.setInterval(() => {
            fetchData(true);
        }, refetchInterval);

        return () => window.clearInterval(intervalId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refetchInterval, enabled, queryKey]);

    // Window focus refetch
    useEffect(() => {
        if (!refetchOnWindowFocus) return;

        const handleFocus = () => {
            const cached = queryCache.get(queryKey);
            if (!cached || Date.now() - cached.timestamp > staleTime) {
                fetchData(true);
            }
        };

        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refetchOnWindowFocus, queryKey, staleTime]);

    // Cleanup
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    // Stable refetch function
    const refetch = useCallback(() => fetchData(true), [fetchData]);

    return {
        data,
        error,
        isLoading,
        isRefetching,
        isError: error !== null,
        isSuccess: data !== null && error === null,
        refetch,
        requestId,
    };
}

// ============================================
// useMutation Hook
// ============================================

export function useMutation<TData, TVariables>(
    mutationFn: (variables: TVariables) => Promise<ApiResponse<TData>>,
    options: UseMutationOptions<TData, TVariables> = {}
): UseMutationResult<TData, TVariables> {
    const { onSuccess, onError, onSettled, invalidateQueries: invalidateKeys } = options;

    const [state, setState] = useState<{
        data: TData | null;
        error: ApiError | null;
        isLoading: boolean;
    }>({
        data: null,
        error: null,
        isLoading: false,
    });

    const mutationFnRef = useRef(mutationFn);
    const optionsRef = useRef({ onSuccess, onError, onSettled, invalidateKeys });

    useEffect(() => {
        mutationFnRef.current = mutationFn;
        optionsRef.current = { onSuccess, onError, onSettled, invalidateKeys };
    });

    const mutateAsync = useCallback(async (variables: TVariables): Promise<TData> => {
        setState({ data: null, error: null, isLoading: true });

        const response = await mutationFnRef.current(variables);

        if (response.error) {
            setState({ data: null, error: response.error, isLoading: false });
            optionsRef.current.onError?.(response.error, variables);
            optionsRef.current.onSettled?.(null, response.error, variables);
            throw response.error;
        }

        setState({ data: response.data, error: null, isLoading: false });
        optionsRef.current.onSuccess?.(response.data!, variables);
        optionsRef.current.onSettled?.(response.data, null, variables);

        // Invalidate queries
        if (optionsRef.current.invalidateKeys) {
            invalidateQueries(optionsRef.current.invalidateKeys);
        }

        return response.data!;
    }, []);

    const mutate = useCallback(async (variables: TVariables): Promise<TData | null> => {
        try {
            return await mutateAsync(variables);
        } catch {
            return null;
        }
    }, [mutateAsync]);

    const reset = useCallback(() => {
        setState({ data: null, error: null, isLoading: false });
    }, []);

    return {
        mutate,
        mutateAsync,
        data: state.data,
        error: state.error,
        isLoading: state.isLoading,
        isError: state.error !== null,
        isSuccess: state.data !== null,
        reset,
    };
}

// ============================================
// DOMAIN-SPECIFIC HOOKS - Using stable queryFn
// ============================================

import type { TradeExecuteRequest } from '../types/api';

// Trade execution hook
export function useExecuteTrade() {
    return useMutation<any, TradeExecuteRequest>(
        async (request) => {
            // Use RelayApi which directly calls tradeRouter
            const { RelayApi } = await import('../services/api/relay-api');
            return RelayApi.executeTrade(request);
        },
        {
            invalidateQueries: ['trades'],
            onSuccess: (data) => {
                console.log('Trade executed:', data);
            },
        }
    );
}

// Venues query hook
export function useVenues() {
    const queryFn = useCallback(async () => {
        return apiClient.query('dex_venues', {
            select: '*, reputations(*)',
            filter: { is_active: true },
            cache: true,
            cacheTTL: 60000,
        });
    }, []);

    return useQuery('venues', queryFn, {
        staleTime: 60000,
        refetchInterval: 120000,
    });
}

// Recent trades hook
export function useRecentTrades(limit = 10) {
    const queryFn = useCallback(async () => {
        return apiClient.query('trades', {
            select: '*, dex_venues(name)',
            order: { column: 'created_at', ascending: false },
            limit,
            cache: true,
            cacheTTL: 30000,
        });
    }, [limit]);

    return useQuery(`trades:recent:${limit}`, queryFn, {
        staleTime: 30000,
        refetchInterval: 60000,
    });
}

// Services discovery hook
export function useServices(category?: string) {
    const queryFn = useCallback(async () => {
        const filter = category ? { category, is_active: true } : { is_active: true };
        return apiClient.query('services', {
            select: '*, reputations(*)',
            filter,
            order: { column: 'created_at', ascending: false },
            cache: true,
        });
    }, [category]);

    return useQuery(`services:${category || 'all'}`, queryFn, {
        staleTime: 60000,
    });
}

// User's services hook (My Agents)
export function useUserServices(userAddress: string | null) {
    const queryFn = useCallback(async () => {
        if (!userAddress) {
            return { data: [], error: null, requestId: '', cached: false, latency: 0 };
        }
        return apiClient.query('services', {
            select: '*, reputations(*)',
            filter: { owner_address: userAddress },
            order: { column: 'created_at', ascending: false },
            cache: true,
        });
    }, [userAddress]);

    return useQuery(`services:owner:${userAddress}`, queryFn, {
        enabled: !!userAddress,
        staleTime: 30000,
    });
}

// User's trades hook
export function useUserTrades(userAddress: string | null) {
    const queryFn = useCallback(async () => {
        if (!userAddress) {
            return { data: [], error: null, requestId: '', cached: false, latency: 0 };
        }
        return apiClient.query('trades', {
            filter: { user_address: userAddress },
            order: { column: 'created_at', ascending: false },
            cache: true,
        });
    }, [userAddress]);

    return useQuery(`user-trades:${userAddress}`, queryFn, {
        enabled: !!userAddress,
        staleTime: 30000,
    });
}

// Dashboard stats hook
export function useDashboardStats() {
    const queryFn = useCallback(async () => {
        return apiClient.query('daily_stats', {
            order: { column: 'date', ascending: false },
            limit: 30,
            cache: true,
            cacheTTL: 300000,
        });
    }, []);

    return useQuery('dashboard-stats', queryFn, {
        staleTime: 300000,
    });
}

// Live price feeds hook - queries Pyth + DEXes via GraphQL
export function useLivePrices(symbols: string[] = ['BTC/USD', 'ETH/USD', 'CRO/USD']) {
    const symbolsKey = symbols.join(',');

    const queryFn = useCallback(async () => {
        // Query GraphQL for live prices from multi-DEX aggregator
        const response = await fetch('/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: `
                    query LivePrices($symbols: [String!]) {
                        livePrices(symbols: $symbols) {
                            symbol
                            price
                            source
                            sources {
                                name
                                price
                                latencyMs
                            }
                            latencyMs
                            timestamp
                        }
                    }
                `,
                variables: { symbols },
            }),
        });

        const json = await response.json();

        if (json.errors) {
            return {
                data: null,
                error: { message: json.errors[0].message, code: 'GRAPHQL_ERROR', status: 400 },
                requestId: '',
                cached: false,
                latency: 0,
            };
        }

        return {
            data: json.data.livePrices,
            error: null,
            requestId: '',
            cached: false,
            latency: 0,
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [symbolsKey]);

    return useQuery(`live-prices:${symbolsKey}`, queryFn, {
        refetchInterval: 10000, // 10 seconds - real-time
        staleTime: 5000,
    });
}

// Simple current prices hook
export function useCurrentPrices() {
    const queryFn = useCallback(async () => {
        const response = await fetch('/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: `{ currentPrices { btcUsd ethUsd croUsd usdcUsd timestamp } }`,
            }),
        });

        const json = await response.json();

        return {
            data: json.data?.currentPrices || null,
            error: json.errors?.[0] || null,
            requestId: '',
            cached: false,
            latency: 0,
        };
    }, []);

    return useQuery('current-prices', queryFn, {
        refetchInterval: 15000,
        staleTime: 10000,
    });
}

// Legacy price feeds hook (database) - kept for backward compatibility
export function usePriceFeeds(pairs: string[]) {
    // Redirect to live prices
    const symbols = pairs.map(p => p.replace('-', '/'));
    return useLivePrices(symbols);
}

// Analytics overview hook
export function useAnalytics(type: 'overview' | 'venues' = 'overview', days = 30) {
    const queryFn = useCallback(async () => {
        return apiClient.request(`analytics?type=${type}&days=${days}`, {
            method: 'GET',
            cache: true,
            cacheTTL: 60000,
        });
    }, [type, days]);

    return useQuery(`analytics:${type}:${days}`, queryFn, {
        staleTime: 60000,
        refetchInterval: 120000,
    });
}

// User-specific analytics hook
export function useUserAnalytics(userAddress: string | null) {
    const queryFn = useCallback(async () => {
        if (!userAddress) {
            return { data: null, error: null, requestId: '', cached: false, latency: 0 };
        }
        return apiClient.request(`analytics?type=user&userAddress=${userAddress}`, {
            method: 'GET',
            cache: true,
            cacheTTL: 30000,
        });
    }, [userAddress]);

    return useQuery(`analytics:user:${userAddress}`, queryFn, {
        enabled: !!userAddress,
        staleTime: 30000,
    });
}

// User agents hook
export function useUserAgents(userAddress: string | null) {
    const queryFn = useCallback(async () => {
        if (!userAddress) {
            return { data: [], error: null, requestId: '', cached: false, latency: 0 };
        }
        return apiClient.query('agents', {
            filter: { owner_address: userAddress.toLowerCase() },
            order: { column: 'created_at', ascending: false },
            cache: true,
        });
    }, [userAddress]);

    return useQuery(`agents:owner:${userAddress}`, queryFn, {
        enabled: !!userAddress,
        staleTime: 30000,
    });
}

// Identity resolution hooks
export function useWalletIdentities(walletAddress: string | null) {
    const queryFn = useCallback(async () => {
        if (!walletAddress) {
            return { data: { identities: [] }, error: null, requestId: '', cached: false, latency: 0 };
        }
        return apiClient.request(`identity?wallet=${walletAddress}`, {
            method: 'GET',
            cache: true,
            cacheTTL: 60000,
        });
    }, [walletAddress]);

    return useQuery(`identities:wallet:${walletAddress}`, queryFn, {
        enabled: !!walletAddress,
        staleTime: 60000,
    });
}

// Link identity mutation
export function useLinkIdentity() {
    return useMutation<any, { socialId: string; walletAddress: string; platform: string; displayName?: string }>(
        async (data) => {
            return apiClient.request('identity', {
                method: 'POST',
                body: data,
                cache: false,
            });
        },
        {
            invalidateQueries: ['identities'],
        }
    );
}

// Register service mutation
export function useRegisterService() {
    return useMutation<any, {
        name: string;
        description?: string;
        category: string;
        owner_address: string;
        endpoint_url?: string;
        price_per_call?: number;
    }>(
        async (data) => {
            return apiClient.request('services', {
                method: 'POST',
                body: data,
                cache: false,
            });
        },
        {
            invalidateQueries: ['services'],
            onSuccess: (data) => {
                console.log('Service registered:', data);
            },
        }
    );
}

// Create agent mutation
export function useCreateAgent() {
    return useMutation<any, {
        name: string;
        description?: string;
        agent_type: string;
        owner_address: string;
        config?: Record<string, any>;
    }>(
        async (data) => {
            // Direct insert via raw client
            const { raw } = apiClient;
            const result = await raw.from('agents').insert({
                owner_address: data.owner_address.toLowerCase(),
                name: data.name,
                description: data.description || '',
                agent_type: data.agent_type,
                config: data.config || {},
                status: 'paused',
            }).select().single();

            return {
                data: result.data,
                error: result.error ? {
                    message: result.error.message,
                    code: result.error.code,
                    status: 500,
                    details: { raw: result.error.details }
                } : null,
                requestId: '',
                cached: false,
                latency: 0
            } as ApiResponse<any>;
        },
        {
            invalidateQueries: ['agents'],
        }
    );
}

// User positions hook (open trades)
export function useUserPositions(userAddress: string | null) {
    const queryFn = useCallback(async () => {
        if (!userAddress) {
            return { data: [], error: null, requestId: '', cached: false, latency: 0 };
        }
        return apiClient.query('trades', {
            select: '*, dex_venues(name)',
            filter: { user_address: userAddress.toLowerCase(), status: 'open' },
            order: { column: 'created_at', ascending: false },
            cache: true,
            cacheTTL: 15000,
        });
    }, [userAddress]);

    return useQuery(`positions:${userAddress}`, queryFn, {
        enabled: !!userAddress,
        staleTime: 15000,
        refetchInterval: 30000,
    });
}

// ============================================
// REAL-TIME HOOKS
// ============================================

import { priceFeedSubscription, positionTracker, supabaseRealtime } from './realtime';
import { orderManager, dcaManager, type StopLossOrder, type TakeProfitOrder, type DCAConfig } from './trading-features';
import { cryptoComAIService, type PriceFeed } from './blockchain/crypto-com-sdk';

/**
 * Hook for real-time price feed subscriptions
 */
export function useRealtimePrices(pairs: string[]) {
    const [prices, setPrices] = useState<Record<string, PriceFeed>>({});
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        if (pairs.length === 0) return;

        setIsConnected(true);
        const unsubscribe = priceFeedSubscription.subscribe(pairs, (newPrices) => {
            setPrices(newPrices);
        });

        return () => {
            unsubscribe();
            setIsConnected(false);
        };
    }, [pairs.join(',')]);

    return { prices, isConnected };
}

/**
 * Hook for real-time position PnL tracking
 */
export function usePositionPnL(positions: any[]) {
    const [trackedPositions, setTrackedPositions] = useState<any[]>([]);

    useEffect(() => {
        if (positions.length === 0) {
            setTrackedPositions([]);
            return;
        }

        positionTracker.startTracking(positions);
        const unsubscribe = positionTracker.subscribe((updated) => {
            setTrackedPositions(updated);
        });

        return () => {
            unsubscribe();
            positionTracker.stopTracking();
        };
    }, [JSON.stringify(positions.map(p => p.id))]);

    return trackedPositions;
}

/**
 * Hook for Supabase realtime trade updates
 */
export function useRealtimeTrades(userAddress: string | null) {
    const [latestTrade, setLatestTrade] = useState<any>(null);

    useEffect(() => {
        if (!userAddress) return;

        const unsubscribe = supabaseRealtime.subscribeToTrades(userAddress, (trade) => {
            setLatestTrade(trade);
        });

        return () => unsubscribe();
    }, [userAddress]);

    return latestTrade;
}

// ============================================
// ADVANCED TRADING HOOKS
// ============================================

/**
 * Hook for managing stop-loss orders
 */
export function useStopLoss() {
    const createStopLoss = useCallback((params: {
        positionKey: string;
        pair: string;
        side: 'long' | 'short';
        triggerPrice: number;
        sizePercent?: number;
    }): StopLossOrder => {
        return orderManager.createStopLoss(params);
    }, []);

    const cancelStopLoss = useCallback((orderId: string): boolean => {
        return orderManager.cancelOrder(orderId);
    }, []);

    const getStopLossOrders = useCallback((positionKey: string) => {
        return orderManager.getOrdersForPosition(positionKey).stopLoss;
    }, []);

    return { createStopLoss, cancelStopLoss, getStopLossOrders };
}

/**
 * Hook for managing take-profit orders
 */
export function useTakeProfit() {
    const createTakeProfit = useCallback((params: {
        positionKey: string;
        pair: string;
        side: 'long' | 'short';
        triggerPrice: number;
        sizePercent?: number;
    }): TakeProfitOrder => {
        return orderManager.createTakeProfit(params);
    }, []);

    const cancelTakeProfit = useCallback((orderId: string): boolean => {
        return orderManager.cancelOrder(orderId);
    }, []);

    const getTakeProfitOrders = useCallback((positionKey: string) => {
        return orderManager.getOrdersForPosition(positionKey).takeProfit;
    }, []);

    return { createTakeProfit, cancelTakeProfit, getTakeProfitOrders };
}

/**
 * Hook for managing trailing stop orders
 */
export function useTrailingStop() {
    const createTrailingStop = useCallback((params: {
        positionKey: string;
        pair: string;
        side: 'long' | 'short';
        trailingPercent: number;
        currentPrice: number;
        sizePercent?: number;
    }) => {
        return orderManager.createTrailingStop(params);
    }, []);

    const cancelTrailingStop = useCallback((orderId: string): boolean => {
        return orderManager.cancelOrder(orderId);
    }, []);

    const getTrailingStopOrders = useCallback((positionKey: string) => {
        return orderManager.getOrdersForPosition(positionKey).trailingStop;
    }, []);

    return { createTrailingStop, cancelTrailingStop, getTrailingStopOrders };
}

/**
 * Hook for DCA (Dollar Cost Averaging) management
 */
export function useDCA() {
    const [dcaConfigs, setDcaConfigs] = useState<DCAConfig[]>([]);

    // Load configs on mount
    useEffect(() => {
        setDcaConfigs(dcaManager.getAllDCAs());
    }, []);

    const createDCA = useCallback((params: {
        pair: string;
        side: 'long' | 'short';
        totalAmount: number;
        numOrders: number;
        interval: 'hourly' | 'daily' | 'weekly';
        leverage: number;
    }): DCAConfig => {
        const config = dcaManager.createDCA(params);
        setDcaConfigs(dcaManager.getAllDCAs());
        return config;
    }, []);

    const pauseDCA = useCallback((id: string): boolean => {
        const result = dcaManager.pauseDCA(id);
        setDcaConfigs(dcaManager.getAllDCAs());
        return result;
    }, []);

    const resumeDCA = useCallback((id: string): boolean => {
        const result = dcaManager.resumeDCA(id);
        setDcaConfigs(dcaManager.getAllDCAs());
        return result;
    }, []);

    const cancelDCA = useCallback((id: string): boolean => {
        const result = dcaManager.cancelDCA(id);
        setDcaConfigs(dcaManager.getAllDCAs());
        return result;
    }, []);

    return {
        dcaConfigs,
        createDCA,
        pauseDCA,
        resumeDCA,
        cancelDCA
    };
}

// ============================================
// BLOCKCHAIN HOOKS
// ============================================

import { x402PaymentService } from './blockchain/x402-facilitator';
import { moonlanderIntegration } from './blockchain/moonlander';

/**
 * Hook for x402 payment execution
 */
export function useX402Payment() {
    const [isExecuting, setIsExecuting] = useState(false);
    const [lastResult, setLastResult] = useState<any>(null);
    const [error, setError] = useState<Error | null>(null);

    const executePayment = useCallback(async (params: {
        serviceId: string;
        amount: string;
        receiverAddress: string;
        signer: any;
    }) => {
        setIsExecuting(true);
        setError(null);

        try {
            const result = await x402PaymentService.executePayment(params);
            setLastResult(result);
            return result;
        } catch (err: any) {
            setError(err);
            throw err;
        } finally {
            setIsExecuting(false);
        }
    }, []);

    const getPaymentStatus = useCallback(async (txHash: string) => {
        return x402PaymentService.getPaymentStatus(txHash);
    }, []);

    return {
        executePayment,
        getPaymentStatus,
        isExecuting,
        lastResult,
        error
    };
}

/**
 * Hook for Moonlander position management
 */
export function useMoonlanderPositions(userAddress: string | null) {
    const [positions, setPositions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchPositions = useCallback(async () => {
        if (!userAddress) {
            setPositions([]);
            return;
        }

        setIsLoading(true);
        try {
            const result = await moonlanderIntegration.getAllPositions(userAddress);
            setPositions(result);
        } catch (err) {
            console.error('Failed to fetch positions:', err);
        } finally {
            setIsLoading(false);
        }
    }, [userAddress]);

    useEffect(() => {
        fetchPositions();
    }, [fetchPositions]);

    return { positions, isLoading, refetch: fetchPositions };
}

/**
 * Hook for opening a position on Moonlander
 */
export function useOpenPosition() {
    const [isOpening, setIsOpening] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<Error | null>(null);

    const openPosition = useCallback(async (params: {
        pair: string;
        isLong: boolean;
        collateralUsd: number;
        sizeUsd: number;
        leverage: number;
        acceptableSlippage: number;
        currentPrice: number;
    }) => {
        setIsOpening(true);
        setError(null);

        try {
            const tradeResult = await moonlanderIntegration.openPosition(params);
            setResult(tradeResult);
            return tradeResult;
        } catch (err: any) {
            setError(err);
            throw err;
        } finally {
            setIsOpening(false);
        }
    }, []);

    return { openPosition, isOpening, result, error };
}

/**
 * Hook for closing a position on Moonlander
 */
export function useClosePosition() {
    const [isClosing, setIsClosing] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<Error | null>(null);

    const closePosition = useCallback(async (params: {
        positionKey: string;
        sizeUsd: number;
        acceptableSlippage: number;
        currentPrice: number;
    }) => {
        setIsClosing(true);
        setError(null);

        try {
            const tradeResult = await moonlanderIntegration.closePosition(params);
            setResult(tradeResult);
            return tradeResult;
        } catch (err: any) {
            setError(err);
            throw err;
        } finally {
            setIsClosing(false);
        }
    }, []);

    return { closePosition, isClosing, result, error };
}

/**
 * Hook for market data from Crypto.com SDK
 */
export function useMarketData(pairs: string[]) {
    const [marketData, setMarketData] = useState<PriceFeed[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchMarketData = useCallback(async () => {
        if (pairs.length === 0) return;

        setIsLoading(true);
        try {
            const data = await cryptoComAIService.getMarketData(pairs);
            setMarketData(data);
        } catch (err) {
            console.error('Failed to fetch market data:', err);
        } finally {
            setIsLoading(false);
        }
    }, [pairs.join(',')]);

    useEffect(() => {
        fetchMarketData();
        // Refresh every 30 seconds
        const interval = setInterval(fetchMarketData, 30000);
        return () => clearInterval(interval);
    }, [fetchMarketData]);

    return { marketData, isLoading, refetch: fetchMarketData };
}

export * from './backend-hooks';
