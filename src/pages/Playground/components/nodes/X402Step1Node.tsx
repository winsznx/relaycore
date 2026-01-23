import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Globe, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface Step1NodeData {
    label: string;
    status: 'idle' | 'executing' | 'complete' | 'error';
    config: {
        url: string;
        method: string;
    };
    output?: {
        resourceUrl: string;
        requestHeaders: Record<string, string>;
        requestTime: number;
        status?: number;
    };
}

export const X402Step1Node = memo(({ data }: { data: Step1NodeData }) => {
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
            default: return <Globe className="h-4 w-4 text-gray-600" />;
        }
    };

    return (
        <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`px-4 py-3 rounded-lg border-2 min-w-[200px] shadow-lg ${getStatusColor()}`}
        >
            <Handle type="target" position={Position.Left} className="!bg-blue-500 !w-3 !h-3" />

            <div className="flex items-center gap-2 mb-2">
                {getStatusIcon()}
                <div>
                    <div className="font-semibold text-sm">Step 1: Request</div>
                    <div className="text-xs text-gray-500">{data.label}</div>
                </div>
            </div>

            <div className="text-xs space-y-1">
                <div className="font-mono text-gray-700 truncate">
                    {data.config.method} {data.config.url}
                </div>
                {data.output && (
                    <>
                        {data.output.status && (
                            <div className="flex items-center gap-1">
                                <span className="text-gray-500">Status:</span>
                                <span className="font-semibold">{data.output.status}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-gray-400" />
                            <span className="text-gray-600">
                                {new Date(data.output.requestTime).toLocaleTimeString()}
                            </span>
                        </div>
                    </>
                )}
            </div>

            <Handle type="source" position={Position.Right} className="!bg-blue-500 !w-3 !h-3" />
        </motion.div>
    );
});

X402Step1Node.displayName = 'X402Step1Node';
