import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Database, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface PaymentIndexerNodeData {
    label: string;
    status: 'idle' | 'executing' | 'complete' | 'error';
    config?: {
        fromBlock?: number;
        toBlock?: number;
    };
    output?: {
        payments: Array<{ txHash: string; amount: number; timestamp: string }>;
        totalVolume: number;
        lastBlock: number;
    };
}

export const ServicePaymentIndexerNode = memo(({ data }: { data: PaymentIndexerNodeData }) => {
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
            default: return <Database className="h-4 w-4 text-cyan-600" />;
        }
    };

    return (
        <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`px-4 py-3 rounded-lg border-2 min-w-[220px] shadow-lg ${getStatusColor()}`}
        >
            <Handle type="target" position={Position.Left} className="!bg-cyan-500 !w-3 !h-3" />

            <div className="flex items-center gap-2 mb-2">
                {getStatusIcon()}
                <div>
                    <div className="font-semibold text-sm">Payment Indexer</div>
                    <div className="text-xs text-gray-500">{data.label}</div>
                </div>
            </div>

            {data.output && (
                <div className="text-xs space-y-1">
                    <div className="text-gray-600">
                        {data.output.payments.length} payments
                    </div>
                    <div className="text-gray-600">
                        Volume: ${data.output.totalVolume.toFixed(2)}
                    </div>
                    <div className="text-gray-500">
                        Block: #{data.output.lastBlock}
                    </div>
                </div>
            )}

            <Handle type="source" position={Position.Right} className="!bg-cyan-500 !w-3 !h-3" />
        </motion.div>
    );
});

ServicePaymentIndexerNode.displayName = 'ServicePaymentIndexerNode';
