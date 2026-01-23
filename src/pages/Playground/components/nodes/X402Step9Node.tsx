import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Package, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface Step9NodeData {
    label: string;
    status: 'idle' | 'executing' | 'complete' | 'error';
    output?: Record<string, any>;
}

export const X402Step9Node = memo(({ data }: { data: Step9NodeData }) => {
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
            default: return <Package className="h-4 w-4 text-green-600" />;
        }
    };

    return (
        <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`px-4 py-3 rounded-lg border-2 min-w-[200px] shadow-lg ${getStatusColor()}`}
        >
            <Handle type="target" position={Position.Left} className="!bg-green-500 !w-3 !h-3" />
            
            <div className="flex items-center gap-2 mb-2">
                {getStatusIcon()}
                <div>
                    <div className="font-semibold text-sm">Step 9: Deliver</div>
                    <div className="text-xs text-gray-500">{data.label}</div>
                </div>
            </div>

            {data.output && (
                <div className="text-xs text-gray-600">
                    <pre className="font-mono text-xs overflow-hidden">
                        {JSON.stringify(data.output, null, 2).slice(0, 100)}...
                    </pre>
                </div>
            )}

            <Handle type="source" position={Position.Right} className="!bg-green-500 !w-3 !h-3" />
        </motion.div>
    );
});

X402Step9Node.displayName = 'X402Step9Node';
