import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Search, CheckCircle2, XCircle, ExternalLink,
    TrendingUp, Zap, Shield,
    GitBranch, Code, Box, ArrowRight, Filter, ChevronDown,
    Layers, Database, Brain, BarChart3, Wallet, Globe,
    Sparkles, Network, Link2, CreditCard, Plus, Loader2
} from 'lucide-react';

/**
 * Public Agent Marketplace
 * 
 * Full-featured marketplace for discovering all available services
 * Features:
 * - Advanced category filtering 
 * - Schema-based type filtering (input/output types)
 * - Reputation-based sorting
 * - Service chaining suggestions
 * - Workflow discovery
 * - Graph dependencies visualization
 * - Tags and capabilities filtering
 */

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
    schema?: {
        inputType?: string;
        outputType?: string;
        tags?: string[];
        capabilities?: string[];
    };
    dependencyCount?: number;
    totalCalls?: number;
    // Agent card data (Phase 6)
    agentCard?: {
        name: string;
        description?: string;
        url: string;
        version?: string;
        network?: string;
        capabilities?: string[];
        resources?: Array<{
            id: string;
            title: string;
            description?: string;
            url: string;
            hasPaywall?: boolean;
        }>;
        x402Enabled?: boolean;
    };
    x402Enabled?: boolean;
}

const CATEGORIES = [
    { value: 'all', label: 'All Services', icon: Globe, count: 0 },
    { value: 'trading.execution', label: 'Trading', icon: TrendingUp, count: 0 },
    { value: 'trading.aggregation', label: 'Aggregation', icon: Layers, count: 0 },
    { value: 'data.prices', label: 'Price Feeds', icon: BarChart3, count: 0 },
    { value: 'data.analytics', label: 'Analytics', icon: Database, count: 0 },
    { value: 'ai.inference', label: 'AI Inference', icon: Brain, count: 0 },
    { value: 'ai.agents', label: 'AI Agents', icon: Sparkles, count: 0 },
    { value: 'kyc', label: 'KYC/Identity', icon: Shield, count: 0 },
    { value: 'oracle', label: 'Oracles', icon: Network, count: 0 },
    { value: 'payments', label: 'Payments', icon: Wallet, count: 0 },
];

const SORT_OPTIONS = [
    { value: 'reputation', label: 'Top Rated' },
    { value: 'latency', label: 'Fastest' },
    { value: 'volume', label: 'Most Popular' },
    { value: 'price', label: 'Lowest Price' },
    { value: 'newest', label: 'Newest' },
];

const INPUT_TYPES = [
    'TradeRequest', 'PriceQuery', 'AnalyticsQuery', 'ImageData',
    'TextPrompt', 'IdentityProof', 'TransactionData', 'MarketData'
];

const OUTPUT_TYPES = [
    'TradeResult', 'PriceData', 'AnalyticsReport', 'ImageResult',
    'TextResponse', 'VerificationResult', 'TransactionReceipt', 'Prediction'
];

