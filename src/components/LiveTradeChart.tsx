/**
 * LiveTradeChart - Interactive Line Chart for Trading Dashboard
 * 
 * Replaces NetworkGraph with a clean, interactive line chart
 * showing real-time price and volume data.
 */

import { useState, useEffect, useMemo } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Area,
    AreaChart,
    Legend
} from 'recharts';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface TradeDataPoint {
    time: string;
    timestamp: number;
    btcPrice: number;
    ethPrice: number;
    croPrice: number;
    volume: number;
}

interface LiveTradeChartProps {
    className?: string;
}

// Generate mock real-time data
function generateLiveData(): TradeDataPoint[] {
    const now = Date.now();
    const data: TradeDataPoint[] = [];

    // Base prices
    let btcPrice = 96500 + Math.random() * 1000;
    let ethPrice = 3450 + Math.random() * 50;
    let croPrice = 0.085 + Math.random() * 0.005;

    for (let i = 30; i >= 0; i--) {
        const timestamp = now - i * 60000; // Every minute
        const date = new Date(timestamp);

        // Add some volatility
        btcPrice += (Math.random() - 0.5) * 200;
        ethPrice += (Math.random() - 0.5) * 20;
        croPrice += (Math.random() - 0.5) * 0.002;

        data.push({
            time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            timestamp,
            btcPrice: Math.max(btcPrice, 90000),
            ethPrice: Math.max(ethPrice, 3000),
            croPrice: Math.max(croPrice, 0.05),
            volume: Math.floor(Math.random() * 1000000) + 500000
        });
    }

    return data;
}

export default function LiveTradeChart({ className = '' }: LiveTradeChartProps) {
    const [data, setData] = useState<TradeDataPoint[]>([]);
    const [selectedPair, setSelectedPair] = useState<'btc' | 'eth' | 'cro'>('btc');
    const [isLive, setIsLive] = useState(true);

    // Initialize and update data
    useEffect(() => {
        setData(generateLiveData());

        if (isLive) {
            const interval = setInterval(() => {
                setData(prev => {
                    const newData = [...prev.slice(1)];
                    const lastPoint = prev[prev.length - 1];
                    const now = new Date();

                    newData.push({
                        time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                        timestamp: now.getTime(),
                        btcPrice: lastPoint.btcPrice + (Math.random() - 0.5) * 200,
                        ethPrice: lastPoint.ethPrice + (Math.random() - 0.5) * 20,
                        croPrice: lastPoint.croPrice + (Math.random() - 0.5) * 0.002,
                        volume: Math.floor(Math.random() * 1000000) + 500000
                    });

                    return newData;
                });
            }, 5000); // Update every 5 seconds

            return () => clearInterval(interval);
        }
    }, [isLive]);

    // Calculate stats
    const stats = useMemo(() => {
        if (data.length < 2) return { price: 0, change: 0, changePercent: 0, volume: 0 };

        const priceKey = selectedPair === 'btc' ? 'btcPrice' : selectedPair === 'eth' ? 'ethPrice' : 'croPrice';
        const current = data[data.length - 1][priceKey];
        const previous = data[0][priceKey];
        const change = current - previous;
        const changePercent = (change / previous) * 100;
        const totalVolume = data.reduce((sum, d) => sum + d.volume, 0);

        return { price: current, change, changePercent, volume: totalVolume };
    }, [data, selectedPair]);

    const priceKey = selectedPair === 'btc' ? 'btcPrice' : selectedPair === 'eth' ? 'ethPrice' : 'croPrice';
    const priceDomain = selectedPair === 'cro' ? [0.05, 0.12] : undefined;

    const formatPrice = (value: number) => {
        if (selectedPair === 'cro') return `$${value.toFixed(4)}`;
        return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const formatVolume = (value: number) => {
        if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
        return `$${value}`;
    };

    return (
        <div className={`${className}`}>
            {/* Header with Stats */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                {/* Pair Selector */}
                <div className="flex gap-2">
                    {[
                        { key: 'btc', label: 'BTC/USD', color: '#F7931A' },
                        { key: 'eth', label: 'ETH/USD', color: '#627EEA' },
                        { key: 'cro', label: 'CRO/USD', color: '#002D74' }
                    ].map(pair => (
                        <button
                            key={pair.key}
                            onClick={() => setSelectedPair(pair.key as any)}
                            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${selectedPair === pair.key
                                    ? 'bg-gray-900 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            {pair.label}
                        </button>
                    ))}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900">
                            {formatPrice(stats.price)}
                        </div>
                        <div className={`flex items-center gap-1 text-sm ${stats.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {stats.change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                            <span>{stats.change >= 0 ? '+' : ''}{stats.changePercent.toFixed(2)}%</span>
                        </div>
                    </div>

                    <div className="text-right hidden sm:block">
                        <div className="text-sm text-gray-500">24h Volume</div>
                        <div className="text-lg font-semibold text-gray-900">
                            {formatVolume(stats.volume)}
                        </div>
                    </div>

                    {/* Live Indicator */}
                    <button
                        onClick={() => setIsLive(!isLive)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isLive
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                    >
                        <Activity className={`w-4 h-4 ${isLive ? 'animate-pulse' : ''}`} />
                        {isLive ? 'Live' : 'Paused'}
                    </button>
                </div>
            </div>

            {/* Chart */}
            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis
                            dataKey="time"
                            stroke="#9CA3AF"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            stroke="#9CA3AF"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            domain={priceDomain}
                            tickFormatter={formatPrice}
                            width={80}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'white',
                                border: '1px solid #E5E7EB',
                                borderRadius: '8px',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }}
                            labelStyle={{ color: '#374151', fontWeight: 600 }}
                            formatter={(value: number) => [formatPrice(value), selectedPair.toUpperCase()]}
                        />
                        <Area
                            type="monotone"
                            dataKey={priceKey}
                            stroke="#3B82F6"
                            strokeWidth={2}
                            fill="url(#colorGradient)"
                            dot={false}
                            activeDot={{ r: 6, fill: '#3B82F6', stroke: 'white', strokeWidth: 2 }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* Bottom Stats */}
            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-100">
                <div className="text-center">
                    <div className="text-xs text-gray-500 uppercase">High (30m)</div>
                    <div className="text-sm font-semibold text-green-600">
                        {formatPrice(Math.max(...data.map(d => d[priceKey])))}
                    </div>
                </div>
                <div className="text-center">
                    <div className="text-xs text-gray-500 uppercase">Low (30m)</div>
                    <div className="text-sm font-semibold text-red-600">
                        {formatPrice(Math.min(...data.map(d => d[priceKey])))}
                    </div>
                </div>
                <div className="text-center">
                    <div className="text-xs text-gray-500 uppercase">Trades</div>
                    <div className="text-sm font-semibold text-gray-900">
                        {Math.floor(Math.random() * 50) + 10}
                    </div>
                </div>
            </div>
        </div>
    );
}
