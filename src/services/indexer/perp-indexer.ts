/**
 * Perp Indexer - Perpetual DEX data indexing
 */

import logger from '../../lib/logger.js';
import { supabase } from '../../lib/supabase.js';

export interface PerpPosition {
    id: string;
    trader: string;
    pair: string;
    isLong: boolean;
    size: string;
    collateral: string;
    entryPrice: string;
    liquidationPrice: string;
    pnl: string;
    openedAt: Date;
}

export interface PerpTrade {
    id: string;
    trader: string;
    pair: string;
    isLong: boolean;
    size: string;
    price: string;
    fee: string;
    timestamp: Date;
}

export const perpIndexer = {
    async getOpenPositions(trader?: string): Promise<PerpPosition[]> {
        logger.info('Fetching open positions', { trader });

        let query = supabase
            .from('trades')
            .select('*')
            .eq('status', 'open');

        if (trader) {
            query = query.eq('user_address', trader);
        }

        const { data, error } = await query;

        if (error) {
            logger.error('Failed to fetch open positions', error);
            return [];
        }

        return data.map(t => ({
            id: t.id,
            trader: t.user_address,
            pair: t.pair,
            isLong: t.side === 'long',
            size: t.size_usd?.toString() || '0',
            collateral: (parseFloat(t.size_usd || '0') / parseFloat(t.leverage || '1')).toFixed(2),
            entryPrice: t.entry_price?.toString() || '0',
            liquidationPrice: t.liquidation_price?.toString() || '0',
            pnl: t.pnl_usd?.toString() || '0',
            openedAt: new Date(t.created_at),
        }));
    },

    async getRecentTrades(pair?: string, limit: number = 50): Promise<PerpTrade[]> {
        logger.info('Fetching recent trades', { pair, limit });

        let query = supabase
            .from('trades')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (pair) {
            query = query.eq('pair', pair);
        }

        const { data, error } = await query;

        if (error) {
            logger.error('Failed to fetch recent trades', error);
            return [];
        }

        return data.map(t => ({
            id: t.id,
            trader: t.user_address,
            pair: t.pair,
            isLong: t.side === 'long',
            size: t.size_usd?.toString() || '0',
            price: t.entry_price?.toString() || '0',
            fee: '0', // Calculate from trading_fee_bps if needed
            timestamp: new Date(t.created_at),
        }));
    },

    async getTraderStats(trader: string): Promise<{
        totalTrades: number;
        totalVolume: string;
        totalPnl: string;
        winRate: number;
    }> {
        logger.info('Fetching trader stats', { trader });

        const { data, error } = await supabase
            .from('trades')
            .select('size_usd, pnl_usd, status')
            .eq('user_address', trader);

        if (error) {
            logger.error('Failed to fetch trader stats', error);
            return {
                totalTrades: 0,
                totalVolume: '0',
                totalPnl: '0',
                winRate: 0
            };
        }

        const totalTrades = data.length;
        const totalVolume = data.reduce((sum, t) => sum + parseFloat(t.size_usd || '0'), 0);
        const totalPnl = data.reduce((sum, t) => sum + parseFloat(t.pnl_usd || '0'), 0);

        const closedTrades = data.filter(t => t.status === 'closed');
        const winningTrades = closedTrades.filter(t => parseFloat(t.pnl_usd || '0') > 0);
        const winRate = closedTrades.length > 0 ? winningTrades.length / closedTrades.length : 0;

        return {
            totalTrades,
            totalVolume: totalVolume.toFixed(2),
            totalPnl: totalPnl.toFixed(2),
            winRate: Math.round(winRate * 100) / 100
        };
    },

    async getCurrentFundingRates(venue?: string): Promise<Array<{
        venue: string;
        token: string;
        fundingRate: number;
        nextFundingTime: string;
    }>> {
        logger.info('Fetching current funding rates', { venue });

        // Query from dex_venues or a funding_rates table if it exists
        let query = supabase
            .from('dex_venues')
            .select('id, name, funding_rate_bps, next_funding_time');

        if (venue) {
            query = query.eq('name', venue);
        }

        const { data, error } = await query;

        if (error) {
            logger.error('Failed to fetch funding rates', error);
            return [];
        }

        return data.map(v => ({
            venue: v.name,
            token: 'USDC', // Default, could be expanded
            fundingRate: (v.funding_rate_bps || 0) / 10000, // Convert bps to decimal
            nextFundingTime: v.next_funding_time || new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
        }));
    },

    async getVenueLiquidity(venue: string, token?: string): Promise<{
        totalLiquidity: string;
        availableLiquidity: string;
        utilizationRate: number;
    }> {
        logger.info('Fetching venue liquidity', { venue, token });

        // Query recent trades to estimate liquidity
        const { data: recentTrades } = await supabase
            .from('trades')
            .select('size_usd, venue_id')
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        if (!recentTrades) {
            return {
                totalLiquidity: '0',
                availableLiquidity: '0',
                utilizationRate: 0
            };
        }

        // Get venue ID
        const { data: venueData } = await supabase
            .from('dex_venues')
            .select('id, total_liquidity')
            .eq('name', venue)
            .single();

        if (!venueData) {
            return {
                totalLiquidity: '0',
                availableLiquidity: '0',
                utilizationRate: 0
            };
        }

        const venueTrades = recentTrades.filter(t => t.venue_id === venueData.id);
        const totalVolume = venueTrades.reduce((sum, t) => sum + parseFloat(t.size_usd || '0'), 0);

        // Estimate total liquidity (could be from venue metadata)
        const totalLiquidity = venueData.total_liquidity || totalVolume * 10; // Rough estimate
        const availableLiquidity = totalLiquidity - totalVolume;
        const utilizationRate = totalLiquidity > 0 ? (totalVolume / totalLiquidity) : 0;

        return {
            totalLiquidity: totalLiquidity.toFixed(2),
            availableLiquidity: Math.max(0, availableLiquidity).toFixed(2),
            utilizationRate: Math.round(utilizationRate * 100) / 100
        };
    },

    async indexPerpData(): Promise<void> {
        logger.info('Indexing perp data');

        // This would be called by the indexer cron to update perp data
        // For now, data is already in the trades table from direct inserts

        // Could add logic here to:
        // - Update PnL for open positions based on current prices
        // - Mark positions as liquidated if price hits liquidation price
        // - Calculate and update trader statistics

        logger.info('Perp data indexing complete');
    }
};

export default perpIndexer;
