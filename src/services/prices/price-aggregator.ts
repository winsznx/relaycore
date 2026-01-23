/// <reference types="vite/client" />
import { pythPriceService, type PriceFeedSymbol } from './pyth-price-service';
import { ethers } from 'ethers';
import logger from '../../lib/logger';

/**
 * Multi-DEX Price Aggregator for Cronos
 * 
 * Sources: Pyth Oracle, VVS Finance, MM Finance, Fulcrom, CroSwap, Moonlander
 * Queries all sources in parallel for lowest latency.
 */

interface PriceSource {
    name: string;
    price: number;
    latencyMs: number;
    timestamp: number;
}

interface AggregatedPrice {
    symbol: string;
    bestPrice: number;
    bestSource: string;
    sources: PriceSource[];
    aggregatedAt: number;
    totalLatencyMs: number;
}

// Official Cronos Token Addresses (verified)
const TOKENS: Record<string, { address: string; decimals: number }> = {
    WCRO: { address: '0x5C7F8A570d578ED60E9aE2ed85db5aD1b0b3e6e7', decimals: 18 },
    CRO: { address: '0x5C7F8A570d578ED60E9aE2ed85db5aD1b0b3e6e7', decimals: 18 }, // Alias for WCRO
    USDC: { address: '0xc21223249CA28397B4B6541dfFaEcC539BfF0c59', decimals: 6 },
    ETH: { address: '0xe44Fd7fCb2b1581822D0c862B68222998a0c299a', decimals: 18 },
    WETH: { address: '0xe44Fd7fCb2b1581822D0c862B68222998a0c299a', decimals: 18 }, // Alias for ETH
    WBTC: { address: '0x062E66477Faf219F25D27dCED647BF57C3107d52', decimals: 8 },
    BTC: { address: '0x062E66477Faf219F25D27dCED647BF57C3107d52', decimals: 8 }, // Alias for WBTC
    DAI: { address: '0xF2001B145b43032AAF5Ee2884e456CCd805F677D', decimals: 18 },
    USDT: { address: '0x66e428c3f67a68878562e79A0234c1F83c208770', decimals: 6 },
    USD: { address: '0xc21223249CA28397B4B6541dfFaEcC539BfF0c59', decimals: 6 }, // Alias for USDC
};

// Cronos RPC Provider
const CRONOS_RPC = 'https://evm.cronos.org';

// Simple in-memory cache with TTL
interface CacheEntry {
    price: number;
    source: string;
    timestamp: number;
}
const priceCache: Map<string, CacheEntry> = new Map();
const CACHE_TTL_MS = 30000; // 30 seconds default
const VVS_CACHE_TTL_MS = 60000; // 60 seconds for VVS to avoid rate limiting

// Global VVS rate limiter - only 1 request per minute (across all symbols)
let lastVVSRequest = 0;
const VVS_RATE_LIMIT_MS = 60000; // 60 seconds between API calls

export class MultiDexAggregator {
    private provider: ethers.JsonRpcProvider;

    constructor() {
        this.provider = new ethers.JsonRpcProvider(CRONOS_RPC);
    }

    /**
     * Check cache for recent price
     */
    private getFromCache(symbol: string, sourceName: string, customTtl?: number): number | null {
        const key = `${symbol}:${sourceName}`;
        const entry = priceCache.get(key);
        const ttl = customTtl || CACHE_TTL_MS;
        if (entry && Date.now() - entry.timestamp < ttl) {
            return entry.price;
        }
        return null;
    }

    /**
     * Store price in cache
     */
    private setCache(symbol: string, sourceName: string, price: number): void {
        const key = `${symbol}:${sourceName}`;
        priceCache.set(key, { price, source: sourceName, timestamp: Date.now() });
    }

