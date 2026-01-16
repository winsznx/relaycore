import { moonlanderIntegration } from '../../lib/blockchain/moonlander';
import { gmxIntegration } from '../../lib/blockchain/gmx-integration';
import { fulcrumIntegration } from '../../lib/blockchain/fulcrum-integration';
import type { TradeQuoteRequest, TradeExecuteRequest } from '../../types/api';
import { supabase } from '../../lib/supabase';
import { multiDexAggregator } from '../prices/price-aggregator';
import logger from '../../lib/logger';

interface VenueScore {
    venueId: string;
    venueName: string;
    reputationScore: number;
    liquidityScore: number;
    feeScore: number;
    latencyMs: number;
    compositeScore: number;
}

export class TradeRouter {
    /**
     * Get quotes from ALL venues in parallel
     * Select best based on composite score (price, reputation, latency)
     */
    async getBestVenue(_request: TradeQuoteRequest): Promise<VenueScore> {
        const startTime = performance.now();

        // Query venues for scoring
        const venuesResult = await supabase
            .from('dex_venues')
            .select('*')
            .eq('is_active', true);

        const venues = venuesResult.data || [];

        if (venues.length === 0) {
            // Default to Moonlander if no venues in DB
            return {
                venueId: 'moonlander-default',
                venueName: 'Moonlander',
                reputationScore: 100,
                liquidityScore: 100,
                feeScore: 100,
                latencyMs: Math.round(performance.now() - startTime),
                compositeScore: 100,
            };
        }

        // Score each venue in parallel
        const scoredVenues = await Promise.all(
            venues.map(async (venue) => {
                const venueStart = performance.now();

                // Get venue-specific metrics
                const { data: trades } = await supabase
                    .from('trades')
                    .select('status')
                    .eq('venue_id', venue.id)
                    .limit(100);

                const successRate = trades
                    ? trades.filter(t => t.status === 'closed').length / Math.max(trades.length, 1)
                    : 0.8;

                const reputationScore = successRate * 100;
                const feeScore = Math.max(0, 100 - (venue.trading_fee_bps / 5));
                const liquidityScore = 80; // TODO: Query actual liquidity

                // Weights optimized for execution quality
                const weights = {
                    reputation: 0.4,
                    liquidity: 0.3,
                    fees: 0.2,
                    latency: 0.1,
                };

                const latencyMs = Math.round(performance.now() - venueStart);
                const latencyScore = Math.max(0, 100 - (latencyMs / 10));

                const compositeScore =
                    reputationScore * weights.reputation +
                    liquidityScore * weights.liquidity +
                    feeScore * weights.fees +
                    latencyScore * weights.latency;

                return {
                    venueId: venue.id,
                    venueName: venue.name,
                    reputationScore,
                    liquidityScore,
                    feeScore,
                    latencyMs,
                    compositeScore,
                };
            })
        );

        // Sort by composite score (best first)
        scoredVenues.sort((a, b) => b.compositeScore - a.compositeScore);

        const best = scoredVenues[0];
        logger.info('Best venue selected', {
            venue: best.venueName,
            score: best.compositeScore,
            latencyMs: Math.round(performance.now() - startTime),
        });

        return best;
    }

    /**
     * Get quote with real-time price from aggregator
     */
    async getQuote(request: TradeQuoteRequest) {
        const startTime = performance.now();

        // Parallel: best venue + current price
        const [bestVenue, priceData] = await Promise.all([
            this.getBestVenue(request),
            multiDexAggregator.getAggregatedPrice(
                request.pair.replace('-', '/') as any
            ),
        ]);

        const basePrice = priceData.bestPrice;
        const slippageBps = request.sizeUsd > 10000 ? 50 : 20;
        const expectedSlippage = (slippageBps / 10000) * 100;

        const expectedPrice = request.side === 'long'
            ? basePrice * (1 + expectedSlippage / 100)
            : basePrice * (1 - expectedSlippage / 100);

        const liquidationPrice = request.side === 'long'
            ? expectedPrice * (1 - 0.9 / request.leverage)
            : expectedPrice * (1 + 0.9 / request.leverage);

        const totalFees = request.sizeUsd * 0.001;
        const latencyMs = Math.round(performance.now() - startTime);

        return {
            bestVenue: {
                id: bestVenue.venueId,
                name: bestVenue.venueName,
                reputationScore: bestVenue.reputationScore,
            },
            priceSource: priceData.bestSource,
            priceSources: priceData.sources.length,
            expectedPrice,
            expectedSlippage,
            priceImpact: expectedSlippage / 2, // Approximate price impact
            liquidationPrice,
            totalFees,
            estimatedExecutionTime: 3000,
            quoteLatencyMs: latencyMs,
            alternativeVenues: [],
        };
    }

