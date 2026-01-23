/**
 * Enhanced Session Node
 * Displays escrow session with real-time budget tracking and agent authorization
 */

import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Shield, Users, DollarSign, Clock, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { SessionNodeData } from '../../types/playground.types';

export interface SessionNodeProps {
    data: SessionNodeData;
    selected?: boolean;
}

export function SessionNode({ data, selected }: SessionNodeProps) {
    const budgetPercentage = (data.released / data.deposited) * 100;
    const timeRemaining = data.expiresAt
        ? Math.max(0, new Date(data.expiresAt).getTime() - Date.now())
        : 0;
    const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));
    const minutesRemaining = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));

    return (
        <div className="relative">
            <Handle
                type="target"
                position={Position.Left}
                className="!bg-emerald-500 !w-3 !h-3"
            />

            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{
                    scale: selected ? 1.05 : 1,
                    opacity: 1
                }}
                className={`px-4 py-3 shadow-lg rounded-xl border-2 min-w-[240px] ${data.isActive
                        ? 'border-emerald-400 bg-gradient-to-br from-emerald-50 to-teal-50'
                        : 'border-gray-300 bg-gradient-to-br from-gray-50 to-slate-50'
                    }`}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${data.isActive ? 'bg-emerald-500' : 'bg-gray-500'
                            }`}>
                            <Shield className="h-4 w-4 text-white" />
                        </div>
                        <div>
                            <div className="font-semibold text-sm text-gray-800">
                                {data.label}
                            </div>
                            <div className="text-xs text-gray-500 font-mono">
                                {data.sessionId.slice(0, 10)}...
                            </div>
                        </div>
                    </div>
                    {data.isActive && (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    )}
                </div>

                {/* Status Badges */}
                <div className="flex items-center gap-2 mb-2">
                    <Badge
                        variant={data.isActive ? 'default' : 'outline'}
                        className="text-xs"
                    >
                        {data.isActive ? 'ACTIVE' : 'CLOSED'}
                    </Badge>
                    {data.executionMode === 'real' && (
                        <Badge variant="secondary" className="text-xs">
                            <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse" />
                            LIVE
                        </Badge>
                    )}
                </div>

                {/* Budget Tracking */}
                <div className="space-y-2">
                    {/* Budget Bar */}
                    <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-gray-600">Budget Usage:</span>
                            <span className="font-semibold text-gray-800">
                                {budgetPercentage.toFixed(1)}%
                            </span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${budgetPercentage}%` }}
                                transition={{ duration: 0.5 }}
                                className={`h-full ${budgetPercentage < 50 ? 'bg-green-500' :
                                        budgetPercentage < 80 ? 'bg-yellow-500' :
                                            'bg-red-500'
                                    }`}
                            />
                        </div>
                    </div>

                    {/* Budget Details */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                            <div className="text-gray-600">Deposited:</div>
                            <div className="font-semibold text-gray-800">
                                ${data.deposited.toFixed(2)}
                            </div>
                        </div>
                        <div>
                            <div className="text-gray-600">Released:</div>
                            <div className="font-semibold text-pink-600">
                                ${data.released.toFixed(2)}
                            </div>
                        </div>
                        <div className="col-span-2">
                            <div className="text-gray-600">Remaining:</div>
                            <div className="font-semibold text-emerald-600 text-base">
                                ${data.remaining.toFixed(2)}
                            </div>
                        </div>
                    </div>

                    {/* Expiry */}
                    {data.isActive && timeRemaining > 0 && (
                        <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-200">
                            <div className="flex items-center gap-1 text-gray-600">
                                <Clock className="h-3 w-3" />
                                <span>Expires in:</span>
                            </div>
                            <span className={`font-semibold ${hoursRemaining < 1 ? 'text-red-600' :
                                    hoursRemaining < 24 ? 'text-yellow-600' :
                                        'text-gray-800'
                                }`}>
                                {hoursRemaining}h {minutesRemaining}m
                            </span>
                        </div>
                    )}

                    {/* Authorized Agents */}
                    {data.authorizedAgents.length > 0 && (
                        <div className="pt-2 border-t border-gray-200">
                            <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
                                <Users className="h-3 w-3" />
                                <span>Authorized Agents ({data.authorizedAgents.length}):</span>
                            </div>
                            <div className="space-y-1">
                                {data.authorizedAgents.slice(0, 3).map((agent, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center gap-1.5 text-xs"
                                    >
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        <span className="font-mono text-gray-700">
                                            {agent.slice(0, 6)}...{agent.slice(-4)}
                                        </span>
                                    </div>
                                ))}
                                {data.authorizedAgents.length > 3 && (
                                    <div className="text-xs text-gray-500 pl-3">
                                        +{data.authorizedAgents.length - 3} more
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Recent Events */}
                    {data.events.length > 0 && (
                        <div className="pt-2 border-t border-gray-200">
                            <div className="text-xs text-gray-600 mb-1 font-medium">
                                Recent Activity:
                            </div>
                            <div className="space-y-1 max-h-[80px] overflow-y-auto">
                                {data.events.slice(-3).map((event, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="flex items-center gap-1.5 text-xs"
                                    >
                                        <div className={`w-1.5 h-1.5 rounded-full ${event.eventType === 'RELEASE' ? 'bg-pink-500' :
                                                event.eventType === 'DEPOSIT' ? 'bg-green-500' :
                                                    event.eventType === 'AUTHORIZE' ? 'bg-blue-500' :
                                                        'bg-gray-500'
                                            }`} />
                                        <span className="text-gray-700">
                                            {event.eventType}
                                        </span>
                                        {event.amount && (
                                            <span className="text-gray-500 ml-auto">
                                                ${event.amount}
                                            </span>
                                        )}
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Owner Info */}
                <div className="mt-2 pt-2 border-t border-gray-200">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">Owner:</span>
                        <span className="font-mono text-gray-700">
                            {data.ownerAddress.slice(0, 6)}...{data.ownerAddress.slice(-4)}
                        </span>
                    </div>
                </div>
            </motion.div>

            <Handle
                type="source"
                position={Position.Right}
                className="!bg-emerald-500 !w-3 !h-3"
            />
        </div>
    );
}

export default SessionNode;
