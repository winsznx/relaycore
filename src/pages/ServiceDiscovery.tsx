import { useState, useMemo, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Search, CheckCircle2, XCircle, AlertTriangle, ExternalLink,
    Clock, Shield, Activity,
    Plus, Package, ShoppingCart, CreditCard, Settings,
    Eye, BarChart3, Layers
} from 'lucide-react';
import { AsyncBoundary, SkeletonCard } from '@/components/ui/states';
import { useServices } from '@/lib/hooks';
import { useAccount } from 'wagmi';
import { supabase } from '@/lib/supabase';

/**
 * My Services Dashboard
 * 
 * Shows the user's personal services:
 * - Services they own/created
 * - Services they've purchased/subscribed to
 * - Services they've paid for/used
 * 
 * For discovering ALL services, use /marketplace
 */

// Tab types for filtering user's services
type ServiceTab = 'owned' | 'purchased' | 'used';

interface ServiceData {
    id: string;
    name: string;
    description?: string;
    category?: string;
    pricePerCall?: string;
    endpointUrl?: string;
    ownerAddress?: string;
    reputation?: {
        reputationScore: number;
        avgLatencyMs?: number;
        totalPayments?: number;
        successRate?: number;
        uniquePayers?: number;
    };
    health?: {
        reliable: boolean;
        status?: string;
        warning?: string;
        lastTestedAt?: string;
    };
}

