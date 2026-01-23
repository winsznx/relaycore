/**
 * Indexer Node
 * Infrastructure-grade real-time blockchain observability
 * Displays indexer state, block height, and event stream
 */

import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Database, Activity, Clock, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { IndexerNodeData } from '../../types/playground.types';

export interface IndexerNodeProps {
    data: IndexerNodeData;
    selected?: boolean;
}

export function IndexerNode({ data, selected }: IndexerNodeProps) {
    const getFreshnessColor = () => {
        switch (data.dataFreshness) {
            case 'live':
                return 'text-green-600 bg-green-100';
            case 'stale':
                return 'text-yellow-600 bg-yellow-100';
            case 'error':
                return 'text-red-600 bg-red-100';
            default:
                return 'text-gray-600 bg-gray-100';
        }
    };

    const getFreshnessIcon = () => {
        switch (data.dataFreshness) {
            case 'live':
                return <Activity className="h-3 w-3 animate-pulse" />;
            case 'stale':
                return <Clock className="h-3 w-3" />;
            case 'error':
                return <AlertCircle className="h-3 w-3" />;
            default:
                return <Database className="h-3 w-3" />;
        }
    };

    const recentEvents = data.eventStream.slice(-5);
    const timeSinceUpdate = data.lastUpdate
        ? Math.floor((Date.now() - new Date(data.lastUpdate).getTime()) / 1000)
        : null;

    return (
        <div className="relative">
            <Handle
                type="target"
                position={Position.Left}
                className="!bg-indigo-500 !w-3 !h-3"
            />

            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{
                    scale: selected ? 1.05 : 1,
                    opacity: 1
                }}
                className="px-4 py-3 shadow-lg rounded-xl border-2 border-indigo-400 bg-gradient-to-br from-indigo-50 to-blue-50 min-w-[240px]"
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-indigo-500">
                            <Database className="h-4 w-4 text-white" />
                        </div>
                        <div>
                            <div className="font-semibold text-sm text-gray-800">
                                {data.label || 'Blockchain Indexer'}
                            </div>
                            <div className="text-xs text-gray-500">Real-time Observer</div>
                        </div>
                    </div>
                    <div className={`p-1 rounded ${getFreshnessColor()}`}>
                        {getFreshnessIcon()}
                    </div>
                </div>

                {/* Status Badge */}
                <div className="flex items-center gap-2 mb-2">
                    <Badge
                        variant={data.dataFreshness === 'live' ? 'default' : 'outline'}
                        className="text-xs"
                    >
                        {data.dataFreshness.toUpperCase()}
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
                    {/* Block Height */}
                    <div className="flex items-center justify-between">
                        <span className="text-gray-600">Block Height:</span>
                        <motion.span
                            key={data.blockHeight}
                            initial={{ scale: 1.2, color: '#3b82f6' }}
                            animate={{ scale: 1, color: '#1f2937' }}
                            className="font-mono font-semibold"
                        >
                            #{data.blockHeight.toLocaleString()}
                        </motion.span>
                    </div>

                    {/* Latency */}
                    <div className="flex items-center justify-between">
                        <span className="text-gray-600">Latency:</span>
                        <span className={`font-semibold ${data.latency < 1000 ? 'text-green-600' :
                                data.latency < 5000 ? 'text-yellow-600' :
                                    'text-red-600'
                            }`}>
                            {data.latency}ms
                        </span>
                    </div>

                    {/* Last Update */}
                    {timeSinceUpdate !== null && (
                        <div className="flex items-center justify-between">
                            <span className="text-gray-600">Updated:</span>
                            <span className="text-gray-700">
                                {timeSinceUpdate < 60
                                    ? `${timeSinceUpdate}s ago`
                                    : `${Math.floor(timeSinceUpdate / 60)}m ago`
                                }
                            </span>
                        </div>
                    )}

                    {/* Event Count */}
                    <div className="flex items-center justify-between">
                        <span className="text-gray-600">Events:</span>
                        <span className="font-semibold text-gray-800">
                            {data.eventStream.length}
                        </span>
                    </div>
                </div>

                {/* Recent Events Stream */}
                {recentEvents.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                        <div className="text-xs text-gray-600 mb-1 font-medium">
                            Recent Events:
                        </div>
                        <div className="space-y-1 max-h-[100px] overflow-y-auto">
                            {recentEvents.map((event, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    className="flex items-start gap-1.5 text-xs"
                                >
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-gray-700 truncate">
                                            {event.eventType}
                                        </div>
                                        <div className="text-gray-500 font-mono text-[10px]">
                                            Block #{event.blockNumber}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Live Indicator */}
                {data.dataFreshness === 'live' && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                        <div className="flex items-center gap-2 p-2 bg-green-100 rounded-lg">
                            <motion.div
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="w-2 h-2 bg-green-500 rounded-full"
                            />
                            <span className="text-xs text-green-700 font-medium">
                                Streaming live from Cronos
                            </span>
                        </div>
                    </div>
                )}

                {/* Error State */}
                {data.dataFreshness === 'error' && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                        <div className="flex items-center gap-2 p-2 bg-red-100 rounded-lg">
                            <AlertCircle className="h-3 w-3 text-red-600" />
                            <span className="text-xs text-red-700 font-medium">
                                Indexer connection error
                            </span>
                        </div>
                    </div>
                )}
            </motion.div>

            <Handle
                type="source"
                position={Position.Right}
                className="!bg-indigo-500 !w-3 !h-3"
            />
        </div>
    );
}

export default IndexerNode;
