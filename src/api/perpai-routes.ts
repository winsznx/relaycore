import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { perpIndexer } from '../services/indexer/perp-indexer.js';
import { TradeRouter } from '../services/perpai/trade-router.js';
import { x402PaymentMiddleware } from './middleware/x402-payment.js';
import { requirePayment } from '../services/x402/payment-middleware.js';
import logger from '../lib/logger.js';

const router = Router();
const tradeRouter = new TradeRouter();

/**
 * PerpAI API Routes
 * 
 * Endpoints for perpetual DEX aggregation including quote aggregation,
 * funding rate queries, and position management.
 */

// ============================================
// QUOTE ENDPOINTS
// ============================================

/**
 * POST /api/perpai/quote
 * 
 * Get aggregated quote from all venues.
 * Returns best venue with composite scoring.
 */
router.post('/quote',
    requirePayment({
        merchantAddress: process.env.PAYMENT_RECIPIENT_ADDRESS || '0x0000000000000000000000000000000000000000',
        amount: '10000', // 0.01 USDC (6 decimals)
        resourceUrl: '/api/perpai/quote',
    }),
    async (req, res) => {
        const startTime = performance.now();

        try {
            const { pair, side, leverage, sizeUsd } = req.body;

            if (!pair || !side || !leverage || !sizeUsd) {
                return res.status(400).json({
                    error: 'Missing required fields: pair, side, leverage, sizeUsd'
                });
            }

            if (leverage < 1 || leverage > 100) {
                return res.status(400).json({
                    error: 'Leverage must be between 1 and 100'
                });
            }

            const quote = await tradeRouter.getQuote({
                pair,
                side,
                leverage: Number(leverage),
                sizeUsd: Number(sizeUsd)
            });

            const latencyMs = Math.round(performance.now() - startTime);

            res.json({
                quote,
                latencyMs,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Quote aggregation failed', error as Error);
            res.status(500).json({ error: 'Failed to get quote' });
        }
    }
);

/**
 * GET /api/perpai/venues
 * 
 * List all available perp venues with current metrics.
 */
router.get('/venues', async (req, res) => {
    try {
        const { data: venues, error } = await supabase
            .from('dex_venues')
            .select('*')
            .eq('is_active', true)
            .order('name');

        if (error) throw error;

        // Get reputation metrics for each venue
        const venuesWithMetrics = await Promise.all(
            (venues || []).map(async (venue) => {
                const { data: trades } = await supabase
                    .from('trades')
                    .select('status')
                    .eq('venue_id', venue.id)
                    .limit(100);

                const totalTrades = trades?.length || 0;
                const successfulTrades = trades?.filter(t => t.status === 'closed').length || 0;
                const successRate = totalTrades > 0
                    ? Math.round((successfulTrades / totalTrades) * 100)
                    : 0;

                return {
                    id: venue.id,
                    name: venue.name,
                    chain: venue.chain,
                    maxLeverage: venue.max_leverage,
                    tradingFeeBps: venue.trading_fee_bps,
                    contractAddress: venue.contract_address,
                    totalTrades,
                    successRate
                };
            })
        );

        res.json({ venues: venuesWithMetrics });
    } catch (error) {
        logger.error('Venues fetch failed', error as Error);
        res.status(500).json({ error: 'Failed to fetch venues' });
    }
});

// ============================================
// FUNDING RATE ENDPOINTS
// ============================================

/**
 * GET /api/perpai/funding-rates
 * 
 * Get current funding rates across venues.
 */
router.get('/funding-rates', async (req, res) => {
    try {
        const { venue, token } = req.query;

        const rates = await perpIndexer.getCurrentFundingRates(
            venue ? String(venue) : undefined
        );

        let filtered = rates;
        if (token) {
            filtered = rates.filter((r: { token: string }) => r.token === token);
        }

        res.json({
            fundingRates: filtered,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Funding rates fetch failed', error as Error);
        res.status(500).json({ error: 'Failed to fetch funding rates' });
    }
});

/**
 * GET /api/perpai/funding-rates/history
 * 
 * Get historical funding rates.
 */
router.get('/funding-rates/history', async (req, res) => {
    try {
        const {
            venue,
            token,
            from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            to = new Date().toISOString(),
            limit = 100
        } = req.query;

        let query = supabase
            .from('funding_rates_timeseries')
            .select('*')
            .gte('timestamp', from)
            .lte('timestamp', to)
            .order('timestamp', { ascending: false })
            .limit(Number(limit));

        if (venue) query = query.eq('venue', venue);
        if (token) query = query.eq('token', token);

        const { data, error } = await query;

        if (error) throw error;

        res.json({
            history: data,
            from,
            to,
            count: data?.length || 0
        });
    } catch (error) {
        logger.error('Funding history fetch failed', error as Error);
        res.status(500).json({ error: 'Failed to fetch funding history' });
    }
});

// ============================================
// LIQUIDITY ENDPOINTS
// ============================================

/**
 * GET /api/perpai/liquidity
 * 
 * Get current liquidity across venues.
 */
router.get('/liquidity', async (req, res) => {
    try {
        const { venue, token } = req.query;

        if (!venue) {
            return res.status(400).json({ error: 'venue is required' });
        }

        const liquidity = await perpIndexer.getVenueLiquidity(
            String(venue),
            token ? String(token) : undefined
        );

        res.json({
            venue,
            liquidity,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Liquidity fetch failed', error as Error);
        res.status(500).json({ error: 'Failed to fetch liquidity' });
    }
});

// ============================================
// POSITION ENDPOINTS
// ============================================

/**
 * GET /api/perpai/positions
 * 
 * Get position events for a user.
 */
router.get('/positions', async (req, res) => {
    try {
        const { userAddress, venue, status, limit = 50 } = req.query;

        if (!userAddress) {
            return res.status(400).json({ error: 'userAddress is required' });
        }

        let query = supabase
            .from('position_events')
            .select('*')
            .eq('user_address', String(userAddress).toLowerCase())
            .order('timestamp', { ascending: false })
            .limit(Number(limit));

        if (venue) query = query.eq('venue', venue);
        if (status) query = query.eq('event_type', status);

        const { data, error } = await query;

        if (error) throw error;

        res.json({
            userAddress,
            positions: data,
            count: data?.length || 0
        });
    } catch (error) {
        logger.error('Positions fetch failed', error as Error);
        res.status(500).json({ error: 'Failed to fetch positions' });
    }
});

/**
 * GET /api/perpai/positions/stats
 * 
 * Get aggregated position stats for a user.
 */
router.get('/positions/stats', async (req, res) => {
    try {
        const { userAddress } = req.query;

        if (!userAddress) {
            return res.status(400).json({ error: 'userAddress is required' });
        }

        const { data, error } = await supabase
            .from('position_events')
            .select('event_type, pnl_usd, fees_usd, size_usd')
            .eq('user_address', String(userAddress).toLowerCase());

        if (error) throw error;

        const stats = {
            totalPositions: data?.length || 0,
            opens: data?.filter(p => p.event_type === 'open').length || 0,
            closes: data?.filter(p => p.event_type === 'close').length || 0,
            liquidations: data?.filter(p => p.event_type === 'liquidate').length || 0,
            totalPnl: data?.reduce((sum, p) => sum + (p.pnl_usd || 0), 0) || 0,
            totalFees: data?.reduce((sum, p) => sum + (p.fees_usd || 0), 0) || 0,
            totalVolume: data?.reduce((sum, p) => sum + (p.size_usd || 0), 0) || 0
        };

        res.json({
            userAddress,
            stats
        });
    } catch (error) {
        logger.error('Position stats fetch failed', error as Error);
        res.status(500).json({ error: 'Failed to fetch position stats' });
    }
});

// ============================================
// ANALYTICS ENDPOINTS
// ============================================

/**
 * GET /api/perpai/volume
 * 
 * Get daily volume statistics.
 */
router.get('/volume', async (req, res) => {
    try {
        const {
            venue,
            days = 7
        } = req.query;

        const fromDate = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);

        let query = supabase
            .from('venue_daily_volume')
            .select('*')
            .gte('day', fromDate.toISOString())
            .order('day', { ascending: false });

        if (venue) query = query.eq('venue', venue);

        const { data, error } = await query;

        if (error) {
            // View might not exist yet
            return res.json({
                volume: [],
                message: 'Volume data not yet available'
            });
        }

        res.json({
            volume: data,
            days: Number(days)
        });
    } catch (error) {
        logger.error('Volume fetch failed', error as Error);
        res.status(500).json({ error: 'Failed to fetch volume' });
    }
});

export default router;
