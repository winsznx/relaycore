/**
 * Enhanced Endpoint Node
 * Displays API endpoint with x402 protection, performance metrics, and call history
 */

import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Globe, Shield, TrendingUp, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { EndpointNodeData } from '../../types/playground.types';

export interface EndpointNodeProps {
    data: EndpointNodeData;
    selected?: boolean;
}

export function EndpointNode({ data, selected }: EndpointNodeProps) {
    const recentCalls = data.callHistory.slice(-3);

    return (
        <div className="relative">
            <Handle
                type="target"
                position={Position.Left}
                className="!bg-purple-500 !w-3 !h-3"
            />

            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{
                    scale: selected ? 1.05 : 1,
                    opacity: 1
                }}
                className="px-4 py-3 shadow-lg rounded-xl border-2 border-purple-400 bg-gradient-to-br from-purple-50 to-fuchsia-50 min-w-[220px]"
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-purple-500">
                            <Globe className="h-4 w-4 text-white" />
                        </div>
                        <div>
                            <div className="font-semibold text-sm text-gray-800">
                                {data.label}
                            </div>
                            <div className="text-xs text-gray-500 truncate max-w-[140px]">
                                {data.method} {new URL(data.url).pathname}
                            </div>
                        </div>
                    </div>
                    {data.x402Protected && (
                        <Shield className="h-4 w-4 text-purple-600" />
                    )}
                </div>

                {/* Status Badges */}
                <div className="flex items-center gap-2 mb-2">
                    {data.x402Protected && (
                        <Badge variant="default" className="text-xs bg-purple-600">
                            x402 Protected
                        </Badge>
                    )}
                    {data.executionMode === 'real' && (
                        <Badge variant="secondary" className="text-xs">
                            <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse" />
                            LIVE
                        </Badge>
                    )}
                </div>

                {/* Price */}
                {data.pricePerCall !== undefined && (
                    <div className="mb-2">
                        <div className="text-xs text-gray-600">Price per call:</div>
                        <div className="text-lg font-semibold text-purple-600">
                            ${data.pricePerCall.toFixed(4)}
                        </div>
                    </div>
                )}

                {/* Performance Metrics */}
                <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-gray-600">
                            <TrendingUp className="h-3 w-3" />
                            <span>Success Rate:</span>
                        </div>
                        <span className={`font-semibold ${data.successRate >= 95 ? 'text-green-600' :
                                data.successRate >= 80 ? 'text-yellow-600' :
                                    'text-red-600'
                            }`}>
                            {data.successRate.toFixed(1)}%
                        </span>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-gray-600">
                            <Clock className="h-3 w-3" />
                            <span>Avg Response:</span>
                        </div>
                        <span className={`font-semibold ${data.responseTime < 200 ? 'text-green-600' :
                                data.responseTime < 1000 ? 'text-yellow-600' :
                                    'text-red-600'
                            }`}>
                            {data.responseTime}ms
                        </span>
                    </div>
                </div>

                {/* Recent Calls */}
                {recentCalls.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                        <div className="text-xs text-gray-600 mb-1 font-medium">
                            Recent Calls:
                        </div>
                        <div className="space-y-1">
                            {recentCalls.map((call, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="flex items-center gap-1.5 text-xs"
                                >
                                    <div className={`w-1.5 h-1.5 rounded-full ${call.success ? 'bg-green-500' : 'bg-red-500'
                                        }`} />
                                    <span className="text-gray-700">
                                        {call.statusCode}
                                    </span>
                                    <span className="text-gray-500 ml-auto">
                                        {call.responseTime}ms
                                    </span>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Call Count */}
                <div className="mt-2 pt-2 border-t border-gray-200">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">Total Calls:</span>
                        <span className="font-semibold text-gray-800">
                            {data.callHistory.length}
                        </span>
                    </div>
                </div>
            </motion.div>

            <Handle
                type="source"
                position={Position.Right}
                className="!bg-purple-500 !w-3 !h-3"
            />
        </div>
    );
}

export default EndpointNode;