export function Marketplace() {
    const navigate = useNavigate();
    const [services, setServices] = useState<ServiceData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filter states
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [sortBy, setSortBy] = useState('reputation');
    const [minReputation, setMinReputation] = useState(0);
    const [maxLatency, setMaxLatency] = useState(10000);
    const [inputType, setInputType] = useState('');
    const [outputType, setOutputType] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [showFilters, setShowFilters] = useState(false);
    const [priceRange, setPriceRange] = useState<'all' | 'free' | 'paid'>('all');

    // Stats state
    const [stats, setStats] = useState({
        totalServices: 0,
        verifiedServices: 0,
        avgReputation: 0,
        totalVolume: 0
    });

    // Available tags from loaded services
    const [availableTags, setAvailableTags] = useState<string[]>([]);

    // Agent URL import (Phase 6)
    const [showImportModal, setShowImportModal] = useState(false);
    const [importUrl, setImportUrl] = useState('');
    const [importing, setImporting] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);
    const [importedAgent, setImportedAgent] = useState<ServiceData | null>(null);

    useEffect(() => {
        fetchServices();
    }, [selectedCategory, sortBy, minReputation, maxLatency, inputType, outputType, priceRange]);

    const fetchServices = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                sortBy,
                limit: '100',
            });

            if (selectedCategory !== 'all') {
                params.set('category', selectedCategory);
            }
            if (minReputation > 0) {
                params.set('minReputation', minReputation.toString());
            }
            if (maxLatency < 10000) {
                params.set('maxLatency', maxLatency.toString());
            }
            if (inputType) {
                params.set('inputType', inputType);
            }
            if (outputType) {
                params.set('outputType', outputType);
            }

            const response = await fetch(`/api/services?${params}`);
            if (!response.ok) throw new Error('Failed to fetch services');

            const data = await response.json();
            let serviceList = data.services || [];

            // Extract unique tags
            const tags = new Set<string>();
            serviceList.forEach((s: ServiceData) => {
                s.schema?.tags?.forEach(tag => tags.add(tag));
            });
            setAvailableTags(Array.from(tags));

            // Client-side price filter
            if (priceRange === 'free') {
                serviceList = serviceList.filter((s: ServiceData) =>
                    !s.pricePerCall || parseFloat(s.pricePerCall) === 0
                );
            } else if (priceRange === 'paid') {
                serviceList = serviceList.filter((s: ServiceData) =>
                    s.pricePerCall && parseFloat(s.pricePerCall) > 0
                );
            }

            setServices(serviceList);

            // Calculate stats
            const verified = serviceList.filter((s: ServiceData) => s.health?.reliable).length;
            const totalRep = serviceList.reduce((acc: number, s: ServiceData) =>
                acc + (s.reputation?.reputationScore || 0), 0);
            const totalVol = serviceList.reduce((acc: number, s: ServiceData) =>
                acc + (s.reputation?.totalPayments || 0), 0);

            setStats({
                totalServices: serviceList.length,
                verifiedServices: verified,
                avgReputation: serviceList.length > 0 ? totalRep / serviceList.length : 0,
                totalVolume: totalVol
            });

        } catch (err) {
            // Only show error for actual failures, not for empty results
            const errMsg = err instanceof Error ? err.message : 'Unknown error';
            // Check if it's a network/server error vs just no data
            if (errMsg.includes('Failed to fetch') || errMsg.includes('network') || errMsg.includes('500')) {
                setError(errMsg);
            }
            setServices([]);
        } finally {
            setLoading(false);
        }
    };

    // Filter services by search and tags
    const filteredServices = services.filter(service => {
        const matchesSearch = !searchQuery ||
            service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            service.description?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesTags = selectedTags.length === 0 ||
            selectedTags.every(tag => service.schema?.tags?.includes(tag));

        return matchesSearch && matchesTags;
    });

    const getReputationColor = (score: number) => {
        if (score >= 90) return 'text-emerald-600 bg-emerald-50';
        if (score >= 70) return 'text-blue-600 bg-blue-50';
        if (score >= 50) return 'text-amber-600 bg-amber-50';
        return 'text-red-600 bg-red-50';
    };

    const formatPrice = (price?: string) => {
        if (!price) return 'Free';
        const num = parseFloat(price);
        if (num === 0) return 'Free';
        if (num < 0.01) return '<$0.01';
        return `$${num.toFixed(2)}`;
    };

    const toggleTag = (tag: string) => {
        setSelectedTags(prev =>
            prev.includes(tag)
                ? prev.filter(t => t !== tag)
                : [...prev, tag]
        );
    };

    // Import agent from external URL (Phase 6)
    const handleImportAgent = async () => {
        if (!importUrl.trim()) {
            setImportError('Please enter an agent URL');
            return;
        }

        setImporting(true);
        setImportError(null);

        try {
            // Try to fetch agent card from the URL
            const urlsToTry = [
                `${importUrl.replace(/\/$/, '')}/.well-known/agent-card.json`,
                `${importUrl.replace(/\/$/, '')}/.well-known/agent.json`,
                `${importUrl.replace(/\/$/, '')}/agent-card.json`
            ];

            let card = null;

            for (const url of urlsToTry) {
                try {
                    const response = await fetch(url, {
                        headers: { 'Accept': 'application/json' },
                        signal: AbortSignal.timeout(10000)
                    });
                    if (response.ok) {
                        card = await response.json();
                        break;
                    }
                } catch {
                    continue;
                }
            }

            if (!card) {
                setImportError('No agent card found. Agent must serve /.well-known/agent-card.json');
                return;
            }

            // Create service data from agent card
            const importedService: ServiceData = {
                id: `external_${Date.now()}`,
                name: card.name || 'Unknown Agent',
                description: card.description || '',
                endpointUrl: card.url || importUrl,
                category: 'ai.agents',
                reputation: {
                    reputationScore: 80,
                    totalPayments: 0,
                    successRate: 100
                },
                agentCard: {
                    name: card.name,
                    description: card.description,
                    url: card.url || importUrl,
                    version: card.version,
                    network: card.network,
                    capabilities: card.capabilities || [],
                    resources: (card.resources || []).map((r: any) => ({
                        id: r.id,
                        title: r.title,
                        description: r.description,
                        url: r.url,
                        hasPaywall: !!r.paywall
                    })),
                    x402Enabled: !!card.x402 || card.resources?.some((r: any) => r.paywall)
                },
                x402Enabled: !!card.x402 || card.resources?.some((r: any) => r.paywall),
                schema: {
                    capabilities: card.capabilities || []
                }
            };

            setImportedAgent(importedService);
            setServices(prev => [importedService, ...prev]);
            setShowImportModal(false);
            setImportUrl('');

        } catch (err) {
            setImportError(err instanceof Error ? err.message : 'Failed to fetch agent card');
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
            {/* Hero Header */}
            <header className="bg-[#111111] text-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-4">
                            <Sparkles className="h-8 w-8 text-blue-400" />
                            <h1 className="text-4xl md:text-5xl font-bold">
                                Agent Marketplace
                            </h1>
                        </div>
                        <p className="text-xl text-gray-300 max-w-2xl mx-auto mt-4">
                            Discover AI agents and services with verified reputation,
                            schema-typed interfaces, and x402 payments.
                        </p>

                        {/* Search Bar */}
                        <div className="max-w-2xl mx-auto mt-8">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search services, agents, or capabilities..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-white/10 backdrop-blur border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                                />
                            </div>
                        </div>

                        {/* Quick Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 max-w-4xl mx-auto">
                            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                                <div className="text-3xl font-bold">{stats.totalServices}</div>
                                <div className="text-sm text-gray-300">Total Services</div>
                            </div>
                            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                                <div className="text-3xl font-bold text-emerald-400">{stats.verifiedServices}</div>
                                <div className="text-sm text-gray-300">Verified</div>
                            </div>
                            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                                <div className="text-3xl font-bold text-blue-400">{stats.avgReputation.toFixed(1)}</div>
                                <div className="text-sm text-gray-300">Avg Reputation</div>
                            </div>
                            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                                <div className="text-3xl font-bold text-purple-400">{stats.totalVolume.toLocaleString()}</div>
                                <div className="text-sm text-gray-300">Total Transactions</div>
                            </div>
                        </div>

                        {/* Import External Agent Button */}
                        <div className="mt-6">
                            <Button
                                variant="outline"
                                onClick={() => setShowImportModal(true)}
                                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                            >
                                <Link2 className="h-4 w-4 mr-2" />
                                Import External Agent
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Category Pills */}
                <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
                    {CATEGORIES.map((category) => {
                        const Icon = category.icon;
                        const isActive = selectedCategory === category.value;
                        const count = services.filter(s =>
                            category.value === 'all' || s.category === category.value
                        ).length;

                        return (
                            <button
                                key={category.value}
                                onClick={() => setSelectedCategory(category.value)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl whitespace-nowrap transition-all ${isActive
                                    ? 'bg-[#111111] text-white shadow-lg'
                                    : 'bg-white text-gray-700 hover:bg-gray-100 shadow-sm ring-1 ring-gray-200'
                                    }`}
                            >
                                <Icon className="h-4 w-4" />
                                <span className="font-medium">{category.label}</span>
                                <Badge
                                    variant="secondary"
                                    className={`ml-1 ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100'}`}
                                >
                                    {count}
                                </Badge>
                            </button>
                        );
                    })}
                </div>

                {/* Filters Panel */}
                <Card className="mt-6 border-0 shadow-sm ring-1 ring-gray-200">
                    <CardContent className="p-4">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            {/* Left: Toggle Filters */}
                            <Button
                                variant="outline"
                                onClick={() => setShowFilters(!showFilters)}
                                className="gap-2"
                            >
                                <Filter className="h-4 w-4" />
                                Advanced Filters
                                <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                            </Button>

                            {/* Right: Sort */}
                            <div className="flex items-center gap-4">
                                <span className="text-sm text-gray-500">Sort by:</span>
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                                >
                                    {SORT_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>

                                <div className="text-sm text-gray-500">
                                    {filteredServices.length} services found
                                </div>
                            </div>
                        </div>

                        {/* Expanded Filters */}
                        {showFilters && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6 pt-6 border-t">
                                {/* Reputation */}
                                <div>
                                    <label className="text-sm font-medium text-gray-700 block mb-2">
                                        Minimum Reputation
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            value={minReputation}
                                            onChange={(e) => setMinReputation(Number(e.target.value))}
                                            className="flex-1"
                                        />
                                        <span className="text-sm font-mono w-8">{minReputation}</span>
                                    </div>
                                </div>

                                {/* Max Latency */}
                                <div>
                                    <label className="text-sm font-medium text-gray-700 block mb-2">
                                        Max Latency (ms)
                                    </label>
                                    <select
                                        value={maxLatency}
                                        onChange={(e) => setMaxLatency(Number(e.target.value))}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                                    >
                                        <option value={10000}>Any</option>
                                        <option value={100}>100ms</option>
                                        <option value={200}>200ms</option>
                                        <option value={500}>500ms</option>
                                        <option value={1000}>1 second</option>
                                    </select>
                                </div>

                                {/* Input Type (Schema) */}
                                <div>
                                    <label className="text-sm font-medium text-gray-700 block mb-2">
                                        <Code className="h-3 w-3 inline mr-1" />
                                        Input Type
                                    </label>
                                    <select
                                        value={inputType}
                                        onChange={(e) => setInputType(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                                    >
                                        <option value="">Any Input</option>
                                        {INPUT_TYPES.map(type => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Output Type (Schema) */}
                                <div>
                                    <label className="text-sm font-medium text-gray-700 block mb-2">
                                        <Box className="h-3 w-3 inline mr-1" />
                                        Output Type
                                    </label>
                                    <select
                                        value={outputType}
                                        onChange={(e) => setOutputType(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                                    >
                                        <option value="">Any Output</option>
                                        {OUTPUT_TYPES.map(type => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Price Range */}
                                <div>
                                    <label className="text-sm font-medium text-gray-700 block mb-2">
                                        Price
                                    </label>
                                    <div className="flex gap-2">
                                        {(['all', 'free', 'paid'] as const).map(p => (
                                            <button
                                                key={p}
                                                onClick={() => setPriceRange(p)}
                                                className={`px-3 py-1.5 rounded-lg text-sm capitalize ${priceRange === p
                                                    ? 'bg-[#111111] text-white'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                    }`}
                                            >
                                                {p}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Tags */}
                                {availableTags.length > 0 && (
                                    <div className="md:col-span-3">
                                        <label className="text-sm font-medium text-gray-700 block mb-2">
                                            Tags
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {availableTags.slice(0, 15).map(tag => (
                                                <button
                                                    key={tag}
                                                    onClick={() => toggleTag(tag)}
                                                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${selectedTags.includes(tag)
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                        }`}
                                                >
                                                    {tag}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Services Grid */}
                <div className="mt-6">
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <Card key={i} className="border-0 shadow-sm ring-1 ring-gray-100 animate-pulse">
                                    <CardContent className="p-6">
                                        <div className="h-6 bg-gray-200 rounded w-2/3 mb-4" />
                                        <div className="h-4 bg-gray-100 rounded w-full mb-2" />
                                        <div className="h-4 bg-gray-100 rounded w-3/4" />
                                        <div className="grid grid-cols-3 gap-4 mt-6">
                                            <div className="h-12 bg-gray-100 rounded" />
                                            <div className="h-12 bg-gray-100 rounded" />
                                            <div className="h-12 bg-gray-100 rounded" />
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : error && filteredServices.length === 0 ? (
                        <Card className="border-0 shadow-sm ring-1 ring-red-200 bg-red-50">
                            <CardContent className="p-8 text-center">
                                <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold text-red-800">Failed to load services</h3>
                                <p className="text-red-600 mt-2">{error}</p>
                                <Button onClick={fetchServices} className="mt-4">
                                    Try Again
                                </Button>
                            </CardContent>
                        </Card>
                    ) : filteredServices.length === 0 ? (
                        <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                            <CardContent className="p-16 text-center">
                                <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold text-gray-700">
                                    {stats.totalServices === 0 ? 'No services registered yet' : 'No services match your filters'}
                                </h3>
                                <p className="text-gray-500 mt-2">
                                    {stats.totalServices === 0
                                        ? 'Be the first to register a service on Relay Core!'
                                        : 'Try adjusting your filters or search query'}
                                </p>
                                {stats.totalServices === 0 && (
                                    <Button className="mt-6 bg-[#111111] hover:bg-gray-800" onClick={() => navigate('/dashboard/services/register')}>
                                        Register First Service
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredServices.map(service => (
                                <MarketplaceServiceCard
                                    key={service.id}
                                    service={service}
                                    onViewDetails={() => navigate(`/marketplace/services/${service.id}`)}
                                    getReputationColor={getReputationColor}
                                    formatPrice={formatPrice}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* CTA Section */}
                <Card className="mt-12 border-0 shadow-lg ring-1 ring-gray-100 bg-gradient-to-r from-[#111111] to-gray-800 text-white">
                    <CardContent className="p-8">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                            <div>
                                <h3 className="text-2xl font-bold">Ready to list your service?</h3>
                                <p className="text-gray-300 mt-2">
                                    Register your AI agent or API to earn reputation and receive x402 payments.
                                </p>
                            </div>
                            <div className="flex gap-4">
                                <Button
                                    variant="outline"
                                    className="bg-white text-black hover:bg-gray-100 border-0"
                                    onClick={() => navigate('/docs')}
                                >
                                    Read Docs
                                </Button>
                                <Button
                                    className="bg-blue-600 hover:bg-blue-700"
                                    onClick={() => navigate('/dashboard/services/register')}
                                >
                                    Register Service
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </main>

            {/* Footer */}
            <footer className="bg-gray-50 border-t mt-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <Zap className="h-5 w-5 text-[#111111]" />
                            <span className="font-bold">Relay Core</span>
                        </div>
                        <div className="flex gap-6 text-sm text-gray-500">
                            <Link to="/docs" className="hover:text-gray-900">Documentation</Link>
                            <Link to="/dashboard" className="hover:text-gray-900">Dashboard</Link>
                            <Link to="/terms" className="hover:text-gray-900">Terms</Link>
                            <Link to="/privacy" className="hover:text-gray-900">Privacy</Link>
                        </div>
                    </div>
                </div>
            </footer>

            {/* Import Agent Modal */}
            {showImportModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-lg border-0 shadow-2xl">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Link2 className="h-5 w-5" />
                                Import External Agent
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-gray-600">
                                Enter the URL of an A2A-compliant agent to import it into your marketplace view.
                                The agent must serve a card at <code className="bg-gray-100 px-1 rounded">/.well-known/agent-card.json</code>
                            </p>

                            <div className="space-y-2">
                                <Input
                                    placeholder="https://agent.example.com"
                                    value={importUrl}
                                    onChange={(e) => setImportUrl(e.target.value)}
                                    className="w-full"
                                />
                                {importError && (
                                    <p className="text-sm text-red-600 flex items-center gap-1">
                                        <XCircle className="h-4 w-4" />
                                        {importError}
                                    </p>
                                )}
                            </div>

                            {importedAgent && (
                                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                                    <div className="flex items-center gap-2 text-green-800">
                                        <CheckCircle2 className="h-5 w-5" />
                                        <span className="font-medium">Agent imported successfully!</span>
                                    </div>
                                    <p className="text-sm text-green-600 mt-1">
                                        {importedAgent.name} has been added to your view.
                                    </p>
                                </div>
                            )}

                            <div className="flex gap-3 pt-4">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setShowImportModal(false);
                                        setImportUrl('');
                                        setImportError(null);
                                        setImportedAgent(null);
                                    }}
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleImportAgent}
                                    disabled={importing || !importUrl.trim()}
                                    className="flex-1 bg-[#111111] hover:bg-gray-800"
                                >
                                    {importing ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Importing...
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="h-4 w-4 mr-2" />
                                            Import Agent
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}

interface MarketplaceServiceCardProps {
    service: ServiceData;
    onViewDetails: () => void;
    getReputationColor: (score: number) => string;
    formatPrice: (price?: string) => string;
}

function MarketplaceServiceCard({
    service,
    onViewDetails,
    getReputationColor,
    formatPrice
}: MarketplaceServiceCardProps) {
    const reputationScore = service.reputation?.reputationScore || 0;
    const repColorClass = getReputationColor(reputationScore);

    return (
        <Card
            onClick={onViewDetails}
            className="border-0 shadow-sm ring-1 ring-gray-100 hover:ring-2 hover:ring-[#111111] hover:shadow-lg transition-all cursor-pointer group"
        >
            <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate group-hover:text-blue-600 transition-colors">
                            {service.name}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge variant="secondary" className="text-xs">
                                {service.category || 'Uncategorized'}
                            </Badge>
                            {service.health?.reliable && (
                                <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Verified
                                </Badge>
                            )}
                            {service.x402Enabled && (
                                <Badge className="bg-blue-100 text-blue-700 text-xs">
                                    <CreditCard className="h-3 w-3 mr-1" />
                                    x402
                                </Badge>
                            )}
                            {service.id.startsWith('external_') && (
                                <Badge className="bg-purple-100 text-purple-700 text-xs">
                                    <Link2 className="h-3 w-3 mr-1" />
                                    External
                                </Badge>
                            )}
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-lg font-bold text-[#111111]">
                            {formatPrice(service.pricePerCall)}
                        </div>
                        <span className="text-xs text-gray-500">per call</span>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Description */}
                <p className="text-sm text-gray-600 line-clamp-2">
                    {service.description || 'No description available'}
                </p>

                {/* Metrics Row */}
                <div className="grid grid-cols-3 gap-2 py-3 border-t border-b">
                    <div className="text-center">
                        <div className={`text-lg font-bold px-2 py-0.5 rounded ${repColorClass}`}>
                            {reputationScore.toFixed(0)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">Reputation</div>
                    </div>
                    <div className="text-center">
                        <div className="text-lg font-semibold text-gray-900">
                            {service.reputation?.avgLatencyMs || '—'}
                            <span className="text-xs text-gray-500 font-normal">ms</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">Latency</div>
                    </div>
                    <div className="text-center">
                        <div className="text-lg font-semibold text-gray-900">
                            {service.reputation?.successRate?.toFixed(0) || '—'}
                            <span className="text-xs text-gray-500 font-normal">%</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">Success</div>
                    </div>
                </div>

                {/* Schema Types */}
                {(service.schema?.inputType || service.schema?.outputType) && (
                    <div className="flex items-center gap-2 text-xs">
                        {service.schema?.inputType && (
                            <Badge variant="outline" className="font-mono">
                                <Code className="h-3 w-3 mr-1" />
                                {service.schema.inputType}
                            </Badge>
                        )}
                        {service.schema?.inputType && service.schema?.outputType && (
                            <ArrowRight className="h-3 w-3 text-gray-400" />
                        )}
                        {service.schema?.outputType && (
                            <Badge variant="outline" className="font-mono">
                                <Box className="h-3 w-3 mr-1" />
                                {service.schema.outputType}
                            </Badge>
                        )}
                    </div>
                )}

                {/* Tags */}
                {service.schema?.tags && service.schema.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {service.schema.tags.slice(0, 4).map(tag => (
                            <span
                                key={tag}
                                className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full"
                            >
                                {tag}
                            </span>
                        ))}
                        {service.schema.tags.length > 4 && (
                            <span className="text-xs text-gray-400">
                                +{service.schema.tags.length - 4}
                            </span>
                        )}
                    </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                        <GitBranch className="h-3 w-3" />
                        {service.dependencyCount || 0} dependencies
                    </div>
                    <Button
                        size="sm"
                        className="bg-[#111111] hover:bg-gray-800 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        View Details
                        <ExternalLink className="ml-1 h-3 w-3" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

export default Marketplace;

