import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Address, TxHash } from '@/components/ui/address';
import { StatsCard, StatsGrid } from '@/components/ui/stats-card';
import { DataTable, type ExtendedColumnDef } from '@/components/ui/data-table';
import { Sparkline } from '@/components/ui/sparkline';
import {
    Search, DollarSign, RefreshCw,
    Layers, CreditCard, Bot, TrendingUp,
    Activity, XCircle, AlertTriangle,
    Database, Globe, Timer,
    CheckCircle2
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import type {
    LatestBlock,
    SessionRecord,
    TransactionRecord,
    AgentRecord,
    PaymentRecord,
    SessionDetail,
    HealthStatus,
    HealthCheck,
    SystemMetrics,
    Trace,
    AlertRecord,
    RWARecord
} from '@/types/dashboard';

type TabId = 'sessions' | 'transactions' | 'agents' | 'payments' | 'rwas' | 'system';

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        success: 'bg-green-500/10 text-green-600 border-green-500/20',
        active: 'bg-green-500/10 text-green-600 border-green-500/20',
        pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
        failed: 'bg-red-500/10 text-red-600 border-red-500/20',
        closed: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
        refunded: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
        settled: 'bg-green-500/10 text-green-600 border-green-500/20',
        pass: 'bg-green-500/10 text-green-600 border-green-500/20',
        fail: 'bg-red-500/10 text-red-600 border-red-500/20',
        warn: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
        created: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
        verified: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
        escrowed: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
        in_process: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
        fulfilled: 'bg-green-500/10 text-green-600 border-green-500/20',
        disputed: 'bg-red-500/10 text-red-600 border-red-500/20',
    };

    return (
        <Badge
            variant="outline"
            className={styles[status] || styles.pending}
        >
            {status}
        </Badge>
    );
}

function formatTimeAgo(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return '-';
    const seconds = Math.floor((Date.now() - dateObj.getTime()) / 1000);
    if (seconds < 0) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

function formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
}

function formatCurrency(value: string | number, isBaseUnits: boolean = true): string {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '$0.00';

    const displayValue = isBaseUnits ? num / 1e6 : num;

    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
    }).format(displayValue);
}

