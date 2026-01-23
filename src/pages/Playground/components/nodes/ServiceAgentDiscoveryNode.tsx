import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Search, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface AgentDiscoveryNodeData {
    label: string;
    status: 'idle' | 'executing' | 'complete' | 'error';
    config?: {
        capability?: string;
        category?: string;
        minReputation?: number;
    };
    output?: {
        discoveredAgents: Array<{
            id: string;
            name: string;
            reputation: number;
            endpoint?: string;
        }>;
    };
}

export const ServiceAgentDiscoveryNode = memo(({ data }: { data: AgentDiscoveryNodeData }) => {
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
            default: return <Search className="h-4 w-4 text-purple-600" />;
        }
    };

    return (
        <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`px-4 py-3 rounded-lg border-2 min-w-[220px] shadow-lg ${getStatusColor()}`}
        >
            <Handle type="target" position={Position.Left} className="!bg-purple-500 !w-3 !h-3" />

            <div className="flex items-center gap-2 mb-2">
                {getStatusIcon()}
                <div>
                    <div className="font-semibold text-sm">Agent Discovery</div>
                    <div className="text-xs text-gray-500">{data.label}</div>
                </div>
            </div>

            {data.config && (
                <div className="text-xs space-y-1 mb-2">
                    {data.config.capability && (
                        <div className="text-gray-600">
                            Capability: {data.config.capability}
                        </div>
                    )}
                    {data.config.minReputation && (
                        <div className="text-gray-600">
                            Min Rep: {data.config.minReputation}
                        </div>
                    )}
                </div>
            )}

            {data.output && (
                <div className="text-xs">
                    <div className="font-semibold text-green-700">
                        Found {data.output.discoveredAgents.length} agents
                    </div>
                    <div className="mt-1 space-y-1">
                        {data.output.discoveredAgents.slice(0, 3).map((agent, i) => (
                            <div key={i} className="text-gray-600 truncate">
                                {agent.name} ({agent.reputation})
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <Handle type="source" position={Position.Right} className="!bg-purple-500 !w-3 !h-3" />
        </motion.div>
    );
});

ServiceAgentDiscoveryNode.displayName = 'ServiceAgentDiscoveryNode';
