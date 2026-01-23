import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { DollarSign, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface Step2NodeData {
    label: string;
    status: 'idle' | 'executing' | 'complete' | 'error';
    output?: {
        paymentId: string;
        paymentRequirements: {
            payTo: string;
            maxAmountRequired: string;
            asset: string;
            network: string;
        };
    };
}

export const X402Step2Node = memo(({ data }: { data: Step2NodeData }) => {
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
            default: return <DollarSign className="h-4 w-4 text-gray-600" />;
        }
    };

    return (
        <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`px-4 py-3 rounded-lg border-2 min-w-[200px] shadow-lg ${getStatusColor()}`}
        >
            <Handle type="target" position={Position.Left} className="!bg-purple-500 !w-3 !h-3" />

            <div className="flex items-center gap-2 mb-2">
                {getStatusIcon()}
                <div>
                    <div className="font-semibold text-sm">Step 2: Challenge</div>
                    <div className="text-xs text-gray-500">{data.label}</div>
                </div>
            </div>

            {data.output && (
                <div className="text-xs space-y-1">
                    <div className="font-mono text-xs text-gray-600 truncate">
                        {data.output.paymentId}
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-gray-500">Amount:</span>
                        <span className="font-semibold">
                            {(parseInt(data.output.paymentRequirements.maxAmountRequired) / 1e6).toFixed(2)} USDC
                        </span>
                    </div>
                    <div className="text-gray-600 truncate">
                        To: {data.output.paymentRequirements.payTo.slice(0, 10)}...
                    </div>
                </div>
            )}

            <Handle type="source" position={Position.Right} className="!bg-purple-500 !w-3 !h-3" />
        </motion.div>
    );
});

X402Step2Node.displayName = 'X402Step2Node';