    /**
     * Get price from ALL Cronos sources in parallel
     * Returns best price with full source breakdown
     */
    async getAggregatedPrice(symbol: PriceFeedSymbol): Promise<AggregatedPrice> {
        const startTime = performance.now();
        const sources: PriceSource[] = [];

        // Query all Cronos sources in parallel
        const promises: Promise<void>[] = [];

        // 1. Pyth Oracle (fastest, used by Moonlander)
        promises.push(
            this.queryPyth(symbol).then(result => {
                if (result) sources.push(result);
            }).catch(err => logger.warn(`Pyth failed: ${err.message}`))
        );

        // 2. VVS Finance (largest Cronos DEX) - with longer cache to avoid rate limiting
        promises.push(
            this.queryVVS(symbol).then(result => {
                if (result) sources.push(result);
            }).catch(() => { /* Silent fail - VVS has strict rate limits */ })
        );

        // 3. MM Finance (second largest Cronos DEX)
        promises.push(
            this.queryMMFinance(symbol).then(result => {
                if (result) sources.push(result);
            }).catch(err => logger.warn(`MM Finance failed: ${err.message}`))
        );

        // 4. Fulcrom Finance (Cronos perpetual DEX)
        promises.push(
            this.queryFulcrom(symbol).then(result => {
                if (result) sources.push(result);
            }).catch(err => logger.warn(`Fulcrom failed: ${err.message}`))
        );

        // 5. CroSwap (Cronos AMM)
        promises.push(
            this.queryCroSwap(symbol).then(result => {
                if (result) sources.push(result);
            }).catch(err => logger.warn(`CroSwap failed: ${err.message}`))
        );

        // 6. Moonlander (Cronos Perpetual DEX - uses Pyth)
        promises.push(
            this.queryMoonlander(symbol).then(result => {
                if (result) sources.push(result);
            }).catch(err => logger.warn(`Moonlander failed: ${err.message}`))
        );

        // Wait for all queries to complete
        await Promise.allSettled(promises);

        const totalLatency = Math.round(performance.now() - startTime);

        // Sort by price (best first)
        const validSources = sources.filter(s => s.price > 0);
        validSources.sort((a, b) => b.price - a.price);

        const bestSource = validSources[0];

        logger.info(`Price aggregation complete: ${validSources.length}/6 sources`, {
            symbol,
            sources: validSources.map(s => s.name),
            bestPrice: bestSource?.price,
            latency: totalLatency
        });

        return {
            symbol,
            bestPrice: bestSource?.price || 0,
            bestSource: bestSource?.name || 'none',
            sources: validSources,
            aggregatedAt: Date.now(),
            totalLatencyMs: totalLatency,
        };
    }