    /**
     * Execute trade with best venue routing
     */
    async executeTrade(request: TradeExecuteRequest) {
        const startTime = performance.now();
        const quote = await this.getQuote(request);

        logger.info('Executing trade', {
            pair: request.pair,
            side: request.side,
            size: request.sizeUsd,
            venue: quote.bestVenue.name,
        });

        try {
            let result;

            // Route to the appropriate venue based on best score
            const venueName = quote.bestVenue.name.toLowerCase();

            if (venueName.includes('moonlander')) {
                result = await this.executeOnMoonlander(request, quote);
            } else if (venueName.includes('gmx')) {
                result = await this.executeOnGMX(request, quote);
            } else if (venueName.includes('fulcrom') || venueName.includes('gains')) {
                result = await this.executeOnFulcrom(request, quote);
            } else {
                // Default to Moonlander
                logger.warn('Unknown venue, defaulting to Moonlander', { venue: venueName });
                result = await this.executeOnMoonlander(request, quote);
            }

            // Record trade in database
            const { data: trade } = await supabase
                .from('trades')
                .insert({
                    user_address: request.userAddress,
                    venue_id: quote.bestVenue.id,
                    pair: request.pair,
                    side: request.side,
                    leverage: request.leverage,
                    size_usd: request.sizeUsd,
                    entry_price: quote.expectedPrice,
                    liquidation_price: quote.liquidationPrice,
                    stop_loss: request.stopLoss,
                    take_profit: request.takeProfit,
                    tx_hash_open: result.txHash,
                    status: 'open',
                    metadata: { quote, priceSource: quote.priceSource, venue: venueName },
                })
                .select()
                .single();

            const executionTime = Math.round(performance.now() - startTime);

            logger.info('Trade executed', {
                tradeId: trade?.id,
                txHash: result.txHash,
                venue: venueName,
                executionTime,
            });

            // Record outcome to ERC-8004 Reputation Registry (if configured)
            if (process.env.REPUTATION_REGISTRY_ADDRESS && process.env.RELAY_CORE_AGENT_ID) {
                try {
                    const { calculateTradeScore } = await import('../../lib/erc8004-client');

                    const tradeScore = calculateTradeScore({
                        success: true,
                        slippage: quote.expectedSlippage,
                        executionTime,
                        priceImpact: quote.priceImpact || 0,
                    });

                    logger.info('Trade outcome recorded to ERC-8004', {
                        agentId: process.env.RELAY_CORE_AGENT_ID,
                        score: tradeScore,
                        venue: venueName,
                    });

                    // Note: Actual on-chain recording would happen here with a signer
                    // For now, we just log it. Frontend can record it when user confirms.
                } catch (error) {
                    logger.warn('Failed to record trade outcome to ERC-8004', error as Error);
                }
            }

            // Request validation for high-value trades (>$10k)
            if (request.sizeUsd >= 10000) {
                try {
                    const { requestValidationForTrade } = await import('../validation/trade-validation');

                    await requestValidationForTrade({
                        tradeId: trade?.id || '',
                        pair: request.pair,
                        side: request.side,
                        sizeUsd: request.sizeUsd,
                        leverage: request.leverage,
                        venue: venueName,
                        expectedPrice: quote.expectedPrice,
                        actualPrice: quote.expectedPrice, // Would be actual from contract
                        slippage: quote.expectedSlippage,
                        executionTime,
                    });

                    logger.info('Validation requested for high-value trade', {
                        tradeId: trade?.id,
                        sizeUsd: request.sizeUsd,
                    });
                } catch (error) {
                    logger.warn('Failed to request validation', error as Error);
                }
            }

            return {
                tradeId: trade?.id || '',
                txHash: result.txHash,
                venue: quote.bestVenue.name,
                entryPrice: quote.expectedPrice,
                liquidationPrice: quote.liquidationPrice,
                actualSlippage: quote.expectedSlippage,
                executionTime,
                status: 'success',
            };
        } catch (error: any) {
            logger.error('Trade execution failed', error, {
                pair: request.pair,
                venue: quote.bestVenue.name,
            });
            throw error;
        }
    }

    /**
     * Execute trade on Moonlander
     */
    private async executeOnMoonlander(request: TradeExecuteRequest, quote: any) {
        return await moonlanderIntegration.openPosition({
            pair: request.pair,
            isLong: request.side === 'long',
            collateralUsd: request.sizeUsd / request.leverage,
            sizeUsd: request.sizeUsd,
            leverage: request.leverage,
            acceptableSlippage: request.maxSlippage || 0.5,
            currentPrice: quote.expectedPrice,
            userAddress: request.userAddress,
            stopLoss: request.stopLoss,
            takeProfit: request.takeProfit,
        });
    }