export function ServiceDiscovery() {
    const { address, isConnected } = useAccount();
    const [activeTab, setActiveTab] = useState<ServiceTab>('owned');
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredServices, setFilteredServices] = useState<ServiceData[]>([]);
    const navigate = useNavigate();

    // Fetch all services
    const { data: allServices, isLoading, error } = useServices();

    // Filter services based on active tab
    useEffect(() => {
        const filterServices = async () => {
            if (!allServices) {
                setFilteredServices([]);
                return;
            }
            const services = allServices as ServiceData[];

            let result: ServiceData[] = [];

            switch (activeTab) {
                case 'owned':
                    // Services created by this user
                    result = services.filter(s =>
                        s.ownerAddress?.toLowerCase() === address?.toLowerCase()
                    );
                    break;
                case 'purchased':
                    // Query payments table for services user has paid for
                    if (address) {
                        const { data: payments } = await supabase
                            .from('payments')
                            .select('to_address')
                            .eq('from_address', address.toLowerCase())
                            .eq('status', 'settled');

                        const serviceOwners = new Set(payments?.map(p => p.to_address) || []);
                        result = services.filter(s =>
                            s.ownerAddress && serviceOwners.has(s.ownerAddress.toLowerCase())
                        );
                    } else {
                        result = [];
                    }
                    break;
                case 'used':
                    // Query outcomes table for services this user has invoked
                    if (address) {
                        const { data: outcomes } = await supabase
                            .from('outcomes')
                            .select('payment_id')
                            .limit(100);

                        if (outcomes && outcomes.length > 0) {
                            const paymentIds = outcomes.map(o => o.payment_id);
                            const { data: payments } = await supabase
                                .from('payments')
                                .select('to_address')
                                .eq('from_address', address.toLowerCase())
                                .in('payment_id', paymentIds);

                            const serviceOwners = new Set(payments?.map(p => p.to_address) || []);
                            result = services.filter(s =>
                                s.ownerAddress && serviceOwners.has(s.ownerAddress.toLowerCase())
                            );
                        } else {
                            result = [];
                        }
                    } else {
                        result = [];
                    }
                    break;
            }

            // Apply search filter
            if (searchQuery) {
                result = result.filter(s =>
                    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    s.description?.toLowerCase().includes(searchQuery.toLowerCase())
                );
            }

            setFilteredServices(result);
        };

        filterServices();
    }, [allServices, activeTab, searchQuery, address]);

    // Calculate stats for header (non-async version)
    const stats = useMemo(() => {
        if (!allServices) return { owned: 0, purchased: 0, used: 0, totalEarnings: 0 };
        const services = allServices as ServiceData[];

        const owned = services.filter(s =>
            s.ownerAddress?.toLowerCase() === address?.toLowerCase()
        );

        const totalEarnings = owned.reduce((sum, s) => {
            return sum + (s.reputation?.totalPayments || 0) * parseFloat(s.pricePerCall || '0');
        }, 0);

        return {
            owned: owned.length,
            purchased: 0, // Will be updated by async effect
            used: 0, // Will be updated by async effect
            totalEarnings
        };
    }, [allServices, address]);

    const tabs = [
        { id: 'owned' as ServiceTab, label: 'My Services', icon: Package, count: stats.owned },
        { id: 'purchased' as ServiceTab, label: 'Purchased', icon: ShoppingCart, count: stats.purchased },
        { id: 'used' as ServiceTab, label: 'Recently Used', icon: Activity, count: stats.used },
    ];

    if (!isConnected) {
        return (
            <div className="max-w-7xl mx-auto space-y-6">
                <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                    <CardContent className="p-16 text-center">
                        <Shield className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-gray-900">Connect Wallet</h2>
                        <p className="text-gray-500 mt-2 max-w-md mx-auto">
                            Connect your wallet to view your services, purchases, and usage history.
                        </p>
                        <div className="mt-6 flex gap-4 justify-center">
                            <Button className="bg-[#111111] hover:bg-gray-800">
                                Connect Wallet
                            </Button>
                            <Button variant="outline" onClick={() => navigate('/marketplace')}>
                                Browse Marketplace
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-[#111111]">My Services</h1>
                    <p className="text-gray-500 mt-1">
                        Manage your services, subscriptions, and usage.
                        <Link to="/marketplace" className="text-blue-600 hover:underline ml-1">
                            Browse all services →
                        </Link>
                    </p>
                </div>
                <Button
                    onClick={() => navigate('/dashboard/services/register')}
                    className="bg-[#111111] hover:bg-[#333333]"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Register New Service
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 bg-blue-50 rounded-lg">
                            <Package className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{stats.owned}</div>
                            <div className="text-sm text-gray-500">Services Owned</div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 bg-purple-50 rounded-lg">
                            <ShoppingCart className="h-6 w-6 text-purple-600" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{stats.purchased}</div>
                            <div className="text-sm text-gray-500">Subscriptions</div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 bg-green-50 rounded-lg">
                            <CreditCard className="h-6 w-6 text-green-600" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">${stats.totalEarnings.toFixed(2)}</div>
                            <div className="text-sm text-gray-500">Total Earnings</div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 bg-amber-50 rounded-lg">
                            <Activity className="h-6 w-6 text-amber-600" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{stats.used}</div>
                            <div className="text-sm text-gray-500">Services Used</div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs & Search */}
            <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                        {/* Tabs */}
                        <div className="flex gap-2">
                            {tabs.map(tab => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${isActive
                                            ? 'bg-[#111111] text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                    >
                                        <Icon className="h-4 w-4" />
                                        {tab.label}
                                        <Badge
                                            variant="secondary"
                                            className={isActive ? 'bg-white/20 text-white' : 'bg-gray-200'}
                                        >
                                            {tab.count}
                                        </Badge>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Search */}
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Services List */}
            <AsyncBoundary
                isLoading={isLoading}
                isError={!!error}
                error={error}
                data={filteredServices}
                loadingFallback={
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[1, 2, 3, 4].map((i) => (
                            <SkeletonCard key={i} />
                        ))}
                    </div>
                }
                emptyFallback={
                    <EmptyStateForTab tab={activeTab} onAction={() => {
                        if (activeTab === 'owned') {
                            navigate('/dashboard/services/register');
                        } else {
                            navigate('/marketplace');
                        }
                    }} />
                }
            >
                {(services) => (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {services.map((service: ServiceData) => (
                            <MyServiceCard
                                key={service.id}
                                service={service}
                                isOwner={service.ownerAddress?.toLowerCase() === address?.toLowerCase()}
                            />
                        ))}
                    </div>
                )}
            </AsyncBoundary>

            {/* Quick Actions */}
            <Card className="border-0 shadow-sm ring-1 ring-gray-100 bg-gradient-to-r from-gray-50 to-white">
                <CardContent className="p-6">
                    <h3 className="font-semibold text-lg mb-4">Quick Actions</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Button
                            variant="outline"
                            className="justify-start h-auto py-4"
                            onClick={() => navigate('/marketplace')}
                        >
                            <Layers className="h-5 w-5 mr-3 text-blue-600" />
                            <div className="text-left">
                                <div className="font-medium">Browse Marketplace</div>
                                <div className="text-xs text-gray-500">Discover new services</div>
                            </div>
                        </Button>
                        <Button
                            variant="outline"
                            className="justify-start h-auto py-4"
                            onClick={() => navigate('/dashboard/services/register')}
                        >
                            <Plus className="h-5 w-5 mr-3 text-green-600" />
                            <div className="text-left">
                                <div className="font-medium">Register Service</div>
                                <div className="text-xs text-gray-500">List your own service</div>
                            </div>
                        </Button>
                        <Button
                            variant="outline"
                            className="justify-start h-auto py-4"
                            onClick={() => window.location.href = 'https://docs.relaycore.xyz'}
                        >
                            <BarChart3 className="h-5 w-5 mr-3 text-purple-600" />
                            <div className="text-left">
                                <div className="font-medium">View Analytics</div>
                                <div className="text-xs text-gray-500">Track performance</div>
                            </div>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

interface EmptyStateForTabProps {
    tab: ServiceTab;
    onAction: () => void;
}

function EmptyStateForTab({ tab, onAction }: EmptyStateForTabProps) {
    const states = {
        owned: {
            icon: Package,
            title: "No services yet",
            description: "You haven't registered any services. Start earning by listing your first service.",
            actionLabel: "Register Service"
        },
        purchased: {
            icon: ShoppingCart,
            title: "No subscriptions",
            description: "You haven't subscribed to any services yet. Browse the marketplace to find useful services.",
            actionLabel: "Browse Marketplace"
        },
        used: {
            icon: Activity,
            title: "No usage history",
            description: "You haven't used any services yet. Explore the marketplace to get started.",
            actionLabel: "Browse Marketplace"
        }
    };

    const state = states[tab];
    const Icon = state.icon;

    return (
        <Card className="border-0 shadow-sm ring-1 ring-gray-100">
            <CardContent className="p-16 text-center">
                <Icon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900">{state.title}</h3>
                <p className="text-gray-500 mt-2 max-w-md mx-auto">{state.description}</p>
                <Button onClick={onAction} className="mt-6 bg-[#111111] hover:bg-gray-800">
                    {state.actionLabel}
                </Button>
            </CardContent>
        </Card>
    );
}

interface MyServiceCardProps {
    service: ServiceData;
    isOwner: boolean;
}

function MyServiceCard({ service, isOwner }: MyServiceCardProps) {
    const navigate = useNavigate();

    const getHealthIcon = () => {
        if (!service.health) return <Clock className="h-5 w-5 text-gray-400" />;

        switch (service.health.status) {
            case 'WORKING':
                return <CheckCircle2 className="h-5 w-5 text-green-500" />;
            case 'FAILING':
                return <XCircle className="h-5 w-5 text-red-500" />;
            case 'FLAKY':
                return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
            default:
                return <Clock className="h-5 w-5 text-gray-400" />;
        }
    };

    const getReputationColor = (score: number) => {
        if (score >= 90) return 'text-green-600';
        if (score >= 70) return 'text-blue-600';
        if (score >= 50) return 'text-yellow-600';
        return 'text-red-600';
    };

    const reputationScore = service.reputation?.reputationScore || 0;

    return (
        <Card className="border-0 shadow-sm ring-1 ring-gray-100 hover:ring-2 hover:ring-[#111111] transition-all">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">{service.name}</CardTitle>
                            {isOwner && (
                                <Badge className="bg-blue-100 text-blue-700 text-xs">Owner</Badge>
                            )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                            {service.description || 'No description provided'}
                        </p>
                    </div>
                    {getHealthIcon()}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Reputation Score */}
                <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Reputation Score</span>
                    <span className={`text-2xl font-bold ${getReputationColor(reputationScore)}`}>
                        {reputationScore.toFixed(1)}
                    </span>
                </div>

                {/* Metrics Grid */}
                {service.reputation && (
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                        <div>
                            <div className="text-xs text-gray-500">Total Calls</div>
                            <div className="text-lg font-semibold">
                                {service.reputation.totalPayments?.toLocaleString() || 0}
                            </div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-500">Success Rate</div>
                            <div className="text-lg font-semibold text-green-600">
                                {service.reputation.successRate?.toFixed(1) || '—'}%
                            </div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-500">Avg Latency</div>
                            <div className="text-lg font-semibold">
                                {service.reputation.avgLatencyMs || '—'}ms
                            </div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-500">
                                {isOwner ? 'Revenue' : 'Price/Call'}
                            </div>
                            <div className="text-lg font-semibold">
                                ${isOwner
                                    ? ((service.reputation.totalPayments || 0) * parseFloat(service.pricePerCall || '0')).toFixed(2)
                                    : service.pricePerCall || '0'
                                }
                            </div>
                        </div>
                    </div>
                )}

                {/* Health Status */}
                {service.health && (
                    <div className="pt-4 border-t">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Endpoint Health</span>
                            <Badge
                                variant={service.health.reliable ? 'default' : 'destructive'}
                                className={service.health.reliable ? 'bg-green-500' : ''}
                            >
                                {service.health.status}
                            </Badge>
                        </div>
                        {service.health.warning && (
                            <p className="text-xs text-yellow-600 mt-2">
                                {service.health.warning}
                            </p>
                        )}
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-4">
                    <Button
                        className="flex-1 bg-[#111111] hover:bg-[#333333]"
                        onClick={() => navigate(`/dashboard/services/${service.id}`)}
                    >
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                    </Button>
                    {isOwner && (
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => navigate(`/dashboard/services/${service.id}/settings`)}
                        >
                            <Settings className="h-4 w-4" />
                        </Button>
                    )}
                    {service.endpointUrl && (
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => window.open(service.endpointUrl, '_blank')}
                        >
                            <ExternalLink className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

export default ServiceDiscovery;
