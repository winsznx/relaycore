import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { GitBranch, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface ConditionalNodeData {
    label: string;
    status: 'idle' | 'executing' | 'complete' | 'error';
    config?: { condition?: string };
    output?: { conditionResult: boolean; selectedPath: 'true' | 'false' };
}

export const UtilConditionalNode = memo(({ data }: { data: ConditionalNodeData }) => {
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
            default: return <GitBranch className="h-4 w-4 text-purple-600" />;
        }
    };

    return (
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className={`px-4 py-3 rounded-lg border-2 min-w-[200px] shadow-lg ${getStatusColor()}`}>
            <Handle type="target" position={Position.Left} className="!bg-purple-500 !w-3 !h-3" />
            <div className="flex items-center gap-2 mb-2">
                {getStatusIcon()}
                <div>
                    <div className="font-semibold text-sm">Conditional</div>
                    <div className="text-xs text-gray-500">{data.label}</div>
                </div>
            </div>
            {data.config && (
                <div className="text-xs text-gray-600 truncate">
                    {data.config.condition || 'No condition'}
                </div>
            )}
            {data.output && (
                <div className="text-xs mt-1">
                    <span className={data.output.conditionResult ? 'text-green-700' : 'text-red-700'}>
                        Path: {data.output.selectedPath}
                    </span>
                </div>
            )}
            <Handle type="source" position={Position.Right} className="!bg-purple-500 !w-3 !h-3" id="true" />
            <Handle type="source" position={Position.Bottom} className="!bg-purple-500 !w-3 !h-3" id="false" />
        </motion.div>
    );
});

UtilConditionalNode.displayName = 'UtilConditionalNode';
