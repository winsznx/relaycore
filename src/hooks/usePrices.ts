import { priceAggregator, type AggregatedPrice, type PriceSource } from '@/services/prices/price-aggregator';
import { useQuery } from '@tanstack/react-query';

// Re-export types for components
export type { AggregatedPrice, PriceSource };

/**
 * React hook for real-time market prices (simple format)
 */
export function useMarketPrices() {
    return useQuery({
        queryKey: ['market-prices'],
        queryFn: () => priceAggregator.getCurrentPrices(),
        refetchInterval: 10000, // Update every 10 seconds
        staleTime: 5000,
    });
}

/**
 * React hook for full price data with all sources
 * Returns best price, source breakdown, and latency info
 */
export function useFullPriceData() {
    return useQuery({
        queryKey: ['full-price-data'],
        queryFn: () => priceAggregator.getFullPriceData(),
        refetchInterval: 10000, // Update every 10 seconds
        staleTime: 5000,
    });
}

/**
 * React hook for a specific price feed
 */
export function usePrice(symbol: string) {
    return useQuery({
        queryKey: ['price', symbol],
        queryFn: async () => {
            const prices = await priceAggregator.getCurrentPrices();
            const key = symbol.toLowerCase().replace('/', '') as keyof typeof prices;
            return prices[key] || 0;
        },
        refetchInterval: 10000,
        staleTime: 5000,
    });
}
