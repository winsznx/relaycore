/**
 * Real-Time Subscription Service
 * 
 * Provides WebSocket subscriptions for:
 * - Price feed updates (via Crypto.com WebSocket)
 * - Position PnL updates
 * - Trade status updates
 * - Supabase Realtime for database changes
 */

import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { cryptoComAIService, type PriceFeed } from './blockchain/crypto-com-sdk';

// Supabase client for realtime
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

type PriceCallback = (prices: Record<string, PriceFeed>) => void;
type TradeCallback = (trade: any) => void;
type PositionCallback = (positions: any[]) => void;

/**
 * Price Feed Subscription using polling (since Crypto.com WebSocket requires API key)
 */
class PriceFeedSubscription {
    private pairs: string[] = [];
    private callbacks: Set<PriceCallback> = new Set();
    private intervalId: NodeJS.Timeout | null = null;
    private latestPrices: Record<string, PriceFeed> = {};
    private pollingInterval: number = 5000; // 5 seconds

    /**
     * Subscribe to price updates
     */
    subscribe(pairs: string[], callback: PriceCallback): () => void {
        // Add pairs
        pairs.forEach(pair => {
            if (!this.pairs.includes(pair)) {
                this.pairs.push(pair);
            }
        });

        this.callbacks.add(callback);

        // Start polling if not already running
        if (!this.intervalId && this.pairs.length > 0) {
            this.startPolling();
        }

        // Immediately fetch current prices
        this.fetchPrices();

        // Return unsubscribe function
        return () => {
            this.callbacks.delete(callback);
            if (this.callbacks.size === 0) {
                this.stopPolling();
            }
        };
    }

    /**
     * Set polling interval
     */
    setPollingInterval(ms: number): void {
        this.pollingInterval = Math.max(1000, ms); // Minimum 1 second
        if (this.intervalId) {
            this.stopPolling();
            this.startPolling();
        }
    }

    /**
     * Get latest prices (cached)
     */
    getLatestPrices(): Record<string, PriceFeed> {
        return { ...this.latestPrices };
    }

    private startPolling(): void {
        this.intervalId = setInterval(() => {
            this.fetchPrices();
        }, this.pollingInterval);
    }

    private stopPolling(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    private async fetchPrices(): Promise<void> {
        if (this.pairs.length === 0) return;

        try {
            const prices = await cryptoComAIService.getMarketData(this.pairs);

            // Update cache
            prices.forEach(price => {
                this.latestPrices[price.pair] = price;
            });

            // Notify all subscribers
            this.callbacks.forEach(callback => {
                callback(this.latestPrices);
            });
        } catch (error) {
            console.error('Failed to fetch prices:', error);
        }
    }
}

/**
 * Supabase Realtime Subscription for database changes
 */
class SupabaseRealtimeService {
    private supabase: SupabaseClient;
    private channels: Map<string, RealtimeChannel> = new Map();

    constructor() {
        this.supabase = createClient(supabaseUrl, supabaseAnonKey);
    }

    /**
     * Subscribe to trades table changes for a user
     */
    subscribeToTrades(userAddress: string, callback: TradeCallback): () => void {
        const channelName = `trades:${userAddress}`;

        if (this.channels.has(channelName)) {
            this.channels.get(channelName)?.unsubscribe();
        }

        const channel = this.supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'trades',
                    filter: `user_address=eq.${userAddress.toLowerCase()}`
                },
                (payload) => {
                    callback(payload.new);
                }
            )
            .subscribe();

        this.channels.set(channelName, channel);

        return () => {
            channel.unsubscribe();
            this.channels.delete(channelName);
        };
    }

    /**
     * Subscribe to payments for a service
     */
    subscribeToPayments(serviceId: string, callback: (payment: any) => void): () => void {
        const channelName = `payments:${serviceId}`;

        const channel = this.supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'payments',
                    filter: `service_id=eq.${serviceId}`
                },
                (payload) => {
                    callback(payload.new);
                }
            )
            .subscribe();

        this.channels.set(channelName, channel);

        return () => {
            channel.unsubscribe();
            this.channels.delete(channelName);
        };
    }

    /**
     * Subscribe to reputation updates
     */
    subscribeToReputations(callback: (reputation: any) => void): () => void {
        const channelName = 'reputations';

        const channel = this.supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'reputations'
                },
                (payload) => {
                    callback(payload.new);
                }
            )
            .subscribe();

        this.channels.set(channelName, channel);

        return () => {
            channel.unsubscribe();
            this.channels.delete(channelName);
        };
    }

    /**
     * Subscribe to service rankings (for leaderboard)
     */
    subscribeToServices(callback: (services: any[]) => void): () => void {
        const channelName = 'services-broadcast';

        const channel = this.supabase
            .channel(channelName)
            .on('broadcast', { event: 'rankings_updated' }, ({ payload }) => {
                callback(payload.services);
            })
            .subscribe();

        this.channels.set(channelName, channel);

        return () => {
            channel.unsubscribe();
            this.channels.delete(channelName);
        };
    }

    /**
     * Clean up all subscriptions
     */
    cleanup(): void {
        this.channels.forEach(channel => channel.unsubscribe());
        this.channels.clear();
    }
}

/**
 * Position PnL Tracker - Calculates and broadcasts position updates
 */
class PositionTracker {
    private positions: any[] = [];
    private callbacks: Set<PositionCallback> = new Set();
    private priceSubscription: (() => void) | null = null;
    private priceFeed: PriceFeedSubscription;

    constructor(priceFeed: PriceFeedSubscription) {
        this.priceFeed = priceFeed;
    }

    /**
     * Start tracking positions
     */
    startTracking(positions: any[]): void {
        this.positions = positions;

        // Get all pairs from positions
        const pairs = [...new Set(positions.map(p => p.pair))];

        if (pairs.length > 0 && !this.priceSubscription) {
            this.priceSubscription = this.priceFeed.subscribe(pairs, (prices) => {
                this.updatePositionPnL(prices);
            });
        }
    }

    /**
     * Subscribe to position updates
     */
    subscribe(callback: PositionCallback): () => void {
        this.callbacks.add(callback);

        // Immediately send current positions
        if (this.positions.length > 0) {
            callback(this.positions);
        }

        return () => {
            this.callbacks.delete(callback);
        };
    }

    /**
     * Update position PnL based on current prices
     */
    private updatePositionPnL(prices: Record<string, PriceFeed>): void {
        this.positions = this.positions.map(position => {
            const price = prices[position.pair];
            if (!price) return position;

            const currentPrice = price.price;
            const priceDiff = currentPrice - position.entry_price;

            const unrealisedPnl = position.side === 'long'
                ? (priceDiff / position.entry_price) * position.size_usd
                : (-priceDiff / position.entry_price) * position.size_usd;

            return {
                ...position,
                current_price: currentPrice,
                unrealised_pnl: unrealisedPnl,
                pnl_percent: (unrealisedPnl / position.size_usd) * 100
            };
        });

        // Notify subscribers
        this.callbacks.forEach(callback => {
            callback(this.positions);
        });
    }

    /**
     * Stop tracking
     */
    stopTracking(): void {
        if (this.priceSubscription) {
            this.priceSubscription();
            this.priceSubscription = null;
        }
        this.positions = [];
    }
}

// Export singleton instances
export const priceFeedSubscription = new PriceFeedSubscription();
export const supabaseRealtime = new SupabaseRealtimeService();
export const positionTracker = new PositionTracker(priceFeedSubscription);

// Export types
export type { PriceCallback, TradeCallback, PositionCallback };
