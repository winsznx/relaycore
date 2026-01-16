/**
 * Quote Display Component
 * 
 * Shows trading quote results after x402 payment
 */

import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Clock, TrendingUp, DollarSign, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';

interface QuoteData {
    venue: string;
    entryPrice: number;
    estimatedFees: number;
    fundingRate: number;
    slippage: number;
    quoteTimestamp: number;
}

interface QuoteDisplayProps {
    quote: QuoteData;
    pair: string;
    side: 'long' | 'short';
    onExpire?: () => void;
}

export function QuoteDisplay({ quote, pair, side, onExpire }: QuoteDisplayProps) {
    const [timeRemaining, setTimeRemaining] = useState(60);

    useEffect(() => {
        const expiryTime = quote.quoteTimestamp + 60000; // 60 seconds

        const interval = setInterval(() => {
            const remaining = Math.max(0, Math.floor((expiryTime - Date.now()) / 1000));
            setTimeRemaining(remaining);

            if (remaining === 0) {
                clearInterval(interval);
                onExpire?.();
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [quote.quoteTimestamp, onExpire]);

    const isExpired = timeRemaining === 0;

    return (
        <Card className="border-2 border-green-500 bg-green-50/50">
            <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-green-600" />
                        <span className="font-semibold text-green-900">Quote Ready</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Clock className={`h-4 w-4 ${isExpired ? 'text-red-600' : 'text-gray-500'}`} />
                        <span className={`text-sm font-mono ${isExpired ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
                            {isExpired ? 'EXPIRED' : `${timeRemaining}s`}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-white rounded-lg p-3">
                        <div className="text-gray-500 text-xs mb-1">Best Venue</div>
                        <div className="font-bold text-gray-900">{quote.venue}</div>
                    </div>

                    <div className="bg-white rounded-lg p-3">
                        <div className="text-gray-500 text-xs mb-1">Entry Price</div>
                        <div className="font-mono font-bold text-gray-900">
                            ${quote.entryPrice.toLocaleString()}
                        </div>
                    </div>

                    <div className="bg-white rounded-lg p-3">
                        <div className="text-gray-500 text-xs mb-1">Est. Fees</div>
                        <div className="font-mono text-gray-900">
                            ${quote.estimatedFees.toFixed(2)}
                        </div>
                    </div>

                    <div className="bg-white rounded-lg p-3">
                        <div className="text-gray-500 text-xs mb-1">Funding Rate</div>
                        <div className={`font-mono ${quote.fundingRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {(quote.fundingRate * 100).toFixed(4)}%
                        </div>
                    </div>
                </div>

                {isExpired && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-center text-sm text-red-700">
                        Quote expired. Please get a new quote.
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
