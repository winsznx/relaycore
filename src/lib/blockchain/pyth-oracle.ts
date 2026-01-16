/**
 * Pyth Network Price Oracle Integration
 * 
 * Real-time price feeds for Cronos EVM using Pyth pull oracle design.
 */

import { ethers } from 'ethers';

export const PYTH_CONTRACTS = {
    mainnet: '0xE0d0e68297772Dd5a1f1D99897c581E2082dbA5B',
    testnet: '0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320'
} as const;

// Hermes API for fetching price update data
export const HERMES_API = 'https://hermes.pyth.network';

// Price Feed IDs (from https://pyth.network/developers/price-feed-ids)
export const PYTH_PRICE_FEEDS = {
    // Crypto
    'BTC/USD': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
    'ETH/USD': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
    'CRO/USD': '0x23199c2bcb1303f667e733b9934db9eca5991e765b45f5ed18bc4b231415f2fe',
    'SOL/USD': '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
    'ATOM/USD': '0xb00b60f88b03a6a625a8d1c048c3f66653edf217439cb2c671a5ac3ee82f6109',
    'AVAX/USD': '0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7',
    'LINK/USD': '0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221',
    'ARB/USD': '0x3fa4252848f9f0a1480be62745a4629d9eb1322aebab8a791e344b3b9c1adcf5',
    // Stablecoins
    'USDC/USD': '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
    'USDT/USD': '0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b'
} as const;

// Pyth IPyth interface ABI
const PYTH_ABI = [
    'function getPrice(bytes32 id) external view returns (tuple(int64 price, uint64 conf, int32 expo, uint256 publishTime))',
    'function getPriceNoOlderThan(bytes32 id, uint256 age) external view returns (tuple(int64 price, uint64 conf, int32 expo, uint256 publishTime))',
    'function getPriceUnsafe(bytes32 id) external view returns (tuple(int64 price, uint64 conf, int32 expo, uint256 publishTime))',
    'function getUpdateFee(bytes[] calldata updateData) external view returns (uint256)',
    'function updatePriceFeeds(bytes[] calldata updateData) external payable',
    'function parsePriceFeedUpdates(bytes[] calldata updateData, bytes32[] calldata priceIds, uint64 minPublishTime, uint64 maxPublishTime) external payable returns (tuple(bytes32 id, tuple(int64 price, uint64 conf, int32 expo, uint256 publishTime) price)[])'
];

export interface PythPrice {
    price: number;
    confidence: number;
    expo: number;
    publishTime: Date;
    feedId: string;
}

export interface HermesPriceUpdate {
    id: string;
    price: {
        price: string;
        conf: string;
        expo: number;
        publish_time: number;
    };
    ema_price: {
        price: string;
        conf: string;
        expo: number;
        publish_time: number;
    };
}

export class PythPriceService {
    private provider: ethers.Provider;
    private pythContract: ethers.Contract;
    private network: 'mainnet' | 'testnet';

    constructor(_provider: ethers.Provider, _network: 'mainnet' | 'testnet' = 'testnet') {
        this.provider = _provider;
        this.network = _network;
        this.pythContract = new ethers.Contract(
            PYTH_CONTRACTS[this.network],
            PYTH_ABI,
            this.provider
        );
    }

    /**
     * Get the Pyth price feed ID for a symbol
     */
    getPriceFeedId(symbol: string): string | undefined {
        return PYTH_PRICE_FEEDS[symbol as keyof typeof PYTH_PRICE_FEEDS];
    }

