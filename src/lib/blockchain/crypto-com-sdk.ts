/**
 * Crypto.com AI Agent SDK Integration
 * 
 * Provides real-time market data via the Crypto.com MCP (Market Data API)
 * Documentation: https://ai-agent-sdk-docs.crypto.com
 * MCP: https://mcp.crypto.com/docs
 */

const MCP_BASE_URL = import.meta.env.VITE_CRYPTO_COM_MCP_URL || 'https://api.crypto.com/v2';

export interface PriceFeed {
    pair: string;
    price: number;
    bid: number;
    ask: number;
    volume24h: number;
    change24h: number;
    high24h: number;
    low24h: number;
    timestamp: Date;
}

export interface MarketDepth {
    bids: Array<{ price: number; size: number }>;
    asks: Array<{ price: number; size: number }>;
    timestamp: Date;
}

export interface CandleData {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

/**
 * Crypto.com AI Agent SDK Service
 * Uses the MCP (Model Context Protocol) for market data
 */
export class CryptoComAIService {
    private baseUrl: string;
    private apiKey?: string;

    constructor() {
        this.baseUrl = MCP_BASE_URL;
        this.apiKey = import.meta.env.VITE_CRYPTO_COM_API_KEY;
    }

    /**
     * Make authenticated request to Crypto.com API
     */
    private async request<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
        const url = new URL(`${this.baseUrl}${endpoint}`);

        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined) {
                    url.searchParams.set(key, String(value));
                }
            });
        }

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (this.apiKey) {
            headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        const response = await fetch(url.toString(), { headers });

        if (!response.ok) {
            throw new Error(`Crypto.com API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (data.code && data.code !== 0) {
            throw new Error(`Crypto.com API error: ${data.message || 'Unknown error'}`);
        }

        return data.result || data;
    }

    /**
     * Convert pair format: BTC-USD -> BTC_USDC
     */
    private formatPair(pair: string): string {
        return pair.replace('-', '_').replace('USD', 'USDC');
    }

    /**
     * Get real-time price feed for a trading pair
     */
    async getPriceFeed(pair: string): Promise<PriceFeed> {
        try {
            const formattedPair = this.formatPair(pair);
            const data = await this.request<any>('/public/get-ticker', {
                instrument_name: formattedPair
            });

            const ticker = data?.data || data;

            return {
                pair,
                price: parseFloat(ticker.a || ticker.last || '0'),
                bid: parseFloat(ticker.b || '0'),
                ask: parseFloat(ticker.k || '0'),
                volume24h: parseFloat(ticker.v || '0'),
                change24h: parseFloat(ticker.c || '0'),
                high24h: parseFloat(ticker.h || '0'),
                low24h: parseFloat(ticker.l || '0'),
                timestamp: new Date(ticker.t || Date.now())
            };
        } catch (error) {
            console.warn(`Failed to get price for ${pair}, using fallback:`, error);
            // Return estimated price if API fails
            return this.getFallbackPrice(pair);
        }
    }

    /**
     * Get market data for multiple pairs
     */
    async getMarketData(pairs: string[]): Promise<PriceFeed[]> {
        const results = await Promise.all(
            pairs.map(pair => this.getPriceFeed(pair))
        );
        return results;
    }

    /**
     * Get order book depth
     */
    async getMarketDepth(pair: string, depth: number = 10): Promise<MarketDepth> {
        try {
            const formattedPair = this.formatPair(pair);
            const data = await this.request<any>('/public/get-book', {
                instrument_name: formattedPair,
                depth
            });

            return {
                bids: (data.bids || []).map((b: any) => ({
                    price: parseFloat(b[0]),
                    size: parseFloat(b[1])
                })),
                asks: (data.asks || []).map((a: any) => ({
                    price: parseFloat(a[0]),
                    size: parseFloat(a[1])
                })),
                timestamp: new Date(data.t || Date.now())
            };
        } catch (error) {
            console.error(`Failed to get market depth for ${pair}:`, error);
            return { bids: [], asks: [], timestamp: new Date() };
        }
    }

    /**
     * Get candlestick data for charting
     */
    async getCandlesticks(
        pair: string,
        interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' = '1h',
        limit: number = 100
    ): Promise<CandleData[]> {
        try {
            const formattedPair = this.formatPair(pair);

            // Map interval to Crypto.com format
            const intervalMap: Record<string, string> = {
                '1m': '1m',
                '5m': '5m',
                '15m': '15m',
                '1h': '1h',
                '4h': '4h',
                '1d': '1D'
            };

            const data = await this.request<any>('/public/get-candlestick', {
                instrument_name: formattedPair,
                timeframe: intervalMap[interval] || '1h'
            });

            return (data.data || []).slice(0, limit).map((candle: any) => ({
                timestamp: candle.t,
                open: parseFloat(candle.o),
                high: parseFloat(candle.h),
                low: parseFloat(candle.l),
                close: parseFloat(candle.c),
                volume: parseFloat(candle.v)
            }));
        } catch (error) {
            console.error(`Failed to get candlesticks for ${pair}:`, error);
            return [];
        }
    }

    /**
     * Estimate slippage based on trade size and order book
     */
    async estimateSlippage(pair: string, sizeUsd: number, side: 'buy' | 'sell'): Promise<number> {
        try {
            const depth = await this.getMarketDepth(pair, 20);
            const orders = side === 'buy' ? depth.asks : depth.bids;

            if (orders.length === 0) {
                return 0.5; // Default 0.5% if no order book
            }

            let remainingSize = sizeUsd;
            let totalCost = 0;
            const basePrice = orders[0].price;

            for (const order of orders) {
                const orderValueUsd = order.price * order.size;

                if (remainingSize <= orderValueUsd) {
                    totalCost += remainingSize;
                    remainingSize = 0;
                    break;
                } else {
                    totalCost += orderValueUsd;
                    remainingSize -= orderValueUsd;
                }
            }

            // If we couldn't fill the entire order, add penalty
            if (remainingSize > 0) {
                return 2.0; // 2% for illiquid
            }

            const avgPrice = totalCost / sizeUsd * orders[0].price;
            const slippage = Math.abs((avgPrice - basePrice) / basePrice) * 100;

            return Math.min(slippage, 5); // Cap at 5%
        } catch (error) {
            console.warn(`Slippage estimation failed for ${pair}:`, error);
            return 0.3; // Default 0.3%
        }
    }

    /**
     * Fallback prices when API is unavailable
     * Uses reasonable market estimates
     */
    private getFallbackPrice(pair: string): PriceFeed {
        const fallbackPrices: Record<string, number> = {
            'BTC-USD': 97000,
            'ETH-USD': 3400,
            'CRO-USD': 0.125,
            'SOL-USD': 180,
            'LINK-USD': 23,
            'ARB-USD': 1.20,
            'AVAX-USD': 40
        };

        const price = fallbackPrices[pair] || 100;

        return {
            pair,
            price,
            bid: price * 0.999,
            ask: price * 1.001,
            volume24h: 1000000000,
            change24h: 0,
            high24h: price * 1.02,
            low24h: price * 0.98,
            timestamp: new Date()
        };
    }
}

// Export singleton instance
export const cryptoComAIService = new CryptoComAIService();
