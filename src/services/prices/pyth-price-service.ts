import { HermesClient } from '@pythnetwork/hermes-client';

/**
 * Pyth Price Service - Real-time price feeds from Pyth Network
 * 
 * Cronos Testnet: 0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320
 * Cronos Mainnet: 0xE0d0e68297772Dd5a1f1D99897c581E2082dbA5B
 * 
 * Docs: https://docs.cronos.org/for-dapp-developers/dev-tools-and-integrations/pyth
 */

// Price Feed IDs from https://pyth.network/developers/price-feed-ids
export const PRICE_FEED_IDS = {
    'BTC/USD': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
    'ETH/USD': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
    'CRO/USD': '0x23199c2bcb1303f667e733b9934db9eca5991e765b45f5ed18bc4b231415f2fe',
    'USDC/USD': '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
} as const;

export type PriceFeedSymbol = keyof typeof PRICE_FEED_IDS;

interface PriceData {
    price: number;
    expo: number;
    conf: number;
    publishTime: number;
}

export class PythPriceService {
    private connection: HermesClient;
    private priceCache: Map<string, { data: PriceData; timestamp: number }> = new Map();
    private readonly CACHE_TTL = 10000; // 10 seconds

    constructor() {
        // Hermes API endpoint
        this.connection = new HermesClient('https://hermes.pyth.network');

        console.log('Pyth Price Service initialized');
    }

    /**
     * Get latest price for a symbol
     */
    async getPrice(symbol: PriceFeedSymbol): Promise<number> {
        const feedId = PRICE_FEED_IDS[symbol];

        // Check cache
        const cached = this.priceCache.get(feedId);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            return this.formatPrice(cached.data);
        }

        try {
            // Fetch from Pyth Hermes
            const priceUpdates = await this.connection.getLatestPriceUpdates([feedId]);

            if (!priceUpdates || !priceUpdates.parsed || priceUpdates.parsed.length === 0) {
                throw new Error(`No price feed found for ${symbol}`);
            }

            const priceFeed = priceUpdates.parsed[0];
            const priceData = priceFeed.price;

            if (!priceData) {
                throw new Error(`Price data not available for ${symbol}`);
            }

            const data: PriceData = {
                price: Number(priceData.price),
                expo: priceData.expo,
                conf: Number(priceData.conf),
                publishTime: priceData.publish_time,
            };

            // Cache the result
            this.priceCache.set(feedId, {
                data,
                timestamp: Date.now(),
            });

            return this.formatPrice(data);
        } catch (error) {
            console.error(`Failed to fetch price for ${symbol}:`, error);

            // Return cached value if available, even if stale
            if (cached) {
                console.warn(`Using stale cached price for ${symbol}`);
                return this.formatPrice(cached.data);
            }

            throw error;
        }
    }

    /**
     * Get multiple prices at once
     */
    async getPrices(symbols: PriceFeedSymbol[]): Promise<Record<string, number>> {
        const prices: Record<string, number> = {};

        await Promise.all(
            symbols.map(async (symbol) => {
                try {
                    prices[symbol] = await this.getPrice(symbol);
                } catch (error) {
                    console.error(`Failed to get price for ${symbol}:`, error);
                    prices[symbol] = 0;
                }
            })
        );

        return prices;
    }

    /**
     * Format price from Pyth data (price * 10^expo)
     */
    private formatPrice(data: PriceData): number {
        return data.price * Math.pow(10, data.expo);
    }

    /**
     * Get price with confidence interval
     */
    async getPriceWithConfidence(symbol: PriceFeedSymbol): Promise<{
        price: number;
        confidence: number;
        publishTime: number;
    }> {
        const feedId = PRICE_FEED_IDS[symbol];

        const priceUpdates = await this.connection.getLatestPriceUpdates([feedId]);
        const priceFeed = priceUpdates.parsed?.[0];
        const priceData = priceFeed?.price;

        if (!priceData) {
            throw new Error(`Price data not available for ${symbol}`);
        }

        return {
            price: Number(priceData.price) * Math.pow(10, priceData.expo),
            confidence: Number(priceData.conf) * Math.pow(10, priceData.expo),
            publishTime: priceData.publish_time,
        };
    }

    /**
     * Subscribe to price updates (for real-time streaming)
     */
    subscribeToPriceUpdates(
        symbols: PriceFeedSymbol[],
        callback: (symbol: PriceFeedSymbol, price: number) => void
    ) {
        // Poll for updates every 5 seconds
        const interval = setInterval(async () => {
            for (const symbol of symbols) {
                try {
                    const price = await this.getPrice(symbol);
                    callback(symbol, price);
                } catch (error) {
                    console.error(`Price update failed for ${symbol}:`, error);
                }
            }
        }, 5000);

        return () => clearInterval(interval);
    }
}

// Singleton instance
export const pythPriceService = new PythPriceService();
