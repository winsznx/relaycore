import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Route, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface TradeRouterNodeData {
    label: string;
    status: 'idle' | 'executing' | 'complete' | 'error';
    config?: {
        tokenIn?: string;
        tokenOut?: string;
        amountIn?: string;
    };
    output?: {
        bestRoute: Array<{ venue: string; percentage: number }>;
        expectedOut: string;
        priceImpact: number;
    };
}

export const ServiceTradeRouterNode = memo(({ data }: { data: TradeRouterNodeData }) => {
    const getStatusColor = () => {
        switch (data.status) {
            case 'executing': return 'border-blue-500 bg-blue-50';
            case 'complete': return 'border-green-500 bg-green-50';
            case 'error': return 'border-red-500 bg-red-50';
            default: return 'border-gray-300 bg-white';
        }
    };

    const getStatusIcon = () => {
        switch (data.status) {
            case 'executing': return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
            case 'complete': return <CheckCircle2 className="h-4 w-4 text-green-600" />;
            case 'error': return <XCircle className="h-4 w-4 text-red-600" />;
            default: return <Route className="h-4 w-4 text-teal-600" />;
        }
    };

    return (
        <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`px-4 py-3 rounded-lg border-2 min-w-[220px] shadow-lg ${getStatusColor()}`}
        >
            <Handle type="target" position={Position.Left} className="!bg-teal-500 !w-3 !h-3" />

            <div className="flex items-center gap-2 mb-2">
                {getStatusIcon()}
                <div>
                    <div className="font-semibold text-sm">Trade Router</div>
                    <div className="text-xs text-gray-500">{data.label}</div>
                </div>
            </div>

            {data.config && (
                <div className="text-xs space-y-1 mb-2">
                    <div className="text-gray-600">
                        {data.config.tokenIn} → {data.config.tokenOut}
                    </div>
                </div>
            )}

            {data.output && (
                <div className="text-xs space-y-1">
                    <div className="text-gray-600">
                        Expected: {data.output.expectedOut}
                    </div>
                    <div className="text-gray-600">
                        Impact: {data.output.priceImpact.toFixed(2)}%
                    </div>
                    <div className="text-gray-500">
                        {data.output.bestRoute.length} venues
                    </div>
                </div>
            )}

            <Handle type="source" position={Position.Right} className="!bg-teal-500 !w-3 !h-3" />
        </motion.div>
    );
});

ServiceTradeRouterNode.displayName = 'ServiceTradeRouterNode';