    /**
     * Query Pyth Oracle - fastest oracle with signed prices
     */
    private async queryPyth(symbol: PriceFeedSymbol): Promise<PriceSource | null> {
        const start = performance.now();
        try {
            const price = await pythPriceService.getPrice(symbol);
            return {
                name: 'Pyth Oracle',
                price,
                latencyMs: Math.round(performance.now() - start),
                timestamp: Date.now(),
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * Query VVS Finance using Swap SDK.
     */
    private async queryVVS(symbol: PriceFeedSymbol): Promise<PriceSource | null> {
        const start = performance.now();

        // Check cache first with longer TTL to avoid rate limiting
        const cachedPrice = this.getFromCache(symbol, 'VVS Finance', VVS_CACHE_TTL_MS);
        if (cachedPrice !== null) {
            return {
                name: 'VVS Finance',
                price: cachedPrice,
                latencyMs: 0,
                timestamp: Date.now(),
            };
        }

        // Global rate limiter - skip if we made a request too recently
        const now = Date.now();
        if (now - lastVVSRequest < VVS_RATE_LIMIT_MS) {
            return null; // Skip this request to avoid 429
        }

        // Get API key for Cronos mainnet (chain ID 25)
        // SDK expects SWAP_SDK_QUOTE_API_CLIENT_ID_25 or quoteApiClientId param
        const apiKey = import.meta.env.VITE_VVS_API_CLIENT_ID_25;

        if (!apiKey) {
            // Silent fail - no API key configured
            return null;
        }

        // Mark that we're making a request
        lastVVSRequest = now;

        try {
            // Dynamic import to avoid SSR issues
            const { fetchBestTrade, BuiltInChainId, PoolType } = await import('@vvs-finance/swap-sdk');

            const [base, quote] = symbol.split('/');
            // Use direct token lookup - TOKENS now has all aliases (CRO, BTC, USD, etc.)
            const tokenInAddr = TOKENS[base]?.address;
            const tokenOutAddr = TOKENS[quote]?.address;

            if (!tokenInAddr || !tokenOutAddr) {
                logger.warn(`VVS: Token not supported - ${symbol}`);
                return null;
            }

            // Fetch best trade using SDK
            const trade = await fetchBestTrade(
                BuiltInChainId.CRONOS_MAINNET, // chainId 25
                tokenInAddr,
                tokenOutAddr,
                '1', // 1 unit for price quote
                {
                    poolTypes: [PoolType.V2, PoolType.V3_100, PoolType.V3_500, PoolType.V3_3000, PoolType.V3_10000],
                    maxHops: 2,
                    maxSplits: 2,
                    quoteApiClientId: apiKey,
                }
            );

            if (!trade || !trade.amountOut) {
                return null;
            }

            // Extract price from trade - trade.price is the exchange rate as a Fraction
            // For exact output amount, use amountOut.amount which is also a Fraction
            let price: number;
            try {
                // Try to use the price field first (exchange rate)
                if (trade.price && typeof trade.price.toFixed === 'function') {
                    price = Number(trade.price.toFixed(8));
                } else if (trade.amountOut.amount) {
                    // Fallback to amountOut.amount
                    const amountStr = trade.amountOut.amount.toString();
                    price = Number(amountStr);
                } else {
                    return null;
                }
            } catch {
                // If all else fails, try direct conversion
                price = Number(String(trade.amountOut.amount || trade.price));
            }

            if (isNaN(price) || price <= 0) {
                return null;
            }

            // Cache the result to avoid rate limiting
            this.setCache(symbol, 'VVS Finance', price);

            return {
                name: 'VVS Finance',
                price,
                latencyMs: Math.round(performance.now() - start),
                timestamp: Date.now(),
            };
        } catch (error) {
            // Silent fail for rate limiting, but log other errors
            const errorMsg = (error as Error).message;
            if (!errorMsg.includes('429') && !errorMsg.includes('Too Many')) {
                logger.warn(`VVS SDK query failed: ${errorMsg}`);
            }
            return null;
        }
    }

    /**
     * Query MM Finance via on-chain router
     * Uses UniswapV2 router interface
     */
    private async queryMMFinance(symbol: PriceFeedSymbol): Promise<PriceSource | null> {
        const start = performance.now();

        try {
            const [base, quote] = symbol.split('/');
            // Use direct token lookup with aliases
            const tokenIn = TOKENS[base]?.address;
            const tokenOut = TOKENS[quote]?.address;
            const decimalsIn = TOKENS[base]?.decimals;
            const decimalsOut = TOKENS[quote]?.decimals;

            if (!tokenIn || !tokenOut || !decimalsIn || !decimalsOut) return null;

            // MM Finance Router address
            const routerAddress = '0x145677FC4d9b8F19B5D56d1820c48e0443049a30';
            const routerABI = [
                'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)'
            ];

            const router = new ethers.Contract(routerAddress, routerABI, this.provider);
            const amountIn = ethers.parseUnits('1', decimalsIn);

            const amounts = await router.getAmountsOut(amountIn, [tokenIn, tokenOut]);
            const price = Number(ethers.formatUnits(amounts[1], decimalsOut));

            return {
                name: 'MM Finance',
                price,
                latencyMs: Math.round(performance.now() - start),
                timestamp: Date.now(),
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * Query Fulcrom Finance perpetual DEX
     * Uses on-chain price feeds
     */
    private async queryFulcrom(symbol: PriceFeedSymbol): Promise<PriceSource | null> {
        const start = performance.now();

        try {
            // Fulcrom uses Chainlink-style price feeds
            // Contract: 0x83aFB1C32E5637ACd0a452D87c3249f4a9F0013A
            const priceFeedABI = [
                'function getPrice(address token) external view returns (uint256)'
            ];

            const [base] = symbol.split('/');
            // Use direct token lookup with aliases
            const tokenAddress = TOKENS[base]?.address;

            if (!tokenAddress) return null;

            const fulcromAddress = '0x83aFB1C32E5637ACd0a452D87c3249f4a9F0013A';
            const contract = new ethers.Contract(fulcromAddress, priceFeedABI, this.provider);

            const price = await contract.getPrice(tokenAddress);
            const formattedPrice = Number(ethers.formatUnits(price, 30)); // Fulcrom uses 30 decimals

            if (formattedPrice > 0) {
                return {
                    name: 'Fulcrom Finance',
                    price: formattedPrice,
                    latencyMs: Math.round(performance.now() - start),
                    timestamp: Date.now(),
                };
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Query CroSwap via DexScreener API
     */
    private async queryCroSwap(symbol: PriceFeedSymbol): Promise<PriceSource | null> {
        const start = performance.now();

        try {
            const [base] = symbol.split('/');
            // Use direct token lookup with aliases
            const tokenAddress = TOKENS[base]?.address;

            if (!tokenAddress) return null;

            const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
            if (!response.ok) return null;

            const data = await response.json() as any;
            if (!data.pairs) return null;

            // Find CroSwap pair on Cronos with USD quote
            const pair = data.pairs.find((p: any) =>
                p.chainId === 'cronos' &&
                p.dexId === 'croswap' &&
                ['USDC', 'USDT'].includes(p.quoteToken.symbol)
            );

            if (!pair) return null;

            return {
                name: 'CroSwap',
                price: Number(pair.priceUsd),
                latencyMs: Math.round(performance.now() - start),
                timestamp: Date.now(),
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * Query Moonlander Perpetual DEX.
     * Returns price only from actual Moonlander contract.
     * Does NOT fallback to Pyth to avoid mislabeling.
     */
    private async queryMoonlander(symbol: PriceFeedSymbol): Promise<PriceSource | null> {
        const start = performance.now();

        try {
            const { moonlanderIntegration } = await import('../../lib/blockchain/moonlander');

            const pair = symbol.replace('/', '-');

            const price = await moonlanderIntegration.getTokenPrice(pair, true);

            if (price > 0) {
                return {
                    name: 'Moonlander',
                    price,
                    latencyMs: Math.round(performance.now() - start),
                    timestamp: Date.now(),
                };
            }

            return null;
        } catch {
            return null;
        }
    }

    /**
     * Get current prices for multiple pairs in parallel
     */
    async getCurrentPrices(): Promise<{
        btcUsd: AggregatedPrice;
        ethUsd: AggregatedPrice;
        croUsd: AggregatedPrice;
        timestamp: number;
        totalLatencyMs: number;
    }> {
        const start = performance.now();

        // Query all pairs in parallel
        const [btcUsd, ethUsd, croUsd] = await Promise.all([
            this.getAggregatedPrice('BTC/USD'),
            this.getAggregatedPrice('ETH/USD'),
            this.getAggregatedPrice('CRO/USD'),
        ]);

        return {
            btcUsd,
            ethUsd,
            croUsd,
            timestamp: Date.now(),
            totalLatencyMs: Math.round(performance.now() - start),
        };
    }

    /**
     * Find best venue for a trade
     */
    async findBestVenue(params: {
        pair: string;
        sizeUsd: number;
        side: 'buy' | 'sell';
    }): Promise<{
        venue: string;
        price: number;
        estimatedSlippage: number;
        latencyMs: number;
    }> {
        const symbol = params.pair.replace('-', '/') as PriceFeedSymbol;
        const aggregated = await this.getAggregatedPrice(symbol);

        const bestVenue = aggregated.sources[0] || {
            name: 'Pyth Oracle',
            price: aggregated.bestPrice,
            latencyMs: 0,
        };

        // Estimate slippage based on size
        const slippage = params.sizeUsd > 100000 ? 0.5 : params.sizeUsd > 10000 ? 0.2 : 0.1;

        return {
            venue: bestVenue.name,
            price: bestVenue.price,
            estimatedSlippage: slippage,
            latencyMs: bestVenue.latencyMs,
        };
    }
}

export const multiDexAggregator = new MultiDexAggregator();

// Export types for frontend
export type { PriceSource, AggregatedPrice };

// Backward-compatible simple interface
export const priceAggregator = {
    async getCurrentPrices() {
        const result = await multiDexAggregator.getCurrentPrices();
        return {
            btcUsd: result.btcUsd.bestPrice,
            ethUsd: result.ethUsd.bestPrice,
            croUsd: result.croUsd.bestPrice,
            usdcUsd: 1,
            timestamp: result.timestamp,
        };
    },

    // Full data with all sources for UI
    async getFullPriceData() {
        return await multiDexAggregator.getCurrentPrices();
    },

    async getPrice(symbol: PriceFeedSymbol): Promise<number> {
        const result = await multiDexAggregator.getAggregatedPrice(symbol);
        return result.bestPrice;
    },

    async calculateTradeValue(params: { pair: string; size: number }): Promise<number> {
        const [base] = params.pair.split('-');
        const symbol = `${base}/USD` as PriceFeedSymbol;
        const price = await this.getPrice(symbol);
        return params.size * price;
    },
};
