/**
 * On-Chain Analytics Dashboard Component
 * 
 * Displays real-time data from deployed ERC-8004 contracts
 * including agent count, reputation metrics, and recent events.
 */

import { useEffect, useState } from 'react';
import { useOnChainContracts, useContractEvents } from '@/lib/useContracts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Users,
    Star,
    MessageSquare,
    Activity,
    ExternalLink,
    RefreshCw,
    TrendingUp,
    CheckCircle,
    Clock
} from 'lucide-react';

interface OnChainStatsProps {
    className?: string;
}

export function OnChainStats({ className = '' }: OnChainStatsProps) {
    const { stats, loading, error, refetch, contracts } = useOnChainContracts();
    const { events, listening, startListening } = useContractEvents();
    const [autoRefresh, setAutoRefresh] = useState(true);

    // Auto-refresh every 30 seconds
    useEffect(() => {
        if (autoRefresh) {
            const interval = setInterval(() => {
                refetch();
            }, 30000);
            return () => clearInterval(interval);
        }
    }, [autoRefresh, refetch]);

    // Start listening for events
    useEffect(() => {
        startListening();
    }, [startListening]);

    const explorerUrl = (address: string) =>
        `https://explorer.cronos.org/testnet/address/${address}`;

    return (
        <div className={`space-y-6 ${className}`}>
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">On-Chain Analytics</h2>
                    <p className="text-sm text-gray-500">
                        Live data from ERC-8004 contracts on Cronos Testnet
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={refetch}
                        disabled={loading}
                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                    <button
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${autoRefresh
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                            }`}
                    >
                        <Activity className={`w-4 h-4 ${autoRefresh ? 'animate-pulse' : ''}`} />
                        {autoRefresh ? 'Live' : 'Paused'}
                    </button>
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
                    {error}
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Users className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-gray-900">
                                    {loading ? '...' : stats?.totalAgents || 0}
                                </div>
                                <div className="text-xs text-gray-500">Registered Agents</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-yellow-100 rounded-lg">
                                <Star className="w-5 h-5 text-yellow-600" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-gray-900">
                                    {loading ? '...' : (stats?.averageReputation?.toFixed(0) || 0)}
                                </div>
                                <div className="text-xs text-gray-500">Avg Reputation</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 rounded-lg">
                                <MessageSquare className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-gray-900">
                                    {loading ? '...' : stats?.totalFeedback || 0}
                                </div>
                                <div className="text-xs text-gray-500">Total Feedback</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <TrendingUp className="w-5 h-5 text-purple-600" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-gray-900">
                                    {events.length}
                                </div>
                                <div className="text-xs text-gray-500">Events Today</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Contract Addresses */}
            <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-700">
                        Deployed Contracts
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {[
                        { name: 'IdentityRegistry', address: contracts.identityRegistry },
                        { name: 'ReputationRegistry', address: contracts.reputationRegistry },
                        { name: 'ValidationRegistry', address: contracts.validationRegistry }
                    ].map(contract => (
                        <div
                            key={contract.name}
                            className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                        >
                            <div className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                <span className="text-sm font-medium text-gray-700">
                                    {contract.name}
                                </span>
                            </div>
                            <a
                                href={explorerUrl(contract.address)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-blue-600 hover:underline font-mono"
                            >
                                {contract.address.slice(0, 10)}...{contract.address.slice(-6)}
                                <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>
                    ))}
                </CardContent>
            </Card>

            {/* Recent Events */}
            {events.length > 0 && (
                <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                            <Activity className="w-4 h-4" />
                            Recent Events
                            {listening && (
                                <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                                    Live
                                </Badge>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {events.slice(-10).reverse().map((event, i) => (
                                <div
                                    key={i}
                                    className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm"
                                >
                                    <div className="flex items-center gap-2">
                                        <Badge variant={event.type === 'AgentRegistered' ? 'default' : 'secondary'}>
                                            {event.type}
                                        </Badge>
                                        <span className="text-gray-600">
                                            Agent #{event.agentId}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1 text-gray-400 text-xs">
                                        <Clock className="w-3 h-3" />
                                        {event.timestamp.toLocaleTimeString()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Last Updated */}
            {stats?.lastUpdated && (
                <div className="text-center text-xs text-gray-400">
                    Last updated: {stats.lastUpdated.toLocaleTimeString()}
                </div>
            )}
        </div>
    );
}

export default OnChainStats;