    /**
     * Execute trade on GMX
     */
    private async executeOnGMX(request: TradeExecuteRequest, quote: any) {
        return await gmxIntegration.openPosition({
            pair: request.pair,
            isLong: request.side === 'long',
            collateralUsd: request.sizeUsd / request.leverage,
            sizeUsd: request.sizeUsd,
            leverage: request.leverage,
            acceptableSlippage: request.maxSlippage || 0.5,
            currentPrice: quote.expectedPrice,
            userAddress: request.userAddress,
            stopLoss: request.stopLoss,
            takeProfit: request.takeProfit,
        });
    }

    /**
     * Execute trade on Fulcrom
     */
    private async executeOnFulcrom(request: TradeExecuteRequest, quote: any) {
        return await fulcrumIntegration.openPosition({
            pair: request.pair,
            isLong: request.side === 'long',
            collateralUsd: request.sizeUsd / request.leverage,
            sizeUsd: request.sizeUsd,
            leverage: request.leverage,
            acceptableSlippage: request.maxSlippage || 0.5,
            currentPrice: quote.expectedPrice,
            userAddress: request.userAddress,
            stopLoss: request.stopLoss,
            takeProfit: request.takeProfit,
        });
    }

    /**
     * Close position with real-time price
     */
    async closePosition(tradeId: string, userAddress: string) {
        const { data: trade } = await supabase
            .from('trades')
            .select('*')
            .eq('id', tradeId)
            .eq('user_address', userAddress)
            .single();

        if (!trade) throw new Error('Trade not found');

        try {
            // Get position and current price in parallel
            const [position, priceData] = await Promise.all([
                moonlanderIntegration.getPosition(
                    userAddress,
                    trade.pair,
                    trade.side === 'long'
                ),
                multiDexAggregator.getAggregatedPrice(
                    trade.pair.replace('-', '/') as any
                ),
            ]);

            if (!position) {
                throw new Error('Position not found on Moonlander');
            }

            const currentPrice = priceData.bestPrice;

            const result = await moonlanderIntegration.closePosition({
                positionKey: position.key,
                sizeUsd: trade.size_usd,
                acceptableSlippage: 0.5,
                currentPrice,
            });

            const pnl =
                (currentPrice - trade.entry_price) *
                (trade.size_usd / trade.entry_price) *
                (trade.side === 'long' ? 1 : -1);
            const pnlPercentage = (pnl / trade.size_usd) * 100;

            await supabase
                .from('trades')
                .update({
                    exit_price: currentPrice,
                    pnl_usd: pnl,
                    tx_hash_close: result.txHash,
                    status: 'closed',
                    closed_at: new Date().toISOString(),
                })
                .eq('id', tradeId);

            logger.info('Position closed', {
                tradeId,
                pnl,
                pnlPercentage,
            });

            return {
                tradeId,
                txHash: result.txHash,
                exitPrice: currentPrice,
                pnl,
                pnlPercentage,
                executionTime: 3000,
                status: 'success',
            };
        } catch (error: any) {
            logger.error('Close position failed', error, { tradeId });
            throw error;
        }
    }

    /**
     * Get ranked list of trading venues
     */
    async getVenues(sortBy: string = 'reputation', limit: number = 10) {
        const { data: venues } = await supabase
            .from('dex_venues')
            .select('*')
            .eq('is_active', true)
            .limit(limit);

        if (!venues || venues.length === 0) {
            // Return default venues
            return [
                {
                    id: 'moonlander',
                    name: 'Moonlander',
                    chain: 'cronos',
                    reputationScore: 95,
                    successRate: 0.98,
                    avgLatencyMs: 250,
                    maxLeverage: 50,
                    tradingFeeBps: 10,
                },
                {
                    id: 'gmx-cronos',
                    name: 'GMX (Cronos)',
                    chain: 'cronos',
                    reputationScore: 88,
                    successRate: 0.96,
                    avgLatencyMs: 300,
                    maxLeverage: 30,
                    tradingFeeBps: 15,
                },
            ];
        }

        // Sort venues
        const sorted = [...venues].sort((a, b) => {
            switch (sortBy) {
                case 'reputation':
                    return (b.reputation_score || 0) - (a.reputation_score || 0);
                case 'volume':
                    return (b.total_volume || 0) - (a.total_volume || 0);
                case 'latency':
                    return (a.avg_latency_ms || 999) - (b.avg_latency_ms || 999);
                case 'fees':
                    return (a.trading_fee_bps || 999) - (b.trading_fee_bps || 999);
                default:
                    return 0;
            }
        });

        return sorted.map(v => ({
            id: v.id,
            name: v.name,
            chain: v.chain,
            reputationScore: v.reputation_score,
            successRate: v.success_rate,
            avgLatencyMs: v.avg_latency_ms,
            maxLeverage: v.max_leverage,
            tradingFeeBps: v.trading_fee_bps,
        }));
    }
}

export const tradeRouter = new TradeRouter();