export function Explorer() {
    const [searchParams, setSearchParams] = useSearchParams();
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
    const [activeTab, setActiveTab] = useState<TabId>('sessions');
    const [loading, setLoading] = useState(true);

    const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
    const [sessionDetailLoading, setSessionDetailLoading] = useState(false);

    const [health, setHealth] = useState<HealthStatus | null>(null);
    const [sysMetrics, setSysMetrics] = useState<SystemMetrics | null>(null);
    const [traces, setTraces] = useState<Trace[]>([]);
    const [alerts, setAlerts] = useState<AlertRecord[]>([]);
    const [indexers, setIndexers] = useState<{ name: string; schedule: string; lastBlock: number; lastRun: string | null; status: string }[]>([]);
    const [connections, setConnections] = useState<{ name: string; status: string; latestBlock?: number; latencyMs?: number; error?: string }[]>([]);

    const [latestBlock, setLatestBlock] = useState<LatestBlock | null>(null);
    const [sessions, setSessions] = useState<SessionRecord[]>([]);
    const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
    const [agents, setAgents] = useState<AgentRecord[]>([]);
    const [payments, setPayments] = useState<PaymentRecord[]>([]);
    const [rwas, setRwas] = useState<RWARecord[]>([]);
    const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);
    const [paymentDetailLoading, setPaymentDetailLoading] = useState(false);

    const [searchResults, setSearchResults] = useState<any>(null);
    const [isSearching, setIsSearching] = useState(false);

    const [stats, setStats] = useState({
        totalSessions: 0,
        activeAgents: 0,
        totalVolume: '0',
        successRate: 0,
        sparklines: {
            sessions: [] as number[],
            agents: [] as number[],
            volume: [] as number[],
            success: [] as number[]
        }
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const apiUrl = import.meta.env.VITE_API_URL || '';
            const response = await fetch(`${apiUrl}/api/explorer/overview`);
            if (response.ok) {
                const data = await response.json();
                setStats(data.stats || stats);
                setSessions(data.sessions || []);
                setTransactions(data.transactions || []);
                setAgents(data.agents || []);
                setPayments(data.payments || []);
            }

            try {
                const rpcResponse = await fetch('https://evm-t3.cronos.org', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'eth_getBlockByNumber',
                        params: ['latest', false],
                        id: 1
                    })
                });
                const blockData = await rpcResponse.json();
                if (blockData.result) {
                    const block = blockData.result;
                    setLatestBlock({
                        blockNumber: parseInt(block.number, 16),
                        timestamp: new Date(parseInt(block.timestamp, 16) * 1000),
                        txCount: block.transactions?.length || 0,
                        gasUsed: `${(parseInt(block.gasUsed, 16) / 1e6).toFixed(2)}M`
                    });
                }
            } catch (rpcError) {
                console.warn('Failed to fetch block from RPC:', rpcError);
            }
        } catch (error) {
            console.error('Explorer data fetch failed:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const [systemLoading, setSystemLoading] = useState(false);

    const fetchSystemData = async () => {
        setSystemLoading(true);
        try {
            const apiUrl = import.meta.env.VITE_API_URL || '';
            const [healthRes, metricsRes, tracesRes, alertsRes, indexersRes, connectionsRes] = await Promise.allSettled([
                fetch(`${apiUrl}/api/observability/health`),
                fetch(`${apiUrl}/api/observability/metrics/json`),
                fetch(`${apiUrl}/api/observability/traces?limit=10`),
                fetch(`${apiUrl}/api/observability/alerts?limit=10`),
                fetch(`${apiUrl}/api/observability/indexers`),
                fetch(`${apiUrl}/api/observability/connections`)
            ]);

            if (healthRes.status === 'fulfilled' && healthRes.value.ok) {
                const data = await healthRes.value.json();
                setHealth(data);
            }
            if (metricsRes.status === 'fulfilled' && metricsRes.value.ok) {
                const metricsData = await metricsRes.value.json();
                // API returns { system: {...}, histograms: {...}, counters: {...} }
                // Extract the system object for display
                setSysMetrics(metricsData.system || metricsData);
            }
            if (tracesRes.status === 'fulfilled' && tracesRes.value.ok) {
                const tracesData = await tracesRes.value.json();
                setTraces(Array.isArray(tracesData.traces) ? tracesData.traces : []);
            }
            if (alertsRes.status === 'fulfilled' && alertsRes.value.ok) {
                const alertsData = await alertsRes.value.json();
                setAlerts(Array.isArray(alertsData.alerts) ? alertsData.alerts : []);
            }
            if (indexersRes.status === 'fulfilled' && indexersRes.value.ok) {
                const indexersData = await indexersRes.value.json();
                setIndexers(Array.isArray(indexersData.indexers) ? indexersData.indexers : []);
            }
            if (connectionsRes.status === 'fulfilled' && connectionsRes.value.ok) {
                const connectionsData = await connectionsRes.value.json();
                setConnections(Array.isArray(connectionsData.connections) ? connectionsData.connections : []);
            }
        } catch (error) {
            console.error('Failed to fetch system data:', error);
        } finally {
            setSystemLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (sessionId) {
            setSessionDetailLoading(true);
            const apiUrl = import.meta.env.VITE_API_URL || '';
            fetch(`${apiUrl}/api/explorer/sessions/${sessionId}`)
                .then(res => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    return res.json();
                })
                .then(data => {
                    if (data.error) {
                        console.error('Session not found:', data.error);
                        navigate('/explorer');
                        return;
                    }
                    // Ensure arrays are always defined to prevent crashes
                    const session = data.session || {};
                    setSessionDetail({
                        sessionId: session.sessionId || sessionId,
                        owner: session.owner || '',
                        totalDeposited: session.totalDeposited || '0',
                        totalSpent: session.totalSpent || '0',
                        maxSpend: session.maxSpend || '0',
                        remaining: session.remaining || '0',
                        state: session.state || 'pending',
                        createdAt: session.createdAt || new Date(),
                        expiresAt: session.expiresAt,
                        closedAt: session.closedAt,
                        depositTxHash: session.depositTxHash,
                        events: session.events || [],
                        agents: session.agents || [],
                        paymentCount: session.paymentCount || 0
                    });
                    setSessionDetailLoading(false);
                })
                .catch(error => {
                    console.error('Failed to fetch session detail:', error);
                    setSessionDetailLoading(false);
                    navigate('/explorer');
                });
        } else {
            setSessionDetail(null);
        }
    }, [sessionId, navigate]);

    useEffect(() => {
        if (activeTab === 'system') {
            fetchSystemData();
        }
    }, [activeTab]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            setSearchParams({ q: searchQuery });
            setIsSearching(true);
            setLoading(true);
            try {
                const apiUrl = import.meta.env.VITE_API_URL || '';
                const response = await fetch(`${apiUrl}/api/explorer/search?q=${encodeURIComponent(searchQuery)}`);
                if (response.ok) {
                    const data = await response.json();
                    console.log('Search results:', data);
                    setSearchResults(data);
                } else {
                    setSearchResults({ results: [] });
                }
            } catch (error) {
                console.error('Search failed:', error);
                setSearchResults({ results: [] });
            } finally {
                setLoading(false);
            }
        } else {
            setSearchParams({});
            setSearchResults(null);
            setIsSearching(false);
        }
    };

    const tabs = [
        { id: 'sessions' as TabId, label: 'Sessions', icon: Layers, count: sessions.length },
        { id: 'transactions' as TabId, label: 'Transactions', icon: Activity, count: transactions.length },
        { id: 'agents' as TabId, label: 'Agents', icon: Bot, count: agents.length },
        { id: 'payments' as TabId, label: 'Payments', icon: CreditCard, count: payments.length },
        { id: 'system' as TabId, label: 'System', icon: Activity, count: alerts.length }
    ];

    const sessionColumns: ExtendedColumnDef<SessionRecord>[] = useMemo(() => [
        {
            accessorKey: 'sessionId',
            header: () => <span className="text-xs">Session ID</span>,
            cell: ({ row }) => (
                <span className="font-mono text-sm">{row.original.sessionId}</span>
            ),
            size: 100,
        },
        {
            accessorKey: 'owner',
            header: () => <span className="text-xs">Owner</span>,
            cell: ({ row }) => <Address address={row.original.owner} />,
            size: 150,
        },
        {
            accessorKey: 'totalDeposited',
            header: () => <span className="text-xs">Deposited</span>,
            cell: ({ row }) => formatCurrency(row.original.totalDeposited),
            size: 100,
        },
        {
            accessorKey: 'totalSpent',
            header: () => <span className="text-xs">Spent</span>,
            cell: ({ row }) => formatCurrency(row.original.totalSpent),
            size: 100,
        },
        {
            accessorKey: 'agentCount',
            header: () => <span className="text-xs">Agents</span>,
            cell: ({ row }) => row.original.agentCount,
            size: 80,
        },
        {
            accessorKey: 'state',
            header: () => <span className="text-xs">Status</span>,
            cell: ({ row }) => <StatusBadge status={row.original.state} />,
            size: 100,
        },
    ], []);

    const transactionColumns: ExtendedColumnDef<TransactionRecord>[] = useMemo(() => [
        {
            accessorKey: 'txHash',
            header: () => <span className="text-xs">Transaction</span>,
            cell: ({ row }) => <TxHash hash={row.original.txHash} />,
            size: 150,
        },
        {
            accessorKey: 'type',
            header: () => <span className="text-xs">Type</span>,
            cell: ({ row }) => (
                <Badge variant="outline" className="text-xs capitalize">
                    {row.original.type}
                </Badge>
            ),
            size: 100,
        },
        {
            accessorKey: 'from',
            header: () => <span className="text-xs">From</span>,
            cell: ({ row }) => <Address address={row.original.from} />,
            size: 150,
        },
        {
            accessorKey: 'to',
            header: () => <span className="text-xs">To</span>,
            cell: ({ row }) => <Address address={row.original.to} />,
            size: 150,
        },
        {
            accessorKey: 'value',
            header: () => <span className="text-xs">Value</span>,
            cell: ({ row }) => formatCurrency(row.original.value),
            size: 100,
        },
        {
            accessorKey: 'status',
            header: () => <span className="text-xs">Status</span>,
            cell: ({ row }) => <StatusBadge status={row.original.status} />,
            size: 100,
        },
    ], []);

    const agentColumns: ExtendedColumnDef<AgentRecord>[] = useMemo(() => [
        {
            accessorKey: 'name',
            header: () => <span className="text-xs">Agent</span>,
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-medium">{row.original.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">
                        {row.original.agentId.slice(0, 8)}...
                    </span>
                </div>
            ),
            size: 200,
        },
        {
            accessorKey: 'owner',
            header: () => <span className="text-xs">Owner</span>,
            cell: ({ row }) => <Address address={row.original.owner} />,
            size: 150,
        },
        {
            accessorKey: 'sessionsActive',
            header: () => <span className="text-xs">Sessions</span>,
            cell: ({ row }) => row.original.sessionsActive,
            size: 80,
        },
        {
            accessorKey: 'totalEarned',
            header: () => <span className="text-xs">Earned</span>,
            cell: ({ row }) => formatCurrency(row.original.totalEarned),
            size: 100,
        },
        {
            accessorKey: 'successRate',
            header: () => <span className="text-xs">Success</span>,
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                            className="h-full bg-green-500 rounded-full"
                            style={{ width: `${row.original.successRate}%` }}
                        />
                    </div>
                    <span className="text-xs">{row.original.successRate}%</span>
                </div>
            ),
            size: 120,
        },
        {
            accessorKey: 'lastActive',
            header: () => <span className="text-xs">Last Active</span>,
            cell: ({ row }) => (
                <span className="text-xs text-muted-foreground">
                    {formatTimeAgo(row.original.lastActive)}
                </span>
            ),
            size: 100,
        },
    ], []);

    const paymentColumns: ExtendedColumnDef<PaymentRecord>[] = useMemo(() => [
        {
            accessorKey: 'paymentId',
            header: () => <span className="text-xs">Payment ID</span>,
            cell: ({ row }) => (
                <span className="font-mono text-xs">
                    {row.original.paymentId.slice(0, 12)}...
                </span>
            ),
            size: 120,
        },
        {
            accessorKey: 'from',
            header: () => <span className="text-xs">From</span>,
            cell: ({ row }) => <Address address={row.original.from} />,
            size: 150,
        },
        {
            accessorKey: 'to',
            header: () => <span className="text-xs">To</span>,
            cell: ({ row }) => <Address address={row.original.to} />,
            size: 150,
        },
        {
            accessorKey: 'amount',
            header: () => <span className="text-xs">Amount</span>,
            cell: ({ row }) => (
                <span className="font-medium">{formatCurrency(row.original.amount)}</span>
            ),
            size: 100,
        },
        {
            accessorKey: 'status',
            header: () => <span className="text-xs">Status</span>,
            cell: ({ row }) => <StatusBadge status={row.original.status} />,
            size: 100,
        },
        {
            accessorKey: 'timestamp',
            header: () => <span className="text-xs">Time</span>,
            cell: ({ row }) => (
                <span className="text-xs text-muted-foreground">
                    {formatTimeAgo(row.original.timestamp)}
                </span>
            ),
            size: 100,
        },
    ], []);

    if (sessionId) {
        if (sessionDetailLoading || !sessionDetail) {
            return (
                <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                    <div className="text-center">
                        <RefreshCw className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
                        <p className="text-gray-600">Loading session details...</p>
                    </div>
                </div>
            );
        }

        return (
            <div className="min-h-screen bg-gray-50">
                <div className="bg-white border-b border-gray-200">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => navigate('/explorer')}
                                    className="gap-2"
                                >
                                    ← Back to Explorer
                                </Button>
                                <div className="p-2 bg-blue-100 rounded-lg">
                                    <Layers className="h-6 w-6 text-blue-600" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900">Session Details</h1>
                                    <p className="text-sm text-gray-500 font-mono">{sessionDetail.sessionId}</p>
                                </div>
                            </div>
                            <StatusBadge status={sessionDetail.state} />
                        </div>

                        <div className="grid grid-cols-4 gap-4">
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-gray-500">Owner</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Address address={sessionDetail.owner} />
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-gray-500">Total Deposited</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-bold">{formatCurrency(sessionDetail.totalDeposited)}</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-gray-500">Total Spent</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-bold">{formatCurrency(sessionDetail.totalSpent)}</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-gray-500">Created</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm">{formatTimeAgo(sessionDetail.createdAt)}</p>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Authorized Agents</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {sessionDetail.agents.length === 0 ? (
                                <p className="text-sm text-gray-500">No agents authorized yet</p>
                            ) : (
                                <div className="space-y-3">
                                    {sessionDetail.agents.map((agent) => (
                                        <div key={agent.agentId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <div>
                                                <Address address={agent.agentId} />
                                                <p className="text-xs text-gray-500 mt-1">
                                                    Authorized {formatTimeAgo(agent.authorizedAt)}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-semibold">{formatCurrency(agent.totalSpend)}</p>
                                                <p className="text-xs text-gray-500">Total Spend</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Session Events</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {sessionDetail.events.length === 0 ? (
                                <p className="text-sm text-gray-500">No events recorded</p>
                            ) : (
                                <div className="space-y-3">
                                    {sessionDetail.events.map((event) => (
                                        <div key={event.id} className="flex items-center justify-between p-3 border-l-4 border-blue-500 bg-gray-50 rounded">
                                            <div>
                                                <Badge variant="outline" className="mb-1">{event.type}</Badge>
                                                <TxHash hash={event.txHash} />
                                            </div>
                                            <p className="text-xs text-gray-500">{formatTimeAgo(event.timestamp)}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <Logo className="h-7 w-7" />
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="text-2xl font-bold text-gray-900">Relay Explorer</h1>
                                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                                        Cronos EVM Testnet
                                    </Badge>
                                </div>
                                {latestBlock && (
                                    <div className="flex items-center gap-2 text-sm text-gray-500">
                                        <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                        Block #{latestBlock.blockNumber.toLocaleString()}
                                    </div>
                                )}
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchData()}
                            disabled={loading}
                            className="gap-2"
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>

                    <form onSubmit={handleSearch} className="relative max-w-2xl">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by Session ID, Transaction Hash, Agent Address, or Payment ID..."
                            className="pl-10 h-12 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                        />
                    </form>

                    <StatsGrid className="mt-8">
                        <StatsCard
                            title="Total Sessions"
                            value={stats.totalSessions.toString()}
                            icon={Layers}
                            sparklineData={stats.sparklines?.sessions?.length ? stats.sparklines.sessions : undefined}
                            sparklineColor="#3b82f6"
                            isLoading={loading}
                        />
                        <StatsCard
                            title="Active Agents"
                            value={stats.activeAgents.toString()}
                            icon={Bot}
                            sparklineData={stats.sparklines?.agents?.length ? stats.sparklines.agents : undefined}
                            sparklineColor="#10b981"
                            isLoading={loading}
                        />
                        <StatsCard
                            title="Total Volume"
                            value={formatCurrency(stats.totalVolume)}
                            icon={DollarSign}
                            sparklineData={stats.sparklines?.volume?.length ? stats.sparklines.volume : undefined}
                            sparklineColor="#8b5cf6"
                            isLoading={loading}
                        />
                        <StatsCard
                            title="Success Rate"
                            value={`${stats.successRate}%`}
                            icon={TrendingUp}
                            sparklineData={stats.sparklines?.success?.length ? stats.sparklines.success : undefined}
                            sparklineColor="#f59e0b"
                            isLoading={loading}
                        />
                    </StatsGrid>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
                    {tabs.map((tab) => (
                        <Button
                            key={tab.id}
                            variant={activeTab === tab.id ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setActiveTab(tab.id)}
                            className="gap-2 whitespace-nowrap"
                        >
                            <tab.icon className="h-4 w-4" />
                            {tab.label}
                            {tab.count > 0 && (
                                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                                    {tab.count}
                                </Badge>
                            )}
                        </Button>
                    ))}
                </div>

                <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                    <div className="border-b border-gray-200 px-6 py-4">
                        <h2 className="text-lg font-semibold text-gray-900">
                            {activeTab === 'sessions' && 'Escrow Sessions'}
                            {activeTab === 'transactions' && 'On-Chain Transactions'}
                            {activeTab === 'agents' && 'Registered Agents'}
                            {activeTab === 'payments' && 'x402 Payments'}
                            {activeTab === 'system' && 'System Health'}
                        </h2>
                    </div>
                    <div>
                        {searchResults ? (
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900">
                                            Search Results for "{searchQuery}"
                                        </h3>
                                        <p className="text-sm text-gray-500 mt-1">
                                            Found {searchResults.results?.length || 0} results
                                        </p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setSearchQuery('');
                                            setSearchResults(null);
                                            setIsSearching(false);
                                            setSearchParams({});
                                        }}
                                    >
                                        Clear Search
                                    </Button>
                                </div>

                                {loading ? (
                                    <div className="text-center py-12">
                                        <RefreshCw className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-2" />
                                        <p className="text-gray-500">Searching...</p>
                                    </div>
                                ) : searchResults.results?.length === 0 ? (
                                    <div className="text-center py-12">
                                        <Search className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No results found</h3>
                                        <p className="text-gray-500">Try searching with a different term</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {searchResults.results?.map((result: any, index: number) => (
                                            <Card key={index} className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <Badge variant="outline">{result.type}</Badge>
                                                            {result.id && (
                                                                <span className="text-sm font-mono text-gray-600">
                                                                    {result.id.slice(0, 16)}...
                                                                </span>
                                                            )}
                                                        </div>
                                                        {result.description && (
                                                            <p className="text-sm text-gray-700 mb-2">{result.description}</p>
                                                        )}
                                                        {result.metadata && (
                                                            <div className="flex gap-4 text-xs text-gray-500">
                                                                {Object.entries(result.metadata).map(([key, value]) => (
                                                                    <span key={key}>
                                                                        <strong>{key}:</strong> {String(value)}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            if (result.type === 'session') {
                                                                window.location.href = `/explorer/session/${result.id}`;
                                                            } else if (result.type === 'transaction') {
                                                                window.open(`https://explorer.cronos.org/testnet/tx/${result.id}`, '_blank');
                                                            }
                                                        }}
                                                    >
                                                        View
                                                    </Button>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <AnimatePresence mode="wait">
                                {activeTab === 'sessions' && (
                                    <motion.div
                                        key="sessions"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="p-4"
                                    >
                                        <DataTable
                                            columns={sessionColumns}
                                            data={sessions}
                                            isLoading={loading}
                                            emptyMessage="No escrow sessions found."
                                            onRowClick={(row) => window.location.href = `/explorer/session/${row.original.sessionId}`}
                                        />
                                    </motion.div>
                                )}

                                {activeTab === 'transactions' && (
                                    <motion.div
                                        key="transactions"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="p-4"
                                    >
                                        <DataTable
                                            columns={transactionColumns}
                                            data={transactions}
                                            isLoading={loading}
                                            emptyMessage="No transactions found."
                                            onRowClick={(row) => window.open(`https://explorer.cronos.org/testnet/tx/${row.original.txHash}`, '_blank')}
                                        />
                                    </motion.div>
                                )}

                                {activeTab === 'agents' && (
                                    <motion.div
                                        key="agents"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="p-4"
                                    >
                                        <DataTable
                                            columns={agentColumns}
                                            data={agents}
                                            isLoading={loading}
                                            emptyMessage="No agents registered."
                                            onRowClick={(row) => navigate(`/marketplace/services/${row.original.agentId}`)}
                                        />
                                    </motion.div>
                                )}

                                {activeTab === 'payments' && (
                                    <motion.div
                                        key="payments"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="p-4"
                                    >
                                        <DataTable
                                            columns={paymentColumns}
                                            data={payments}
                                            isLoading={loading}
                                            emptyMessage="No x402 payments recorded."
                                            onRowClick={async (row) => {
                                                setSelectedPayment(row.original);
                                                setPaymentDetailLoading(true);
                                                try {
                                                    const apiUrl = import.meta.env.VITE_API_URL || '';
                                                    const response = await fetch(`${apiUrl}/api/payments/${row.original.paymentId}`);
                                                    if (response.ok) {
                                                        const fullPayment = await response.json();
                                                        setSelectedPayment({
                                                            ...row.original,
                                                            txHash: fullPayment.tx_hash,
                                                            resourceUrl: fullPayment.resource_url,
                                                            tokenAddress: fullPayment.token_address
                                                        });
                                                    }
                                                } catch (error) {
                                                    console.error('Failed to fetch payment details:', error);
                                                } finally {
                                                    setPaymentDetailLoading(false);
                                                }
                                            }}
                                        />
                                    </motion.div>
                                )}

                                {activeTab === 'system' && (
                                    <motion.div
                                        key="system"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="p-6 space-y-6"
                                    >
                                        {/* Refresh Button */}
                                        <div className="flex justify-end">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={fetchSystemData}
                                                disabled={systemLoading}
                                                className="gap-2"
                                            >
                                                <RefreshCw className={`h-4 w-4 ${systemLoading ? 'animate-spin' : ''}`} />
                                                Refresh
                                            </Button>
                                        </div>

                                        {systemLoading && !health && !sysMetrics ? (
                                            <div className="text-center py-12">
                                                <RefreshCw className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-2" />
                                                <p className="text-gray-500">Loading system data...</p>
                                            </div>
                                        ) : !health && !sysMetrics && !traces.length && !alerts.length ? (
                                            <div className="text-center py-12">
                                                <Activity className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                                                <h3 className="text-lg font-semibold text-gray-900 mb-2">System Monitoring</h3>
                                                <p className="text-gray-500">System health data will appear here when available</p>
                                            </div>
                                        ) : null}

                                        {health && (
                                            <div className={`p-4 rounded-lg border ${health.status === 'healthy'
                                                ? 'bg-green-500/10 border-green-500/20'
                                                : health.status === 'degraded'
                                                    ? 'bg-yellow-500/10 border-yellow-500/20'
                                                    : 'bg-red-500/10 border-red-500/20'
                                                }`}>
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-3">
                                                        {health.status === 'healthy' ? (
                                                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                                                        ) : health.status === 'degraded' ? (
                                                            <AlertTriangle className="h-5 w-5 text-yellow-500" />
                                                        ) : (
                                                            <XCircle className="h-5 w-5 text-red-500" />
                                                        )}
                                                        <span className="font-medium capitalize">{health.status}</span>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                        <span>v{health.version}</span>
                                                        <span>Uptime: {formatUptime(health.uptime)}</span>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-3 gap-4">
                                                    {health.checks.map((check) => (
                                                        <div key={check.name} className="flex items-center gap-2">
                                                            {check.status === 'pass' ? (
                                                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                            ) : check.status === 'warn' ? (
                                                                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                                            ) : (
                                                                <XCircle className="h-4 w-4 text-red-500" />
                                                            )}
                                                            <span className="text-sm">{check.name}</span>
                                                            <span className="text-xs text-muted-foreground ml-auto">
                                                                {check.latencyMs}ms
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {sysMetrics && (
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                <Card className="p-4">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Globe className="h-4 w-4 text-muted-foreground" />
                                                        <span className="text-sm text-muted-foreground">Requests</span>
                                                    </div>
                                                    <div className="text-2xl font-bold">{(sysMetrics.requestsTotal || 0).toLocaleString()}</div>
                                                    <Sparkline
                                                        data={sysMetrics.requestsPerMinute || []}
                                                        color="#3b82f6"
                                                        className="mt-2"
                                                    />
                                                </Card>
                                                <Card className="p-4">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                                                        <span className="text-sm text-muted-foreground">Success Rate</span>
                                                    </div>
                                                    <div className="text-2xl font-bold">
                                                        {(sysMetrics.requestsTotal || 0) > 0
                                                            ? (((sysMetrics.requestsSuccessful || sysMetrics.requestsSuccess || 0) / sysMetrics.requestsTotal) * 100).toFixed(1)
                                                            : 100}%
                                                    </div>
                                                </Card>
                                                <Card className="p-4">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Timer className="h-4 w-4 text-muted-foreground" />
                                                        <span className="text-sm text-muted-foreground">Avg Latency</span>
                                                    </div>
                                                    <div className="text-2xl font-bold">{(sysMetrics.averageLatencyMs || sysMetrics.avgLatencyMs || 0).toFixed(0)}ms</div>
                                                </Card>
                                                <Card className="p-4">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Database className="h-4 w-4 text-muted-foreground" />
                                                        <span className="text-sm text-muted-foreground">Memory</span>
                                                    </div>
                                                    <div className="text-2xl font-bold">{(sysMetrics.memoryUsageMb || 0).toFixed(0)} MB</div>
                                                </Card>
                                            </div>
                                        )}

                                        <div className="grid md:grid-cols-2 gap-6">
                                            <Card>
                                                <CardHeader className="pb-2">
                                                    <CardTitle className="text-sm font-medium">Recent Traces</CardTitle>
                                                </CardHeader>
                                                <CardContent className="space-y-2">
                                                    {traces.length === 0 ? (
                                                        <p className="text-sm text-muted-foreground">No recent traces</p>
                                                    ) : (
                                                        traces.slice(0, 5).map((trace) => (
                                                            <div key={trace.traceId} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                                                                <div className="flex items-center gap-2">
                                                                    <Badge variant="outline" className="text-xs">
                                                                        {trace.method}
                                                                    </Badge>
                                                                    <span className="text-sm font-mono truncate max-w-[200px]">
                                                                        {trace.path}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                                    <StatusBadge status={trace.statusCode < 400 ? 'success' : 'failed'} />
                                                                    <span>{trace.durationMs}ms</span>
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </CardContent>
                                            </Card>

                                            <Card>
                                                <CardHeader className="pb-2">
                                                    <CardTitle className="text-sm font-medium">Recent Alerts</CardTitle>
                                                </CardHeader>
                                                <CardContent className="space-y-2">
                                                    {alerts.length === 0 ? (
                                                        <p className="text-sm text-muted-foreground">No active alerts</p>
                                                    ) : (
                                                        alerts.slice(0, 5).map((alert) => (
                                                            <div key={alert.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                                                                <div className="flex items-center gap-2">
                                                                    {alert.level === 'error' || alert.level === 'critical' ? (
                                                                        <XCircle className="h-4 w-4 text-red-500" />
                                                                    ) : alert.level === 'warning' ? (
                                                                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                                                    ) : (
                                                                        <Activity className="h-4 w-4 text-blue-500" />
                                                                    )}
                                                                    <span className="text-sm truncate max-w-[200px]">
                                                                        {alert.message}
                                                                    </span>
                                                                </div>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {formatTimeAgo(alert.timestamp)}
                                                                </span>
                                                            </div>
                                                        ))
                                                    )}
                                                </CardContent>
                                            </Card>
                                        </div>

                                        {/* Connections Status */}
                                        {connections.length > 0 && (
                                            <Card>
                                                <CardHeader className="pb-2">
                                                    <CardTitle className="text-sm font-medium">Connection Status</CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                        {connections.map((conn) => (
                                                            <div key={conn.name} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                                                {conn.status === 'connected' ? (
                                                                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                                                                ) : (
                                                                    <XCircle className="h-5 w-5 text-red-500" />
                                                                )}
                                                                <div>
                                                                    <div className="font-medium text-sm">{conn.name}</div>
                                                                    <div className="text-xs text-muted-foreground">
                                                                        {conn.status === 'connected' ? (
                                                                            conn.latestBlock ? `Block #${conn.latestBlock.toLocaleString()}` :
                                                                                conn.latencyMs ? `${conn.latencyMs}ms` : 'Connected'
                                                                        ) : (
                                                                            conn.error || 'Disconnected'
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        )}

                                        {/* Indexer Status */}
                                        {indexers.length > 0 && (
                                            <Card>
                                                <CardHeader className="pb-2">
                                                    <CardTitle className="text-sm font-medium">Indexer Status</CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-sm">
                                                            <thead>
                                                                <tr className="border-b">
                                                                    <th className="text-left py-2 text-muted-foreground font-medium">Indexer</th>
                                                                    <th className="text-left py-2 text-muted-foreground font-medium">Schedule</th>
                                                                    <th className="text-left py-2 text-muted-foreground font-medium">Last Block</th>
                                                                    <th className="text-left py-2 text-muted-foreground font-medium">Last Run</th>
                                                                    <th className="text-left py-2 text-muted-foreground font-medium">Status</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {indexers.map((indexer) => (
                                                                    <tr key={indexer.name} className="border-b last:border-0">
                                                                        <td className="py-2 font-medium">{indexer.name}</td>
                                                                        <td className="py-2 text-muted-foreground">{indexer.schedule}</td>
                                                                        <td className="py-2 font-mono">
                                                                            {indexer.lastBlock > 0 ? indexer.lastBlock.toLocaleString() : '-'}
                                                                        </td>
                                                                        <td className="py-2 text-muted-foreground">
                                                                            {indexer.lastRun ? formatTimeAgo(indexer.lastRun) : 'Never'}
                                                                        </td>
                                                                        <td className="py-2">
                                                                            <StatusBadge status={indexer.status} />
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        )}
                    </div>
                </div>
            </div>

            {selectedPayment && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                    onClick={() => setSelectedPayment(null)}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 bg-white">
                            <h2 className="text-xl font-bold text-gray-900">Payment Details</h2>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedPayment(null)}
                                className="h-8 w-8 p-0"
                            >
                                <XCircle className="h-5 w-5" />
                            </Button>
                        </div>

                        <div className="p-6 space-y-6">
                            {paymentDetailLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Payment ID</label>
                                            <p className="mt-1 font-mono text-sm break-all">{selectedPayment.paymentId}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</label>
                                            <div className="mt-1">
                                                <StatusBadge status={selectedPayment.status} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">From</label>
                                            <div className="mt-1">
                                                <Address address={selectedPayment.from} />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">To</label>
                                            <div className="mt-1">
                                                <Address address={selectedPayment.to} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</label>
                                            <p className="mt-1 text-2xl font-bold text-gray-900">
                                                {formatCurrency(selectedPayment.amount)}
                                            </p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Timestamp</label>
                                            <p className="mt-1 text-sm text-gray-700">
                                                {new Date(selectedPayment.timestamp).toLocaleString()}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {formatTimeAgo(selectedPayment.timestamp)}
                                            </p>
                                        </div>
                                    </div>

                                    {selectedPayment.txHash && (
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Transaction Hash</label>
                                            <div className="mt-1">
                                                <TxHash hash={selectedPayment.txHash} />
                                            </div>
                                        </div>
                                    )}

                                    {selectedPayment.resourceUrl && (
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Resource URL</label>
                                            <p className="mt-1 text-sm text-blue-600 break-all hover:underline">
                                                <a
                                                    href={selectedPayment.resourceUrl.startsWith('http')
                                                        ? selectedPayment.resourceUrl
                                                        : `${window.location.origin}${selectedPayment.resourceUrl}`
                                                    }
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    {selectedPayment.resourceUrl.startsWith('http')
                                                        ? selectedPayment.resourceUrl
                                                        : `${window.location.origin}${selectedPayment.resourceUrl}`
                                                    }
                                                </a>
                                            </p>
                                        </div>
                                    )}

                                    {selectedPayment.tokenAddress && (
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Token Address</label>
                                            <div className="mt-1">
                                                <Address address={selectedPayment.tokenAddress} />
                                            </div>
                                        </div>
                                    )}

                                    {selectedPayment.txHash && (
                                        <div className="pt-4 border-t border-gray-200">
                                            <Button
                                                onClick={() => window.open(`https://explorer.cronos.org/testnet/tx/${selectedPayment.txHash}`, '_blank')}
                                                className="w-full gap-2"
                                            >
                                                View on Cronos Explorer
                                                <Activity className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}

export default Explorer;
