/**
 * Enhanced Agent Node
 * Displays autonomous agent with real-time execution state, tool calls, and cost tracking
 */

import { Handle, Position } from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Zap, DollarSign, Wrench, Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { AgentNodeData } from '../../types/playground.types';

export interface AgentNodeProps {
    data: AgentNodeData;
    selected?: boolean;
}

export function AgentNode({ data, selected }: AgentNodeProps) {
    const getStatusColor = () => {
        switch (data.status) {
            case 'completed':
                return 'from-green-50 to-emerald-50 border-green-400';
            case 'executing':
                return 'from-blue-50 to-indigo-50 border-blue-400';
            case 'failed':
                return 'from-red-50 to-pink-50 border-red-400';
            case 'blocked':
                return 'from-yellow-50 to-amber-50 border-yellow-400';
            case 'planning':
                return 'from-purple-50 to-violet-50 border-purple-400';
            default:
                return 'from-gray-50 to-slate-50 border-gray-300';
        }
    };

    const getStatusIcon = () => {
        switch (data.status) {
            case 'executing':
                return <Activity className="h-3 w-3 text-blue-600 animate-pulse" />;
            case 'planning':
                return <Zap className="h-3 w-3 text-purple-600" />;
            default:
                return null;
        }
    };

    const totalPayments = data.paymentsSent.reduce((sum: number, p) => sum + p.amount, 0);
    const recentToolCalls = data.toolCalls.slice(-3);

    return (
        <div className="relative">
            <Handle
                type="target"
                position={Position.Left}
                className="!bg-blue-500 !w-3 !h-3"
            />

            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{
                    scale: selected ? 1.05 : 1,
                    opacity: 1
                }}
                className={`px-4 py-3 shadow-lg rounded-xl border-2 min-w-[220px] bg-gradient-to-br ${getStatusColor()}`}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${data.status === 'executing' ? 'bg-blue-500' :
                            data.status === 'completed' ? 'bg-green-500' :
                                data.status === 'failed' ? 'bg-red-500' :
                                    data.status === 'planning' ? 'bg-purple-500' :
                                        'bg-gray-500'
                            }`}>
                            <Bot className="h-4 w-4 text-white" />
                        </div>
                        <div>
                            <div className="font-semibold text-sm text-gray-800">
                                {data.label}
                            </div>
                            <div className="text-xs text-gray-500">{data.agentType}</div>
                        </div>
                    </div>
                    {getStatusIcon()}
                </div>

                {/* Status Badge */}
                <div className="flex items-center gap-2 mb-2">
                    <Badge
                        variant={
                            data.status === 'completed' ? 'default' :
                                data.status === 'failed' ? 'destructive' :
                                    'outline'
                        }
                        className="text-xs capitalize"
                    >
                        {data.status}
                    </Badge>
                    {data.executionMode === 'real' && (
                        <Badge variant="secondary" className="text-xs">
                            <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse" />
                            LIVE
                        </Badge>
                    )}
                </div>

                {/* Metrics */}
                <div className="space-y-1.5 text-xs">
                    {/* Cost Tracking */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-gray-600">
                            <DollarSign className="h-3 w-3" />
                            <span>Cost:</span>
                        </div>
                        <span className="font-semibold text-gray-800">
                            ${data.costIncurred.toFixed(4)}
                        </span>
                    </div>

                    {/* Tool Calls */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-gray-600">
                            <Wrench className="h-3 w-3" />
                            <span>Tools:</span>
                        </div>
                        <span className="font-semibold text-gray-800">
                            {data.toolCalls.length}
                        </span>
                    </div>

                    {/* Payments */}
                    {data.paymentsSent.length > 0 && (
                        <div className="flex items-center justify-between">
                            <span className="text-gray-600">Paid:</span>
                            <span className="font-semibold text-pink-600">
                                ${totalPayments.toFixed(4)}
                            </span>
                        </div>
                    )}
                </div>

                {/* Recent Tool Calls */}
                {recentToolCalls.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                        <div className="text-xs text-gray-600 mb-1 font-medium">Recent Tools:</div>
                        <div className="space-y-1">
                            {recentToolCalls.map((call, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="flex items-center gap-1 text-xs"
                                >
                                    <div className={`w-1.5 h-1.5 rounded-full ${call.error ? 'bg-red-500' : 'bg-green-500'
                                        }`} />
                                    <span className="text-gray-700 truncate max-w-[140px]">
                                        {call.toolName}
                                    </span>
                                    <span className="text-gray-500 ml-auto">
                                        {call.duration}ms
                                    </span>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Session Info */}
                {data.sessionId && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-600">Session:</span>
                            <span className="font-mono text-gray-700">
                                {data.sessionId.slice(0, 8)}...
                            </span>
                        </div>
                    </div>
                )}

                {/* Execution Indicator */}
                <AnimatePresence>
                    {data.status === 'executing' && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-2 overflow-hidden"
                        >
                            <div className="flex items-center gap-2 p-2 bg-blue-100 rounded-lg">
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                >
                                    <Zap className="h-3 w-3 text-blue-600" />
                                </motion.div>
                                <span className="text-xs text-blue-700 font-medium">
                                    Executing...
                                </span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            <Handle
                type="source"
                position={Position.Right}
                className="!bg-blue-500 !w-3 !h-3"
            />
        </div>
    );
}

export default AgentNode;
