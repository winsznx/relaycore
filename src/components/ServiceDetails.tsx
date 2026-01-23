import { useState, useEffect } from 'react';
import {
    ArrowLeft,
    Star,
    Clock,
    TrendingUp,
    ExternalLink,
    Copy,
    Check,
    Activity,
    GitBranch,
    Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ServiceDetailsProps {
    serviceId: string;
    onBack: () => void;
    onCallService?: (service: ServiceDetail) => void;
}

interface ServiceDetail {
    id: string;
    name: string;
    description?: string;
    category?: string;
    endpointUrl: string;
    pricePerCall?: string;
    ownerAddress: string;
    reputationScore: number;
    successRate: number;
    avgLatencyMs: number;
    totalPayments?: number;
    trend?: 'improving' | 'stable' | 'declining';
    dependencies?: Array<{ serviceId: string; serviceName?: string; callCount: number }>;
    dependents?: Array<{ serviceId: string; serviceName?: string; callCount: number }>;
    schema?: {
        inputType?: string;
        outputType?: string;
        inputSchema?: Record<string, unknown>;
        outputSchema?: Record<string, unknown>;
        tags?: string[];
        capabilities?: string[];
    };
}

interface MetricsPoint {
    timestamp: string;
    value: number;
}

interface PaymentRecord {
    paymentId: string;
    txHash: string;
    from: string;
    to: string;
    amount: string;
    tokenAddress: string;
    resourceUrl: string;
    status: string;
    timestamp: string;
}

export function ServiceDetails({ serviceId, onBack, onCallService }: ServiceDetailsProps) {
    const [service, setService] = useState<ServiceDetail | null>(null);
    const [metrics, setMetrics] = useState<MetricsPoint[]>([]);
    const [payments, setPayments] = useState<PaymentRecord[]>([]);
    const [paymentsLoading, setPaymentsLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'schema' | 'graph' | 'transactions'>('overview');

    useEffect(() => {
        fetchServiceDetails();
    }, [serviceId]);

    const fetchServiceDetails = async () => {
        setLoading(true);
        try {
            const [serviceRes, metricsRes] = await Promise.all([
                fetch(`/api/services/${serviceId}`),
                fetch(`/api/services/${serviceId}/metrics?from=${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()}`)
            ]);

            if (serviceRes.ok) {
                const data = await serviceRes.json();
                setService(data);
            }

            if (metricsRes.ok) {
                const metricsData = await metricsRes.json();
                setMetrics(metricsData.data || []);
            }
        } catch (error) {
            console.error('Failed to fetch service details:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchPayments = async () => {
        setPaymentsLoading(true);
        try {
            const response = await fetch(`/api/services/${serviceId}/payments?limit=20`);
            if (response.ok) {
                const data = await response.json();
                setPayments(data.payments || []);
            }
        } catch (error) {
            console.error('Failed to fetch payments:', error);
        } finally {
            setPaymentsLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'transactions') {
            fetchPayments();
        }
    }, [activeTab, serviceId]);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const getTrendBadge = (trend?: string) => {
        switch (trend) {
            case 'improving':
                return <Badge className="bg-green-500">↑ Improving</Badge>;
            case 'declining':
                return <Badge variant="destructive">↓ Declining</Badge>;
            default:
                return <Badge variant="outline">→ Stable</Badge>;
        }
    };

    const getReputationColor = (score: number) => {
        if (score >= 90) return 'text-green-600';
        if (score >= 70) return 'text-blue-600';
        if (score >= 50) return 'text-yellow-600';
        return 'text-red-600';
    };

    if (loading) {
        return (
            <div className="space-y-6 max-w-5xl mx-auto px-4 md:px-6 py-4 animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-1/3" />
                <div className="h-24 bg-gray-200 rounded" />
                <div className="grid grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-gray-200 rounded" />)}
                </div>
            </div>
        );
    }

    if (!service) {
        return (
            <div className="space-y-6 max-w-5xl mx-auto px-4 md:px-6 text-center py-16">
                <p className="text-gray-500 text-lg mb-4">Service not found</p>
                <Button onClick={onBack} variant="outline" size="sm">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Marketplace
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto px-4 md:px-6 py-4">
            {/* Back Button */}
            <button
                onClick={onBack}
                className="text-gray-500 hover:text-gray-700 flex items-center gap-2 text-sm"
            >
                <ArrowLeft className="w-4 h-4" />
                Back to Marketplace
            </button>

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="text-2xl md:text-3xl font-bold text-[#111111]">{service.name}</h1>
                        {getTrendBadge(service.trend)}
                    </div>
                    <p className="text-gray-500 mt-2 max-w-2xl text-sm md:text-base">
                        {service.description || 'No description available'}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-4">
                        <Badge variant="outline">{service.category || 'Uncategorized'}</Badge>
                        {service.schema?.tags?.map(tag => (
                            <Badge key={tag} className="bg-blue-100 text-blue-700">
                                {tag}
                            </Badge>
                        ))}
                    </div>
                </div>

                <div className="text-left md:text-right flex-shrink-0 w-full md:w-auto">
                    <div className="flex items-center md:flex-col md:items-end gap-2 md:gap-0">
                        <div className="text-2xl md:text-3xl font-bold text-[#111111]">
                            ${parseFloat(service.pricePerCall || '0').toFixed(2)}
                        </div>
                        <span className="text-gray-500 text-sm">per call</span>
                    </div>
                    <Button
                        onClick={() => onCallService?.(service)}
                        className="mt-3 bg-[#111111] hover:bg-[#333333] w-full md:w-auto"
                        size="default"
                    >
                        <Zap className="w-4 h-4 mr-2" />
                        Call Service
                    </Button>
                </div>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Star className={`w-5 h-5 ${getReputationColor(service.reputationScore)}`} />
                            <span className="text-sm text-gray-500">Reputation</span>
                        </div>
                        <div className={`text-2xl font-bold ${getReputationColor(service.reputationScore)}`}>
                            {service.reputationScore?.toFixed(0) || '0'}
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-5 h-5 text-green-600" />
                            <span className="text-sm text-gray-500">Success Rate</span>
                        </div>
                        <div className="text-2xl font-bold text-green-600">
                            {service.successRate?.toFixed(1) || 0}%
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-5 h-5 text-blue-600" />
                            <span className="text-sm text-gray-500">Avg Latency</span>
                        </div>
                        <div className="text-2xl font-bold text-blue-600">
                            {service.avgLatencyMs || 0}ms
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Activity className="w-5 h-5 text-purple-600" />
                            <span className="text-sm text-gray-500">Total Calls</span>
                        </div>
                        <div className="text-2xl font-bold text-purple-600">
                            {service.totalPayments?.toString() || '0'}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-gray-200">
                {(['overview', 'schema', 'graph', 'transactions'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${activeTab === tab
                            ? 'text-[#111111] border-b-2 border-[#111111]'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
                <div className="space-y-4">
                    {/* Endpoint */}
                    <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                        <CardHeader>
                            <CardTitle>Endpoint</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
                                <code className="text-sm text-gray-700 overflow-x-auto">
                                    {service.endpointUrl}
                                </code>
                                <button
                                    onClick={() => copyToClipboard(service.endpointUrl)}
                                    className="ml-4 p-2 text-gray-400 hover:text-gray-600"
                                >
                                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                </button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Provider */}
                    <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                        <CardHeader>
                            <CardTitle>Provider</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <code className="text-sm text-gray-700">
                                    {service.ownerAddress}
                                </code>
                                <a
                                    href={`https://cronoscan.com/address/${service.ownerAddress}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-blue-600 hover:text-blue-500 text-sm"
                                >
                                    View on Explorer
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Performance History */}
                    <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                        <CardHeader>
                            <CardTitle>Performance History (7 days)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {metrics.length > 0 ? (
                                <div className="h-40 relative">
                                    <div className="flex items-end gap-1 h-full">
                                        {metrics.slice(0, 24).map((point, i) => {
                                            const maxValue = Math.max(...metrics.slice(0, 24).map(m => m.value), 1);
                                            const heightPercent = (point.value / maxValue) * 100;
                                            return (
                                                <div
                                                    key={i}
                                                    className="flex-1 bg-blue-400 rounded-t hover:bg-blue-600 transition-colors cursor-pointer group relative"
                                                    style={{ height: `${Math.max(10, heightPercent)}%` }}
                                                >
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                                                        <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
                                                            <div className="font-semibold">{point.value.toFixed(1)}%</div>
                                                            <div className="text-gray-400">
                                                                {new Date(point.timestamp).toLocaleDateString(undefined, {
                                                                    month: 'short',
                                                                    day: 'numeric',
                                                                    hour: '2-digit',
                                                                    minute: '2-digit'
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-400 mt-2">
                                        <span>7 days ago</span>
                                        <span>Now</span>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-gray-400 text-center py-8">No metrics data available</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {activeTab === 'schema' && (
                <div className="space-y-4">
                    {service.schema?.inputType && (
                        <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                            <CardHeader>
                                <CardTitle>Input Type</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <code className="text-blue-600 font-medium">{service.schema.inputType}</code>
                                {service.schema.inputSchema && (
                                    <pre className="mt-4 bg-gray-50 rounded-lg p-4 text-sm text-gray-700 overflow-x-auto">
                                        {JSON.stringify(service.schema.inputSchema, null, 2)}
                                    </pre>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {service.schema?.outputType && (
                        <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                            <CardHeader>
                                <CardTitle>Output Type</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <code className="text-green-600 font-medium">{service.schema.outputType}</code>
                                {service.schema.outputSchema && (
                                    <pre className="mt-4 bg-gray-50 rounded-lg p-4 text-sm text-gray-700 overflow-x-auto">
                                        {JSON.stringify(service.schema.outputSchema, null, 2)}
                                    </pre>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {service.schema?.capabilities && service.schema.capabilities.length > 0 && (
                        <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                            <CardHeader>
                                <CardTitle>Capabilities</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-2">
                                    {service.schema.capabilities.map(cap => (
                                        <Badge key={cap} className="bg-purple-100 text-purple-700">
                                            {cap}
                                        </Badge>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {!service.schema?.inputType && !service.schema?.outputType && (
                        <p className="text-gray-400 text-center py-8">No schema information available</p>
                    )}
                </div>
            )}

            {activeTab === 'graph' && (
                <div className="space-y-4">
                    {/* Dependencies */}
                    <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <GitBranch className="w-5 h-5" />
                                Dependencies
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {service.dependencies && service.dependencies.length > 0 ? (
                                <div className="space-y-2">
                                    {service.dependencies.map((dep, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                                        >
                                            <span className="text-gray-700">{dep.serviceName || dep.serviceId}</span>
                                            <span className="text-sm text-gray-500">{dep.callCount} calls</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-gray-400">No dependencies</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Dependents */}
                    <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <GitBranch className="w-5 h-5 rotate-180" />
                                Used By
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {service.dependents && service.dependents.length > 0 ? (
                                <div className="space-y-2">
                                    {service.dependents.map((dep, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                                        >
                                            <span className="text-gray-700">{dep.serviceName || dep.serviceId}</span>
                                            <span className="text-sm text-gray-500">{dep.callCount} calls</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-gray-400">No dependents</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {activeTab === 'transactions' && (
                <div className="space-y-4">
                    <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                        <CardHeader>
                            <CardTitle>Payment History</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {paymentsLoading ? (
                                <p className="text-gray-400 text-center py-8">Loading payments...</p>
                            ) : payments.length > 0 ? (
                                <div className="space-y-2">
                                    {payments.map((payment) => (
                                        <div
                                            key={payment.paymentId}
                                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                        >
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Badge variant={payment.status === 'completed' ? 'default' : 'outline'}>
                                                        {payment.status}
                                                    </Badge>
                                                    <code className="text-xs text-gray-600">
                                                        {payment.from.slice(0, 6)}...{payment.from.slice(-4)}
                                                    </code>
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    {new Date(payment.timestamp).toLocaleString()}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-semibold text-gray-900">
                                                    ${(parseFloat(payment.amount) / 1e6).toFixed(2)}
                                                </div>
                                                <a
                                                    href={`https://explorer.cronos.org/testnet/tx/${payment.txHash}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-blue-600 hover:text-blue-500 flex items-center gap-1"
                                                >
                                                    View TX
                                                    <ExternalLink className="w-3 h-3" />
                                                </a>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-gray-400 text-center py-8">No payment history</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}

export default ServiceDetails;
