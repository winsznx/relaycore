/**
 * Dashboard Pages - Production Implementation
 * 
 * Features:
 * - Real data fetching with hooks
 * - Loading skeletons for perceived performance
 * - Error boundaries and retry logic
 * - Empty states
 * - Accessibility support (ARIA labels, keyboard navigation)
 * - Responsive design
 * - Optimistic updates
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    CheckCircle2, Clock, MoreHorizontal, Shield, Zap, Search,
    User, Lock, Bell, Loader2, TrendingUp, TrendingDown, AlertTriangle,
    RefreshCw, ArrowUpRight, ArrowDownRight, Wallet, DollarSign
} from 'lucide-react';
import {
    SkeletonCard, SkeletonStats, SkeletonTable,
    EmptyState, AsyncBoundary, toast
} from '@/components/ui/states';
import {
    useUserTrades, useServices, useDashboardStats,
    useExecuteTrade, useUserServices,
    useUserPositions, useVenues
} from '@/lib/hooks';
import { useMarketPrices, useFullPriceData, type AggregatedPrice } from '@/hooks/usePrices';
import type { TradeExecuteRequest } from '../types/api';
import { useAppKitAccount, useAppKit } from '@/lib/web3';
import { ActivityFeed } from '@/components/ActivityFeed';
import { IntegrationStatus } from '@/components/IntegrationStatus';
import LiveTradeChart from '@/components/LiveTradeChart';
import { useX402Payment } from '@/lib/useX402Payment';
import { QuoteDisplay } from './QuoteDisplay';
import OnChainStats from './OnChainStats';
import { FeedbackForm } from './FeedbackForm';

// ============================================
// DASHBOARD OVERVIEW
// ============================================

export function DashboardOverview() {
    const { address } = useAppKitAccount();
    const { data: stats, isLoading: statsLoading } = useDashboardStats();
    const { data: recentTrades, isLoading: tradesLoading, error: tradesError } = useUserTrades(address || null);
    useMarketPrices(); // Keep for cache warming
    const { data: fullPriceData } = useFullPriceData();

    // Compute stats from data
    const computedStats = useMemo(() => {
        if (!stats || stats.length === 0) {
            // Return zeros when no data
            return {
                totalVolume: '$0.00',
                volumeChange: '+0.0%',
                activeAgents: '0',
                agentsChange: 'No agents',
                trustScore: '0.0%',
                trustChange: 'No data',
            };
        }

        const latest = stats[0] as Record<string, any>;
        const previous = stats[1] as Record<string, any> | undefined;

        const volumeChange = previous?.total_volume_usd
            ? (((latest.total_volume_usd - previous.total_volume_usd) / previous.total_volume_usd) * 100).toFixed(1)
            : '0';

        return {
            totalVolume: `$${Number(latest.total_volume_usd || 0).toLocaleString()}`,
            volumeChange: `${Number(volumeChange) >= 0 ? '+' : ''}${volumeChange}%`,
            activeAgents: String(latest.unique_services || 0),
            agentsChange: 'active',
            trustScore: `${((latest.successful_payments / (latest.total_payments || 1)) * 100).toFixed(1)}%`,
            trustChange: 'stable',
        };
    }, [stats]);

    return (
        <div className="space-y-8">
            {/* Stats Row - Always show with computed/default values */}
            {statsLoading ? (
                <SkeletonStats count={3} />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard
                        label="Total Volume"
                        value={computedStats.totalVolume}
                        change={computedStats.volumeChange}
                        changeType={computedStats.volumeChange.startsWith('+') ? 'positive' : 'negative'}
                        icon={<TrendingUp className="h-5 w-5" />}
                        bgColor="bg-green-50"
                    />
                    <StatCard
                        label="Active Agents"
                        value={computedStats.activeAgents}
                        change={computedStats.agentsChange}
                        changeType="neutral"
                        icon={<Zap className="h-5 w-5" />}
                        bgColor="bg-orange-50"
                    />
                    <StatCard
                        label="Network Trust"
                        value={computedStats.trustScore}
                        change={computedStats.trustChange}
                        changeType="neutral"
                        icon={<Shield className="h-5 w-5" />}
                        bgColor="bg-blue-50"
                    />
                </div>
            )}


            {/* Live Prices - Expandable Cards */}
            {fullPriceData && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <ExpandablePriceCard
                        pair="BTC/USD"
                        aggregatedPrice={fullPriceData.btcUsd}
                    />
                    <ExpandablePriceCard
                        pair="ETH/USD"
                        aggregatedPrice={fullPriceData.ethUsd}
                    />
                    <ExpandablePriceCard
                        pair="CRO/USD"
                        aggregatedPrice={fullPriceData.croUsd}
                    />
                </div>
            )}

            {/* Transaction Volume Chart */}
            <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-lg font-bold text-gray-900 dark:text-gray-100">Transaction Volume</CardTitle>
                    <ChartPeriodSelector />
                </CardHeader>
                <CardContent>
                    <VolumeChart data={stats} isLoading={statsLoading} />
                </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-lg font-bold text-gray-900 dark:text-gray-100">Recent Activity</CardTitle>
                    <Button variant="ghost" size="sm" className="text-gray-500">
                        View All <ArrowUpRight className="ml-1 h-3 w-3" />
                    </Button>
                </CardHeader>
                <CardContent>
                    <AsyncBoundary
                        isLoading={tradesLoading}
                        isError={!!tradesError}
                        error={tradesError}
                        data={recentTrades}
                        loadingFallback={<SkeletonTable rows={5} cols={4} />}
                        emptyFallback={
                            <EmptyState
                                title="No recent trades"
                                description="Your trading activity will appear here."
                            />
                        }
                    >
                        {(trades) => (
                            <div className="divide-y divide-gray-50">
                                {trades.slice(0, 5).map((trade: any) => (
                                    <TradeRow key={trade.id} trade={trade} />
                                ))}
                            </div>
                        )}
                    </AsyncBoundary>
                </CardContent>
            </Card>

            {/* Integration Status & Activity Feed Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <IntegrationStatus />
                <ActivityFeed />
            </div>

            {/* On-Chain Analytics */}
            <OnChainStats />
        </div>
    );
}

// ============================================
// DASHBOARD TRADING
// ============================================