    /**
     * Fetch latest price update data from Hermes
     * Required for on-chain price updates
     */
    async fetchPriceUpdateData(feedIds: string[]): Promise<string[]> {
        const idsParam = feedIds.join('&ids[]=');
        const url = `${HERMES_API}/v2/updates/price/latest?ids[]=${idsParam}`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Hermes API error: ${response.status}`);
        }

        const data = await response.json();

        // Return the binary update data
        return data.binary?.data || [];
    }

    /**
     * Get price from Hermes API (off-chain, real-time)
     */
    async getPriceFromHermes(symbol: string): Promise<PythPrice | null> {
        const feedId = this.getPriceFeedId(symbol);
        if (!feedId) {
            console.error(`Unknown price feed: ${symbol}`);
            return null;
        }

        try {
            const url = `${HERMES_API}/v2/updates/price/latest?ids[]=${feedId}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Hermes error: ${response.status}`);
            }

            const data = await response.json();
            const priceData = data.parsed?.[0] as HermesPriceUpdate;

            if (!priceData) {
                return null;
            }

            // Convert to human-readable price
            const price = Number(priceData.price.price) * Math.pow(10, priceData.price.expo);
            const confidence = Number(priceData.price.conf) * Math.pow(10, priceData.price.expo);

            return {
                price,
                confidence,
                expo: priceData.price.expo,
                publishTime: new Date(priceData.price.publish_time * 1000),
                feedId
            };
        } catch (error) {
            console.error(`Failed to fetch price for ${symbol}:`, error);
            return null;
        }
    }

    /**
     * Get multiple prices from Hermes (batch request)
     */
    async getMultiplePricesFromHermes(symbols: string[]): Promise<Map<string, PythPrice>> {
        const results = new Map<string, PythPrice>();
        const feedIds = symbols
            .map(s => ({ symbol: s, feedId: this.getPriceFeedId(s) }))
            .filter(x => x.feedId);

        if (feedIds.length === 0) {
            return results;
        }

        try {
            const idsParam = feedIds.map(f => f.feedId).join('&ids[]=');
            const url = `${HERMES_API}/v2/updates/price/latest?ids[]=${idsParam}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Hermes error: ${response.status}`);
            }

            const data = await response.json();
            const parsedPrices = data.parsed as HermesPriceUpdate[];

            for (const priceData of parsedPrices) {
                // Find the symbol for this feed
                const feedInfo = feedIds.find(f => f.feedId === `0x${priceData.id}`);
                if (!feedInfo) continue;

                const price = Number(priceData.price.price) * Math.pow(10, priceData.price.expo);
                const confidence = Number(priceData.price.conf) * Math.pow(10, priceData.price.expo);

                results.set(feedInfo.symbol, {
                    price,
                    confidence,
                    expo: priceData.price.expo,
                    publishTime: new Date(priceData.price.publish_time * 1000),
                    feedId: feedInfo.feedId!
                });
            }
        } catch (error) {
            console.error('Failed to fetch multiple prices:', error);
        }

        return results;
    }

    /**
     * Get price from on-chain Pyth contract
     * Note: May be stale if not recently updated
     */
    async getPriceOnChain(symbol: string): Promise<PythPrice | null> {
        const feedId = this.getPriceFeedId(symbol);
        if (!feedId) {
            return null;
        }

        try {
            const priceData = await this.pythContract.getPriceUnsafe(feedId);

            const price = Number(priceData.price) * Math.pow(10, priceData.expo);
            const confidence = Number(priceData.conf) * Math.pow(10, priceData.expo);

            return {
                price,
                confidence,
                expo: priceData.expo,
                publishTime: new Date(Number(priceData.publishTime) * 1000),
                feedId
            };
        } catch (error) {
            console.error(`Failed to get on-chain price for ${symbol}:`, error);
            return null;
        }
    }

    /**
     * Update prices on-chain and get the update fee
     */
    async updatePricesOnChain(
        symbols: string[],
        signer: ethers.Signer
    ): Promise<{ txHash: string; fee: string }> {
        const feedIds = symbols
            .map(s => this.getPriceFeedId(s))
            .filter((id): id is string => id !== undefined);

        // Fetch update data from Hermes
        const updateData = await this.fetchPriceUpdateData(feedIds);

        if (updateData.length === 0) {
            throw new Error('No update data available');
        }

        // Get update fee
        const updateFee = await this.pythContract.getUpdateFee(updateData);

        // Connect with signer
        const pythWithSigner = this.pythContract.connect(signer);

        // Submit update transaction
        const tx = await (pythWithSigner as any).updatePriceFeeds(updateData, {
            value: updateFee
        });

        const receipt = await tx.wait();

        return {
            txHash: receipt.hash,
            fee: ethers.formatEther(updateFee)
        };
    }

    /**
     * Get all available price feeds
     */
    getAvailableFeeds(): string[] {
        return Object.keys(PYTH_PRICE_FEEDS);
    }
}

/**
 * Format price with appropriate decimals.
 */
export function formatPythPrice(price: PythPrice, decimals: number = 2): string {
    return price.price.toFixed(decimals);
}

/**
 * Calculate price with confidence interval
 */
export function getPriceWithConfidence(price: PythPrice): {
    price: number;
    lower: number;
    upper: number;
} {
    return {
        price: price.price,
        lower: price.price - price.confidence,
        upper: price.price + price.confidence
    };
}

export { PYTH_ABI };
