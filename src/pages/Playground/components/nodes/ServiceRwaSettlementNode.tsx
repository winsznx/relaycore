import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { FileCheck, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface RwaSettlementNodeData {
    label: string;
    status: 'idle' | 'executing' | 'complete' | 'error';
    config?: {
        serviceType?: string;
        slaMaxLatency?: number;
    };
    output?: {
        requestId: string;
        verificationResult?: {
            valid: boolean;
            slaMetrics: {
                latencyMs: number;
                fieldsPresent: string[];
            };
        };
        settlementResult?: {
            success: boolean;
            txHash?: string;
        };
    };
}

export const ServiceRwaSettlementNode = memo(({ data }: { data: RwaSettlementNodeData }) => {
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
            default: return <FileCheck className="h-4 w-4 text-indigo-600" />;
        }
    };

    return (
        <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`px-4 py-3 rounded-lg border-2 min-w-[220px] shadow-lg ${getStatusColor()}`}
        >
            <Handle type="target" position={Position.Left} className="!bg-indigo-500 !w-3 !h-3" />

            <div className="flex items-center gap-2 mb-2">
                {getStatusIcon()}
                <div>
                    <div className="font-semibold text-sm">RWA Settlement</div>
                    <div className="text-xs text-gray-500">{data.label}</div>
                </div>
            </div>

            {data.config && (
                <div className="text-xs space-y-1 mb-2">
                    {data.config.serviceType && (
                        <div className="text-gray-600">
                            Type: {data.config.serviceType}
                        </div>
                    )}
                    {data.config.slaMaxLatency && (
                        <div className="text-gray-600">
                            SLA: {data.config.slaMaxLatency}ms
                        </div>
                    )}
                </div>
            )}

            {data.output && (
                <div className="text-xs space-y-1">
                    <div className="font-mono text-xs text-gray-600 truncate">
                        {data.output.requestId.slice(0, 16)}...
                    </div>
                    {data.output.verificationResult && (
                        <div className={data.output.verificationResult.valid ? 'text-green-700' : 'text-red-700'}>
                            {data.output.verificationResult.valid ? '✓ SLA Met' : '✗ SLA Failed'}
                        </div>
                    )}
                    {data.output.settlementResult?.txHash && (
                        <div className="text-gray-600 truncate">
                            Tx: {data.output.settlementResult.txHash.slice(0, 10)}...
                        </div>
                    )}
                </div>
            )}

            <Handle type="source" position={Position.Right} className="!bg-indigo-500 !w-3 !h-3" />
        </motion.div>
    );
});

ServiceRwaSettlementNode.displayName = 'ServiceRwaSettlementNode';