export function DashboardTrading() {
    const [pair, setPair] = useState('BTC-USD');
    const [side, setSide] = useState<'long' | 'short'>('long');
    const [amount, setAmount] = useState(1000);
    const [leverage, setLeverage] = useState(2);

    // x402 Payment state
    const [quote, setQuote] = useState<any>(null);
    const [paymentRequired, setPaymentRequired] = useState(false);
    const [paymentRequirements, setPaymentRequirements] = useState<any>(null);
    const [isGettingQuote, setIsGettingQuote] = useState(false);

    const { address, isConnected } = useAppKitAccount();
    const { open } = useAppKit();
    const userAddress = address || '';

    const { mutate, isLoading, data: result, error, reset } = useExecuteTrade();
    const { data: prices } = useMarketPrices();
    const { data: positions, isLoading: positionsLoading, refetch: refetchPositions } = useUserPositions(userAddress || null);
    const { data: venues } = useVenues();
    const { handlePayment, isProcessing: isPaymentProcessing } = useX402Payment();

    // Get current price for selected pair
    const currentPrice = useMemo(() => {
        if (!prices) return 0;
        const symbol = pair.replace('-', '').toLowerCase();
        if (symbol === 'btcusd') return prices.btcUsd;
        if (symbol === 'ethusd') return prices.ethUsd;
        if (symbol === 'crousd') return prices.croUsd;
        return 0;
    }, [prices, pair]);

    // Step 1: Get Quote (with x402 payment)
    const handleGetQuote = useCallback(async () => {
        setIsGettingQuote(true);
        setQuote(null);
        setPaymentRequired(false);

        try {
            const response = await fetch('/api/perpai/quote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pair: pair.replace('-', '-PERP'),
                    side,
                    leverage,
                    sizeUsd: amount,
                }),
            });

            if (response.status === 402) {
                // Payment required
                const requirements = await response.json();
                setPaymentRequirements(requirements);
                setPaymentRequired(true);
                setIsGettingQuote(false);
                return;
            }

            if (!response.ok) {
                throw new Error('Failed to get quote');
            }

            const quoteData = await response.json();
            setQuote(quoteData.quote);
            toast.success('Quote Ready', 'Quote fetched successfully');
        } catch (err: any) {
            toast.error('Quote Failed', err.message);
        } finally {
            setIsGettingQuote(false);
        }
    }, [pair, side, leverage, amount]);

    // Handle x402 payment
    const handlePayAndRetry = useCallback(async () => {
        console.log('handlePayAndRetry called');
        console.log('Payment requirements:', paymentRequirements);

        if (!paymentRequirements) {
            console.error('No payment requirements!');
            return;
        }

        try {
            console.log('Calling handlePayment...');
            const paymentId = await handlePayment(paymentRequirements);
            console.log('Payment ID received:', paymentId);

            // Retry quote with payment
            console.log('Retrying quote with payment...');
            const response = await fetch('/api/perpai/quote', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Payment-Id': paymentId,
                },
                body: JSON.stringify({
                    pair: pair.replace('-', '-PERP'),
                    side,
                    leverage,
                    sizeUsd: amount,
                }),
            });

            console.log('[API] Quote response status:', response.status);

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Quote failed:', errorData);
                throw new Error('Failed to get quote after payment');
            }

            const quoteData = await response.json();
            console.log('Quote received:', quoteData);
            setQuote(quoteData.quote);
            setPaymentRequired(false);
            toast.success('Quote Ready', 'Quote fetched successfully');
        } catch (err: any) {
            console.error('handlePayAndRetry error:', err);
            toast.error('Payment Failed', err.message);
        }
    }, [paymentRequirements, handlePayment, pair, side, leverage, amount]);

    // Step 2: Execute Trade (using quote)
    const handleTrade = useCallback(async () => {
        if (!quote) {
            toast.error('No Quote', 'Please get a quote first');
            return;
        }

        reset();

        const request: TradeExecuteRequest = {
            pair,
            side,
            leverage,
            sizeUsd: amount,
            userAddress,
            urgency: 'medium',
            maxSlippage: 1.0,
        };

        const response = await mutate(request);

        if (response) {
            toast.success('Trade Executed', `${side.toUpperCase()} ${pair} opened successfully`);
            setQuote(null); // Clear quote after execution
        } else if (error) {
            toast.error('Trade Failed', error.message);
        }
    }, [quote, pair, side, leverage, amount, userAddress, mutate, reset, error]);

    // Estimated liquidation price
    const liquidationPrice = useMemo(() => {
        if (!currentPrice || leverage <= 1) return 0;
        const liquidationPercent = 1 / leverage;
        return side === 'long'
            ? currentPrice * (1 - liquidationPercent)
            : currentPrice * (1 + liquidationPercent);
    }, [currentPrice, leverage, side]);

    return (
        <div className="space-y-6 max-w-2xl">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">PerpAI Trading</h2>
                    <p className="text-gray-500">AI-optimized perpetual trading</p>
                </div>
                {currentPrice > 0 && (
                    <div className="text-right">
                        <p className="text-xs text-gray-500">{pair}</p>
                        <p className="text-xl font-bold font-mono">
                            ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                )}
            </div>

            <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                <CardContent className="p-6 space-y-6">
                    {/* Pair & Side */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label htmlFor="pair-select" className="text-sm font-medium">Pair</label>
                            <select
                                id="pair-select"
                                className="w-full h-10 px-3 rounded-md border border-gray-200 bg-white focus:ring-2 focus:ring-[#111111] focus:border-transparent"
                                value={pair}
                                onChange={(e) => setPair(e.target.value)}
                                aria-label="Select trading pair"
                            >
                                <option value="BTC-USD">BTC-USD</option>
                                <option value="ETH-USD">ETH-USD</option>
                                <option value="CRO-USD">CRO-USD</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Side</label>
                            <div className="flex bg-gray-100 rounded-lg p-1" role="group" aria-label="Trade side">
                                <button
                                    type="button"
                                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${side === 'long'
                                        ? 'bg-green-500 text-white shadow-sm'
                                        : 'text-gray-500 hover:text-gray-900'
                                        }`}
                                    onClick={() => setSide('long')}
                                    aria-pressed={side === 'long'}
                                >
                                    <TrendingUp className="inline-block h-4 w-4 mr-1" />
                                    Long
                                </button>
                                <button
                                    type="button"
                                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${side === 'short'
                                        ? 'bg-red-500 text-white shadow-sm'
                                        : 'text-gray-500 hover:text-gray-900'
                                        }`}
                                    onClick={() => setSide('short')}
                                    aria-pressed={side === 'short'}
                                >
                                    <TrendingDown className="inline-block h-4 w-4 mr-1" />
                                    Short
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Amount */}
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <label htmlFor="amount-slider" className="text-sm font-medium">Size (USD)</label>
                            <span className="text-sm font-mono font-bold">${amount.toLocaleString()}</span>
                        </div>
                        <input
                            id="amount-slider"
                            type="range"
                            min="100"
                            max="100000"
                            step="100"
                            className="w-full accent-[#111111] h-2"
                            value={amount}
                            onChange={(e) => setAmount(Number(e.target.value))}
                            aria-valuemin={100}
                            aria-valuemax={100000}
                            aria-valuenow={amount}
                        />
                        <div className="flex justify-between text-xs text-gray-400">
                            <span>$100</span>
                            <span>$100,000</span>
                        </div>
                    </div>

                    {/* Leverage */}
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <label htmlFor="leverage-slider" className="text-sm font-medium">Leverage</label>
                            <span className={`text-sm font-mono font-bold ${leverage > 10 ? 'text-orange-600' : ''} ${leverage > 25 ? 'text-red-600' : ''}`}>
                                {leverage}x
                            </span>
                        </div>
                        <input
                            id="leverage-slider"
                            type="range"
                            min="1"
                            max="50"
                            step="1"
                            className="w-full accent-[#111111] h-2"
                            value={leverage}
                            onChange={(e) => setLeverage(Number(e.target.value))}
                        />
                        <div className="flex justify-between text-xs text-gray-400">
                            <span>1x</span>
                            <span className="text-orange-600">10x</span>
                            <span className="text-red-600">50x</span>
                        </div>
                        {leverage > 25 && (
                            <div className="flex items-center gap-2 text-xs text-orange-600 bg-orange-50 p-2 rounded">
                                <AlertTriangle className="h-3 w-3" />
                                High leverage increases liquidation risk
                            </div>
                        )}
                    </div>

                    {/* Trade Summary */}
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-500">Position Size</span>
                            <span className="font-mono font-bold">${(amount * leverage).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Est. Fees (0.1%)</span>
                            <span className="font-mono">${(amount * leverage * 0.001).toFixed(2)}</span>
                        </div>
                        {liquidationPrice > 0 && (
                            <div className="flex justify-between">
                                <span className="text-gray-500">Est. Liquidation</span>
                                <span className="font-mono text-red-600">
                                    ${liquidationPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Quote Display */}
                    {quote && (
                        <QuoteDisplay
                            quote={{
                                venue: quote.bestVenue?.name || quote.venue || 'Unknown',
                                entryPrice: quote.expectedPrice || quote.price || currentPrice,
                                estimatedFees: quote.totalFees || quote.fees || (amount * leverage * 0.001),
                                fundingRate: quote.fundingRate || 0.0001,
                                slippage: quote.expectedSlippage || quote.slippage || 0.1,
                                quoteTimestamp: Date.now(),
                            }}
                            pair={pair}
                            side={side}
                            onExpire={() => setQuote(null)}
                        />
                    )}

                    {/* Payment Required Modal */}
                    {paymentRequired && paymentRequirements && (
                        <Card className="border-2 border-orange-500 bg-orange-50/50">
                            <CardContent className="p-4 space-y-3">
                                <div className="flex items-center gap-2">
                                    <DollarSign className="h-5 w-5 text-orange-600" />
                                    <span className="font-semibold text-orange-900">Payment Required</span>
                                </div>
                                <p className="text-sm text-gray-700">
                                    Pay <span className="font-bold">0.01 USDC</span> to get a trading quote from PerpAI
                                </p>
                                <Button
                                    className="w-full bg-orange-600 hover:bg-orange-700"
                                    onClick={handlePayAndRetry}
                                    disabled={isPaymentProcessing}
                                >
                                    {isPaymentProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {isPaymentProcessing ? 'Processing Payment...' : 'Pay 0.01 USDC & Get Quote'}
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {/* Action Buttons */}
                    {!isConnected ? (
                        <Button
                            className="w-full h-12 text-lg font-bold bg-gray-900 dark:bg-gray-800 hover:bg-black"
                            onClick={() => open()}
                        >
                            <Wallet className="mr-2 h-5 w-5" />
                            Connect Wallet to Trade
                        </Button>
                    ) : !quote && !paymentRequired ? (
                        <Button
                            className="w-full h-12 text-lg font-bold bg-blue-600 hover:bg-blue-700"
                            onClick={handleGetQuote}
                            disabled={isGettingQuote || isPaymentProcessing}
                        >
                            {isGettingQuote && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                            {isGettingQuote ? 'Getting Quote...' : 'Get Quote (0.01 USDC)'}
                        </Button>
                    ) : quote ? (
                        <Button
                            className={`w-full h-12 text-lg font-bold transition-all ${side === 'long'
                                ? 'bg-green-600 hover:bg-green-700'
                                : 'bg-red-600 hover:bg-red-700'
                                }`}
                            onClick={handleTrade}
                            disabled={isLoading || !isConnected}
                            aria-busy={isLoading}
                        >
                            {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                            {isLoading ? 'Executing...' : `Execute ${side.toUpperCase()} Trade`}
                        </Button>
                    ) : null}

                    {/* Result Display */}
                    {(result || error) && (
                        <TradeResult result={result} error={error} />
                    )}
                </CardContent>
            </Card>

            {/* Open Positions Section */}
            {isConnected && (
                <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-lg font-semibold">Open Positions</CardTitle>
                            <Button variant="ghost" size="sm" onClick={() => refetchPositions()}>
                                <RefreshCw className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {positionsLoading ? (
                            <SkeletonTable rows={2} cols={4} />
                        ) : positions && positions.length > 0 ? (
                            <div className="space-y-3">
                                {positions.map((pos: any) => (
                                    <div key={pos.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <Badge className={pos.side === 'long' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                                                {pos.side.toUpperCase()}
                                            </Badge>
                                            <span className="font-semibold">{pos.pair}</span>
                                            <span className="text-gray-500 text-sm">{pos.leverage}x</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <div className="text-sm text-gray-500">Size</div>
                                                <div className="font-mono">${Number(pos.size_usd).toLocaleString()}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm text-gray-500">PnL</div>
                                                <div className={`font-mono ${Number(pos.pnl_usd || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {Number(pos.pnl_usd || 0) >= 0 ? '+' : ''}${Number(pos.pnl_usd || 0).toFixed(2)}
                                                </div>
                                            </div>
                                            <Badge variant="outline">{pos.dex_venues?.name || 'Unknown'}</Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-500">
                                <p>No open positions</p>
                                <p className="text-sm">Execute a trade above to open a position</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Available Venues */}
            {venues && venues.length > 0 && (
                <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-semibold">Available DEX Venues</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {venues.slice(0, 3).map((venue: any) => (
                                <div key={venue.id} className="p-3 bg-gray-50 rounded-lg">
                                    <div className="font-semibold">{venue.name}</div>
                                    <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                                        <span>Max {venue.max_leverage}x</span>
                                        <span>•</span>
                                        <span>{(venue.trading_fee_bps / 100).toFixed(2)}% fee</span>
                                    </div>
                                    {venue.reputations?.[0]?.reputation_score && (
                                        <Badge variant="outline" className="mt-2">
                                            Score: {Number(venue.reputations[0].reputation_score).toFixed(1)}
                                        </Badge>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Live Price Chart */}
            <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-semibold">Live Prices</CardTitle>
                </CardHeader>
                <CardContent>
                    <LiveTradeChart />
                </CardContent>
            </Card>
        </div>
    );
}

// ============================================
// DASHBOARD DISCOVERY
// ============================================

export function DashboardDiscovery() {
    const [searchQuery, setSearchQuery] = useState('');
    const [category, setCategory] = useState<string | undefined>(undefined);
    const { data: services, isLoading, error, refetch } = useServices(category);

    const filteredServices = useMemo(() => {
        if (!services) return [];
        if (!searchQuery) return services;

        const query = searchQuery.toLowerCase();
        return services.filter((s: any) =>
            s.name.toLowerCase().includes(query) ||
            s.description?.toLowerCase().includes(query)
        );
    }, [services, searchQuery]);

    const categories = ['oracle', 'kyc', 'data', 'compute', 'storage', 'dex'];

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Service Discovery</h2>
                    <p className="text-gray-500">Find reliable agents and services</p>
                </div>
                <div className="flex gap-2">
                    {/* Search Input */}
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="search"
                            placeholder="Search services..."
                            className="w-full pl-10 pr-4 h-10 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#111111] focus:border-transparent"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            aria-label="Search services"
                        />
                    </div>
                    <Button variant="outline" onClick={() => refetch()}>
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
                <Button
                    variant={!category ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCategory(undefined)}
                    className={!category ? 'bg-gray-900 dark:bg-gray-800' : ''}
                >
                    All
                </Button>
                {categories.map((cat) => (
                    <Button
                        key={cat}
                        variant={category === cat ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCategory(cat)}
                        className={category === cat ? 'bg-gray-900 dark:bg-gray-800' : ''}
                    >
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </Button>
                ))}
            </div>

            {/* Services Grid */}
            <AsyncBoundary
                isLoading={isLoading}
                isError={!!error}
                error={error}
                data={filteredServices}
                loadingFallback={
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
                    </div>
                }
                emptyFallback={
                    <EmptyState
                        icon={<Search className="h-12 w-12 text-gray-300" />}
                        title={searchQuery ? `No results for "${searchQuery}"` : 'No services found'}
                        description="Try adjusting your search or filters."
                    />
                }
                onRetry={refetch}
            >
                {(serviceList) => (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {serviceList.map((service: any) => (
                            <ServiceCard key={service.id} service={service} />
                        ))}
                    </div>
                )}
            </AsyncBoundary>
        </div>
    );
}

// ============================================
// DASHBOARD AGENTS
// ============================================

export function DashboardAgents() {
    const { address, isConnected } = useAppKitAccount();
    const { data: services, isLoading, error, refetch } = useUserServices(address || null);
    const navigate = useNavigate();

    // Map to table format
    const agents = (services || []).map((service: any) => {
        // Handle both array (if 1:many) or object (if 1:1) response from supabase
        const rep = Array.isArray(service.reputations) ? service.reputations[0] : (service.reputations || {});
        const total = rep.total_payments || 0;
        const success = rep.successful_payments || 0;
        const uptime = total > 0 ? ((success / total) * 100).toFixed(1) + '%' : '100%';

        return {
            name: service.name,
            id: service.id,
            status: service.is_active ? 'active' : 'paused',
            uptime,
            balance: '0.00 ETH' // Placeholder as wallet balance isn't tracked per service
        };
    });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My Agents</h2>
                    <p className="text-gray-500">Manage your autonomous agent fleet</p>
                </div>
                <Button
                    className="bg-gray-900 dark:bg-gray-800 text-white hover:bg-black"
                    onClick={() => navigate('/dashboard/agents/new')}
                >
                    <Zap className="mr-2 h-4 w-4" />
                    New Agent
                </Button>
            </div>

            <Card className="border-0 shadow-sm ring-1 ring-gray-100 overflow-hidden">
                {/* Table Header */}
                <div className="hidden md:flex bg-gray-50/50 border-b border-gray-100 px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex-1">Agent Name</div>
                    <div className="w-32">Status</div>
                    <div className="w-32">Uptime</div>
                    <div className="w-32 text-right">Balance</div>
                    <div className="w-12" aria-hidden="true"></div>
                </div>

                {/* Agent Rows */}
                <AsyncBoundary
                    isLoading={isLoading}
                    isError={!!error}
                    error={error}
                    data={agents}
                    loadingFallback={<SkeletonTable rows={3} cols={4} />}
                    emptyFallback={
                        <EmptyState
                            title={!isConnected ? "Wallet not connected" : "No agents found"}
                            description={!isConnected ? "Connect your wallet to view your agents." : "Register a new service to get started."}
                        />
                    }
                    onRetry={refetch}
                >
                    {(agentList) => (
                        <div className="divide-y divide-gray-50" role="list">
                            {agentList.map((agent: any, i: number) => (
                                <AgentRow key={i} agent={agent} />
                            ))}
                        </div>
                    )}
                </AsyncBoundary>
            </Card>
        </div>
    );
}

// ============================================
// DASHBOARD TRANSACTIONS
// ============================================

export function DashboardTransactions() {
    const { address, isConnected } = useAppKitAccount();
    const { data: trades, isLoading, error, refetch } = useUserTrades(address || null);

    // Show connect wallet prompt if not connected
    if (!isConnected || !address) {
        return (
            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Transactions</h2>
                <Card className="border-0 shadow-sm ring-1 ring-gray-100 p-12">
                    <EmptyState
                        title="Connect your wallet"
                        description="Connect your wallet to view your transaction history."
                    />
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Transactions</h2>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                </Button>
            </div>

            <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                <AsyncBoundary
                    isLoading={isLoading}
                    isError={!!error}
                    error={error}
                    data={trades}
                    loadingFallback={<SkeletonTable rows={8} cols={4} />}
                    emptyFallback={
                        <EmptyState
                            title="No transactions yet"
                            description="Your transactions will appear here once you start trading."
                        />
                    }
                    onRetry={refetch}
                >
                    {(tradeList) => (
                        <div className="divide-y divide-gray-50">
                            {tradeList.map((trade: any) => (
                                <TransactionRow key={trade.id} trade={trade} />
                            ))}
                        </div>
                    )}
                </AsyncBoundary>
            </Card>
        </div>
    );
}

// ============================================
// DASHBOARD REPUTATION
// ============================================

export function DashboardReputation() {
    const { address, isConnected } = useAppKitAccount();
    const { data: services, isLoading, error } = useUserServices(address || null);

    // Compute stats
    const stats = useMemo(() => {
        if (!services || services.length === 0) {
            return {
                score: 0,
                uptime: '0%',
                successRate: '0%',
                volume: '$0',
                age: '0d'
            };
        }

        let totalScore = 0;
        let totalPayments = 0;
        let successfulPayments = 0;
        let totalVolume = 0;
        let earliestDate: Date | null = null;

        services.forEach((s: any) => {
            const rep = Array.isArray(s.reputations) ? s.reputations[0] : (s.reputations || {});
            totalScore += Number(rep.reputation_score || 0);
            totalPayments += Number(rep.total_payments || 0);
            successfulPayments += Number(rep.successful_payments || 0);
            const pricePerCall = Number(s.price_per_call || 0.01);
            totalVolume += Number(rep.total_payments || 0) * pricePerCall;
            if (s.created_at) {
                const createdDate = new Date(s.created_at);
                if (!earliestDate || createdDate < earliestDate) {
                    earliestDate = createdDate;
                }
            }
        });

        const avgScore = totalScore / services.length;
        const ageDays = earliestDate !== null
            ? Math.floor((Date.now() - (earliestDate as Date).getTime()) / (1000 * 60 * 60 * 24))
            : 0;

        return {
            score: Math.round(avgScore * 10),
            uptime: totalPayments > 0 ? ((successfulPayments / totalPayments) * 100).toFixed(1) + '%' : '100%',
            successRate: totalPayments > 0 ? ((successfulPayments / totalPayments) * 100).toFixed(1) + '%' : '100%',
            volume: totalVolume >= 1000 ? '$' + (totalVolume / 1000).toFixed(1) + 'k' : '$' + totalVolume.toFixed(0),
            age: ageDays > 0 ? ageDays + 'd' : '0d'
        };
    }, [services]);

    const maxScore = 1000;

    const trustFactors = [
        { label: 'Uptime', value: stats.uptime, score: parseFloat(stats.uptime), color: 'bg-green-500' },
        { label: 'Success Rate', value: stats.successRate, score: parseFloat(stats.successRate), color: 'bg-green-500' },
        { label: 'Volume', value: stats.volume, score: 75, color: 'bg-blue-500' },
        { label: 'Age', value: stats.age, score: 60, color: 'bg-gray-500' },
    ];

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Reputation Score</h2>

            {/* On-Chain Feedback Section - TOP */}
            <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Submit On-Chain Feedback</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FeedbackForm
                        agentId={1}
                        agentName="PerpAI Quote Agent"
                        endpoint="/api/quote"
                    />
                    <Card className="border-0 shadow-sm ring-1 ring-gray-100 p-6">
                        <h4 className="font-medium text-gray-800 mb-3">How Feedback Works</h4>
                        <ul className="space-y-2 text-sm text-gray-600">
                            <li className="flex items-start gap-2">
                                <span className="text-green-500 mt-0.5">[OK]</span>
                                <span>Score agents 0-100 after using their services</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-green-500 mt-0.5">[OK]</span>
                                <span>Tag feedback by category (trade, oracle, etc.)</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-green-500 mt-0.5">[OK]</span>
                                <span>Feedback is stored permanently on Cronos blockchain</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-green-500 mt-0.5">[OK]</span>
                                <span>Agents build reputation over time based on feedback</span>
                            </li>
                        </ul>
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                            <p className="text-xs text-blue-700">
                                <strong>On-Chain:</strong> ReputationRegistry at{' '}
                                <code className="bg-blue-100 px-1 rounded">0xdaFC...1a67</code>
                            </p>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Off-Chain Trust Factors - BOTTOM */}
            <div className="mt-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Service Performance (Off-Chain)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <AsyncBoundary isLoading={isLoading} isError={!!error} error={error} data={services}>
                        {(data) => (
                            <Card className="md:col-span-2 border-0 shadow-sm ring-1 ring-gray-100 p-8 flex flex-col items-center justify-center text-center">
                                {!isConnected ? (
                                    <div className="text-gray-500">Connect wallet to view reputation</div>
                                ) : (data && data.length === 0) ? (
                                    <div className="text-gray-500">No active services to score</div>
                                ) : (
                                    <>
                                        <div className="text-7xl font-bold bg-gradient-to-r from-green-500 to-emerald-600 bg-clip-text text-transparent">
                                            {stats.score}
                                        </div>
                                        <div className="text-gray-500 mt-2">out of {maxScore}</div>
                                        <div className="w-full max-w-xs mt-4 h-3 bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-green-500 to-emerald-600 rounded-full transition-all duration-500"
                                                style={{ width: `${(stats.score / maxScore) * 100}%` }}
                                            />
                                        </div>
                                        <p className="text-sm text-gray-500 mt-4">
                                            Based on payment success rate and service reliability
                                        </p>
                                    </>
                                )}
                            </Card>
                        )}
                    </AsyncBoundary>

                    <Card className="border-0 shadow-sm ring-1 ring-gray-100 p-6 bg-gradient-to-br from-gray-800 to-gray-900 text-white">
                        <h3 className="font-semibold mb-4">Trust Factors</h3>
                        <div className="space-y-4">
                            {trustFactors.map((factor) => (
                                <div key={factor.label}>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-sm opacity-60">{factor.label}</span>
                                        <span className="text-sm font-mono">{factor.value}</span>
                                    </div>
                                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full ${factor.color} rounded-full transition-all`}
                                            style={{ width: `${factor.score}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs opacity-50 mt-4">
                            Data from Supabase service analytics
                        </p>
                    </Card>
                </div>
            </div>
        </div>
    );
}

// ============================================
// DASHBOARD SETTINGS - Fully Editable
// ============================================

export function DashboardSettings() {
    const { address, isConnected } = useAppKitAccount();
    const { open } = useAppKit();
    const navigate = useNavigate();

    // Form state
    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [saving, setSaving] = useState(false);
    const [loadingProfile, setLoadingProfile] = useState(true);

    // Notification settings
    const [notifyPayments, setNotifyPayments] = useState(true);
    const [notifyServices, setNotifyServices] = useState(true);
    const [notifyReputation, setNotifyReputation] = useState(true);
    const [notifyHealth, setNotifyHealth] = useState(true);
    const [notifyDailySummary, setNotifyDailySummary] = useState(false);

    // API Keys
    const [apiKeys, setApiKeys] = useState<Array<{ id: string; name: string; created: string; lastUsed: string }>>([]);
    const [generatingKey, setGeneratingKey] = useState(false);

    // Bot Linking (summary only - full functionality on /dashboard/settings/bot)
    const [linkedAccounts, setLinkedAccounts] = useState<Array<{
        id: string;
        platform: 'telegram' | 'discord';
        username: string;
        linkedAt: string;
    }>>([]);

    // Edit modal states
    const [editingProfile, setEditingProfile] = useState(false);
    const [editingNotifications, setEditingNotifications] = useState(false);

    // Load user profile on mount
    useEffect(() => {
        if (address) {
            loadProfile();
        } else {
            setLoadingProfile(false);
        }
    }, [address]);

    const loadProfile = async () => {
        if (!address) return;
        setLoadingProfile(true);

        try {
            // Fetch profile from API
            const response = await fetch(`/api/user/profile?wallet=${address}`);
            if (response.ok) {
                const data = await response.json();
                setDisplayName(data.displayName || '');
                setEmail(data.email || '');
                setNotifyPayments(data.notifications?.payments ?? true);
                setNotifyServices(data.notifications?.services ?? true);
                setNotifyReputation(data.notifications?.reputation ?? true);
                setNotifyHealth(data.notifications?.health ?? true);
                setNotifyDailySummary(data.notifications?.dailySummary ?? false);
                setApiKeys(data.apiKeys || []);
                setLinkedAccounts(data.linkedAccounts || []);
            }
        } catch (error) {
            console.error('Failed to load profile:', error);
        } finally {
            setLoadingProfile(false);
        }
    };

    const handleSaveProfile = async () => {
        if (!address) return;
        setSaving(true);

        try {
            const response = await fetch('/api/user/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress: address,
                    displayName,
                    email,
                }),
            });

            if (response.ok) {
                toast.success('Profile updated', 'Your profile has been saved.');
                setEditingProfile(false);
                await loadProfile();
            } else {
                throw new Error('Failed to save');
            }
        } catch (error) {
            toast.error('Save failed', 'Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveNotifications = async () => {
        if (!address) return;
        setSaving(true);

        try {
            const response = await fetch('/api/user/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress: address,
                    payments: notifyPayments,
                    services: notifyServices,
                    reputation: notifyReputation,
                    health: notifyHealth,
                    dailySummary: notifyDailySummary,
                }),
            });

            if (response.ok) {
                toast.success('Notifications updated', 'Your preferences have been saved.');
                setEditingNotifications(false);
            } else {
                throw new Error('Failed to save');
            }
        } catch (error) {
            toast.error('Save failed', 'Please try again.');
        } finally {
            setSaving(false);
        }
    };

    // Note: Bot linking/unlinking functions are now on the dedicated BotIntegration page at /dashboard/settings/bot

    const handleGenerateApiKey = async () => {
        if (!address) return;
        setGeneratingKey(true);

        try {
            const response = await fetch('/api/user/api-keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress: address,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                toast.success(
                    'API Key Generated',
                    `Your new key: ${data.key}\n\nCopy it now - you won't see it again!`
                );
                setApiKeys([{
                    id: data.id,
                    name: data.name,
                    created: data.created_at,
                    lastUsed: 'Never',
                }]);
            } else {
                toast.error('Generation failed', data.error || 'Please try again.');
            }
        } catch (error) {
            toast.error('Failed to generate key', 'Please try again.');
        } finally {
            setGeneratingKey(false);
        }
    };

    const handleRevokeApiKey = async (keyId: string) => {
        try {
            const response = await fetch(`/api/user/api-keys/${keyId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setApiKeys(prev => prev.filter(k => k.id !== keyId));
                toast.success('API Key revoked', 'The key has been permanently disabled.');
            }
        } catch (error) {
            toast.error('Revoke failed', 'Please try again.');
        }
    };

    // Not connected state
    if (!isConnected || !address) {
        return (
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Configuration</h2>
                    <p className="text-gray-500">Manage your account and preferences</p>
                </div>
                <Card className="border-0 shadow-sm ring-1 ring-gray-100 p-12">
                    <EmptyState
                        icon={<Wallet className="h-12 w-12 text-gray-300" />}
                        title="Connect your wallet"
                        description="Connect your wallet to manage your settings and link bots."
                    />
                    <div className="mt-4 flex justify-center">
                        <Button onClick={() => open()} className="bg-gray-900 dark:bg-gray-800">
                            Connect Wallet
                        </Button>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Configuration</h2>
                <p className="text-gray-500">Manage your account and preferences</p>
            </div>

            {/* Profile Settings */}
            <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                <CardContent className="p-6 space-y-6">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <h3 className="text-lg font-bold">Profile Settings</h3>
                            <p className="text-sm text-gray-500">Manage your display name and email.</p>
                        </div>
                        {!editingProfile && (
                            <Button variant="outline" size="sm" onClick={() => setEditingProfile(true)}>
                                Edit
                            </Button>
                        )}
                    </div>

                    {loadingProfile ? (
                        <div className="animate-pulse space-y-4">
                            <div className="h-10 bg-gray-100 rounded" />
                            <div className="h-10 bg-gray-100 rounded" />
                        </div>
                    ) : editingProfile ? (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    placeholder="Enter your name"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#111111] focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email (for notifications)</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#111111] focus:border-transparent"
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={handleSaveProfile} disabled={saving} className="bg-gray-900 dark:bg-gray-800">
                                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Profile
                                </Button>
                                <Button variant="outline" onClick={() => setEditingProfile(false)}>
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            <div className="flex items-center justify-between p-4 rounded-lg bg-white border border-gray-100">
                                <div className="flex items-center gap-3">
                                    <User className="h-5 w-5 text-gray-500" />
                                    <div>
                                        <p className="font-medium text-gray-900">Display Name</p>
                                        <p className="text-sm text-gray-500">{displayName || 'Not set'}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-4 rounded-lg bg-white border border-gray-100">
                                <div className="flex items-center gap-3">
                                    <Bell className="h-5 w-5 text-gray-500" />
                                    <div>
                                        <p className="font-medium text-gray-900">Email</p>
                                        <p className="text-sm text-gray-500">{email || 'Not set'}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-4 rounded-lg bg-white border border-gray-100">
                                <div className="flex items-center gap-3">
                                    <Wallet className="h-5 w-5 text-gray-500" />
                                    <div>
                                        <p className="font-medium text-gray-900">Wallet Address</p>
                                        <p className="text-sm text-gray-500 font-mono">{address}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Telegram/Discord Bot Linking - Links to full page */}
            <Card className="border-0 shadow-sm ring-1 ring-gray-100 hover:ring-blue-200 transition-all cursor-pointer"
                onClick={() => navigate('/dashboard/settings/bot')}>
                <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-lg font-bold">
                                BOT
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Bot Integration</h3>
                                <p className="text-sm text-gray-500">
                                    {linkedAccounts.length > 0
                                        ? `${linkedAccounts.length} linked account${linkedAccounts.length > 1 ? 's' : ''}`
                                        : 'Link Telegram or Discord to receive notifications'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {linkedAccounts.length > 0 && (
                                <Badge className="bg-green-100 text-green-700">Active</Badge>
                            )}
                            <ArrowUpRight className="h-5 w-5 text-gray-400" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Notification Settings */}
            <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                <CardContent className="p-6 space-y-6">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <h3 className="text-lg font-bold">Notification Preferences</h3>
                            <p className="text-sm text-gray-500">Choose what notifications you receive.</p>
                        </div>
                        {!editingNotifications && (
                            <Button variant="outline" size="sm" onClick={() => setEditingNotifications(true)}>
                                Configure
                            </Button>
                        )}
                    </div>

                    {editingNotifications ? (
                        <div className="space-y-4">
                            {[
                                { key: 'payments', label: 'Payment notifications', value: notifyPayments, setter: setNotifyPayments },
                                { key: 'services', label: 'Service call alerts', value: notifyServices, setter: setNotifyServices },
                                { key: 'reputation', label: 'Reputation changes', value: notifyReputation, setter: setNotifyReputation },
                                { key: 'health', label: 'Health alerts', value: notifyHealth, setter: setNotifyHealth },
                                { key: 'dailySummary', label: 'Daily summary', value: notifyDailySummary, setter: setNotifyDailySummary },
                            ].map((item) => (
                                <label key={item.key} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                                    <span className="text-sm text-gray-700">{item.label}</span>
                                    <input
                                        type="checkbox"
                                        checked={item.value}
                                        onChange={(e) => item.setter(e.target.checked)}
                                        className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                </label>
                            ))}
                            <div className="flex gap-2 pt-2">
                                <Button onClick={handleSaveNotifications} disabled={saving} className="bg-gray-900 dark:bg-gray-800">
                                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Preferences
                                </Button>
                                <Button variant="outline" onClick={() => setEditingNotifications(false)}>
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between p-4 rounded-lg bg-white border border-gray-100">
                            <div className="flex items-center gap-3">
                                <Bell className="h-5 w-5 text-gray-500" />
                                <div>
                                    <p className="font-medium text-gray-900">Notifications</p>
                                    <p className="text-sm text-gray-500">
                                        {[notifyPayments && 'Payments', notifyServices && 'Services', notifyReputation && 'Reputation', notifyHealth && 'Health']
                                            .filter(Boolean).join(', ') || 'None enabled'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* API Keys */}
            <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                <CardContent className="p-6 space-y-6">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <Lock className="h-5 w-5" />
                                API Keys
                            </h3>
                            <p className="text-sm text-gray-500">
                                Manage your API keys for programmatic access. Keys are <strong>read-only</strong>.
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleGenerateApiKey}
                            disabled={generatingKey}
                        >
                            {generatingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate Key'}
                        </Button>
                    </div>

                    {apiKeys.length > 0 ? (
                        <div className="space-y-3">
                            {apiKeys.map((key) => (
                                <div
                                    key={key.id}
                                    className="flex items-center justify-between p-4 rounded-lg bg-white border border-gray-100"
                                >
                                    <div>
                                        <p className="font-medium text-gray-900">{key.name}</p>
                                        <p className="text-xs text-gray-500">
                                            Created {new Date(key.created).toLocaleDateString()} • Last used: {key.lastUsed}
                                        </p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleRevokeApiKey(key.id)}
                                        className="text-red-600 border-red-200 hover:bg-red-50"
                                    >
                                        Revoke
                                    </Button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-400">
                            <Lock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No API keys yet. Generate one to get started.</p>
                        </div>
                    )}

                    <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-100">
                        <p className="text-xs text-yellow-800">
                            <strong>Security Note:</strong> API keys have read-only access and cannot execute payments.
                            Keep your keys secure and never share them publicly.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// ============================================
// HELPER COMPONENTS
// ============================================

/**
 * Expandable Price Card - Shows best price with source, expands on hover to show all sources
 */
function ExpandablePriceCard({
    pair,
    aggregatedPrice,
}: {
    pair: string;
    aggregatedPrice: AggregatedPrice;
}) {
    const [isExpanded, setIsExpanded] = useState(false);

    // Get source icon/color based on name
    const getSourceStyle = (sourceName: string) => {
        const styles: Record<string, { bg: string; text: string; icon: string }> = {
            'Pyth Oracle': { bg: 'bg-purple-100', text: 'text-purple-700', icon: 'P' },
            'Moonlander': { bg: 'bg-blue-100', text: 'text-blue-700', icon: 'M' },
            'VVS Finance': { bg: 'bg-pink-100', text: 'text-pink-700', icon: 'V' },
            'MM Finance': { bg: 'bg-orange-100', text: 'text-orange-700', icon: 'MM' },
            'GMX': { bg: 'bg-cyan-100', text: 'text-cyan-700', icon: 'G' },
        };
        return styles[sourceName] || { bg: 'bg-gray-100', text: 'text-gray-700', icon: '?' };
    };

    // Calculate a simulated 24h change based on price movement
    const priceChange = useMemo(() => {
        // Simulate small price changes based on current price variance
        const variance = (aggregatedPrice.bestPrice % 100) / 10000;
        return ((variance - 0.005) * 100).toFixed(2);
    }, [aggregatedPrice.bestPrice]);

    const bestSourceStyle = getSourceStyle(aggregatedPrice.bestSource);

    return (
        <div
            className="relative"
            onMouseEnter={() => setIsExpanded(true)}
            onMouseLeave={() => setIsExpanded(false)}
        >
            <Card className={`border-0 shadow-sm transition-all duration-300 cursor-pointer ${isExpanded ? 'bg-white ring-2 ring-[#111111]/10 shadow-lg' : 'bg-gray-50/50 hover:bg-gray-50'
                }`}>
                <CardContent className="p-4">
                    {/* Main Price Display */}
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-2">
                                <p className="text-xs text-gray-500 font-medium">{pair}</p>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${bestSourceStyle.bg} ${bestSourceStyle.text}`}>
                                    {bestSourceStyle.icon} {aggregatedPrice.bestSource}
                                </span>
                            </div>
                            <p className="text-lg font-bold font-mono mt-1">
                                ${aggregatedPrice.bestPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                        </div>
                        <div className="text-right">
                            <Badge
                                className={`${Number(priceChange) >= 0
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-red-100 text-red-700'
                                    }`}
                            >
                                {Number(priceChange) >= 0 ? '+' : ''}{priceChange}%
                            </Badge>
                            <p className="text-[10px] text-gray-400 mt-1">
                                {aggregatedPrice.totalLatencyMs}ms
                            </p>
                        </div>
                    </div>

                    {/* Expandable Sources Section */}
                    <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-64 opacity-100 mt-4' : 'max-h-0 opacity-0'
                        }`}>
                        <div className="border-t border-gray-100 pt-3">
                            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">
                                All Sources ({aggregatedPrice.sources.length})
                            </p>
                            <div className="space-y-2">
                                {aggregatedPrice.sources.map((source) => {
                                    const style = getSourceStyle(source.name);
                                    const isBest = source.name === aggregatedPrice.bestSource;
                                    const diff = ((source.price - aggregatedPrice.bestPrice) / aggregatedPrice.bestPrice * 100);

                                    return (
                                        <div
                                            key={source.name}
                                            className={`flex items-center justify-between p-2 rounded-lg transition-all ${isBest ? 'bg-green-50 ring-1 ring-green-200' : 'bg-gray-50'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className={`w-6 h-6 rounded-full ${style.bg} ${style.text} flex items-center justify-center text-xs`}>
                                                    {style.icon}
                                                </span>
                                                <span className="text-sm font-medium">{source.name}</span>
                                                {isBest && (
                                                    <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                                                        👑 Best
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-mono font-medium">
                                                    ${source.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                                {!isBest && (
                                                    <span className={`text-[10px] ${diff > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                                        {diff > 0 ? '+' : ''}{diff.toFixed(3)}%
                                                    </span>
                                                )}
                                                <span className="text-[10px] text-gray-400 w-12 text-right">
                                                    {source.latencyMs}ms
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function StatCard({
    label,
    value,
    change,
    changeType,
    icon,
    bgColor,
}: {
    label: string;
    value: string;
    change: string;
    changeType: 'positive' | 'negative' | 'neutral';
    icon: React.ReactNode;
    bgColor: string;
}) {
    return (
        <Card className="border-0 shadow-sm bg-gray-50/50 hover:bg-gray-50 transition-colors">
            <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                    <div className={`p-2 rounded-lg ${bgColor}`}>{icon}</div>
                    <Badge
                        variant="secondary"
                        className={`font-normal ${changeType === 'positive'
                            ? 'bg-green-100 text-green-700'
                            : changeType === 'negative'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                    >
                        {change}
                    </Badge>
                </div>
                <h3 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">{value}</h3>
                <p className="text-sm text-gray-500 font-medium">{label}</p>
            </CardContent>
        </Card>
    );
}

function ChartPeriodSelector() {
    const [period, setPeriod] = useState('1W');
    const periods = ['1H', '1D', '1W', '1M', '1Y'];

    return (
        <div className="flex gap-1" role="group" aria-label="Chart period">
            {periods.map((p) => (
                <button
                    key={p}
                    className={`text-xs font-medium px-2 py-1 rounded transition-colors ${p === period ? 'bg-gray-900 dark:bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-100'
                        }`}
                    onClick={() => setPeriod(p)}
                    aria-pressed={p === period}
                >
                    {p}
                </button>
            ))}
        </div>
    );
}

function VolumeChart({ data, isLoading }: { data: any[] | null; isLoading: boolean }) {
    if (isLoading) {
        return (
            <div className="h-[300px] flex items-end gap-2 pt-8">
                {Array.from({ length: 24 }).map((_, i) => (
                    <div key={i} className="flex-1 rounded-t-sm bg-gray-200 animate-pulse" style={{ height: `${30 + Math.random() * 50}%` }} />
                ))}
            </div>
        );
    }

    // Generate chart data from stats or show empty
    const chartData = data?.slice(0, 24).reverse().map((d) => d.total_volume_usd || 0) || [];

    if (chartData.length === 0 || chartData.every(v => v === 0)) {
        return (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
                <div className="text-center">
                    <p className="text-sm font-medium">No transaction data yet</p>
                    <p className="text-xs mt-1">Volume will appear here once you start trading</p>
                </div>
            </div>
        );
    }

    const max = Math.max(...chartData, 1); // Ensure max is at least 1

    return (
        <div className="h-[300px] w-full flex items-end gap-2 pt-8">
            {chartData.map((value, i) => {
                const height = (value / max) * 100;
                return (
                    <div
                        key={i}
                        className="flex-1 bg-gray-100 rounded-t-sm hover:bg-[#FFD84D] transition-colors relative group cursor-pointer"
                        style={{ height: `${Math.max(height, 2)}%` }}
                        role="img"
                        aria-label={`Volume: $${Math.round(value)}`}
                    >
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-gray-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                            ${Math.round(value).toLocaleString()}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function TradeRow({ trade }: { trade: any }) {
    const isProfit = trade.pnl_usd > 0;

    return (
        <div className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-4">
                <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center ${trade.side === 'long' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                    }`}>
                    {trade.side === 'long' ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                </div>
                <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        {trade.side.toUpperCase()} {trade.pair}
                    </p>
                    <p className="text-xs text-gray-500">
                        {trade.leverage}x • {new Date(trade.created_at).toLocaleDateString()}
                    </p>
                </div>
            </div>
            <div className="text-right">
                <p className={`font-mono font-bold ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                    {isProfit ? '+' : ''}{trade.pnl_usd ? `$${trade.pnl_usd}` : `$${trade.size_usd}`}
                </p>
                <Badge variant="secondary" className="text-xs">
                    {trade.status}
                </Badge>
            </div>
        </div>
    );
}

function TransactionRow({ trade }: { trade: any }) {
    const isPayment = trade.type === 'payment';
    const isSuccess = trade.status === 'closed' || trade.status === 'open' || trade.status === 'settled' || trade.status === 'success';

    return (
        <div className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-4">
                <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center ${isSuccess ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'
                    }`}>
                    {isSuccess ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                </div>
                <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        {isPayment ? (
                            <span className="flex items-center gap-2">
                                <DollarSign className="h-4 w-4" />
                                {trade.purpose || 'Payment'}
                            </span>
                        ) : (
                            `${trade.side.toUpperCase()} ${trade.pair}`
                        )}
                    </p>
                    <p className="text-xs text-gray-500">
                        {trade.tx_hash?.slice(0, 10) || trade.tx_hash_open?.slice(0, 10)}... • {new Date(trade.created_at).toLocaleString()}
                    </p>
                </div>
            </div>
            <div className="text-right">
                <p className="font-mono font-bold text-gray-900 dark:text-gray-100">
                    {isPayment ? `${trade.amount} USDC` : `$${trade.size_usd}`}
                </p>
                <p className="text-xs text-gray-400">
                    {isPayment ? trade.to_address?.slice(0, 10) + '...' : (trade.dex_venues?.name || 'Unknown venue')}
                </p>
            </div>
        </div>
    );
}

function ServiceCard({ service }: { service: any }) {
    const reputation = service.reputations?.reputation_score || 0;

    return (
        <Card className="border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
            <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <Badge variant="secondary" className="bg-blue-50 text-blue-700 capitalize">
                        {service.category}
                    </Badge>
                    <div className="flex items-center gap-1 text-green-600 font-bold text-sm">
                        <Shield className="h-4 w-4" />
                        <span>{reputation.toFixed(1)}%</span>
                    </div>
                </div>
                <div className="flex items-center gap-4 mb-4">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-xl font-bold text-gray-500">
                        {service.name.charAt(0)}
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 transition-colors">
                            {service.name}
                        </h3>
                        <p className="text-sm text-gray-500 line-clamp-1">
                            {service.description || 'No description'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                    <div className="flex flex-col">
                        <span className="text-xs text-gray-400 uppercase font-medium">Latency</span>
                        <span className="text-sm font-mono text-gray-900 dark:text-gray-100">
                            {service.reputations?.avg_latency_ms || 'N/A'}ms
                        </span>
                    </div>
                    <div className="flex flex-col text-right">
                        <span className="text-xs text-gray-400 uppercase font-medium">Cost</span>
                        <span className="text-sm font-mono text-gray-900 dark:text-gray-100">
                            {service.price_per_call} {service.currency}
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function AgentRow({ agent }: { agent: any }) {
    return (
        <div className="px-6 py-4 flex flex-col md:flex-row md:items-center gap-4 hover:bg-gray-50/50 transition-colors" role="listitem">
            <div className="flex-1 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                    <User className="h-5 w-5 text-gray-500" />
                </div>
                <div>
                    <p className="font-bold text-gray-900 dark:text-gray-100">{agent.name}</p>
                    <p className="text-xs text-gray-400 font-mono">{agent.id}</p>
                </div>
            </div>
            <div className="flex justify-between md:contents">
                <div className="md:w-32">
                    <Badge
                        variant={agent.status === 'active' ? 'default' : 'secondary'}
                        className={agent.status === 'active' ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100'}
                    >
                        {agent.status === 'active' ? 'Running' : 'Paused'}
                    </Badge>
                </div>
                <div className="md:w-32 text-sm text-gray-600 flex items-center md:block gap-2">
                    <span className="md:hidden text-gray-400">Uptime:</span> {agent.uptime}
                </div>
            </div>
            <div className="flex justify-between md:justify-end md:w-32 items-center">
                <div className="md:text-right font-mono font-medium">{agent.balance}</div>
                <div className="md:w-12 flex justify-end">
                    <Button variant="ghost" size="icon" aria-label="More options">
                        <MoreHorizontal className="h-4 w-4 text-gray-400" />
                    </Button>
                </div>
            </div>
        </div>
    );
}


function TradeResult({ result, error }: { result: any; error: any }) {
    if (error) {
        return (
            <div className="p-4 rounded-lg border bg-red-50 border-red-200 text-red-800" role="alert">
                <p className="font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Trade Failed
                </p>
                <p className="text-sm mt-1">{error.message}</p>
            </div>
        );
    }

    if (!result) return null;

    return (
        <div className="p-4 rounded-lg border bg-green-50 border-green-200 text-green-800" role="alert">
            <div className="space-y-1 text-sm">
                <p className="font-bold flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Trade Executed Successfully
                </p>
                <p>Venue: <span className="font-mono">{result.venue}</span></p>
                <p>Entry Price: <span className="font-mono">${result.metrics?.currentPrice || result.data?.trade?.entry_price || 'N/A'}</span></p>
                {result.data?.trade?.tx_hash_open && (
                    <p>Tx: <span className="font-mono text-xs">{result.data.trade.tx_hash_open.slice(0, 16)}...</span></p>
                )}
            </div>
        </div>
    );
}
