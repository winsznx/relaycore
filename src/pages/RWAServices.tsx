/**
 * RWA Services Page - Production Complete
 * 
 * Complete RWA asset management UI:
 * - Asset minting with EIP-712 signing
 * - State machine lifecycle visualization
 * - x402 payment enforcement
 * - Settlement tracking
 * - Portfolio overview
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Building2, CheckCircle2, XCircle, RefreshCw,
    FileCheck, ArrowRight, DollarSign, Plus,
    Box, TrendingUp, CreditCard, Eye, X, User, Activity, Wallet
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { useAppKitAccount, useAppKitProvider } from '@reown/appkit/react';
import { BrowserProvider } from 'ethers';
import { RWAStateMachine } from '@/components/RWAStateMachine';
import { useUserSessions, getAvailableBalance, formatSessionDisplay } from '@/lib/useUserSessions';
import { formatUSDCWithLabel, shortenAddress } from '@/lib/formatters';

// ============================================
// INTERFACES
// ============================================

interface RWAAsset {
    assetId: string;
    type: string;
    name: string;
    description: string;
    owner: string;
    value: string;
    currency: string;
    status: string;
    metadata: Record<string, unknown>;
    createdAt: string;
}

interface RWARequest {
    id: string;
    request_id: string;
    service_id: string;
    session_id: string;
    agent_address: string;
    price: string;
    status: string;
    verification: {
        valid: boolean;
        slaMetrics?: {
            latencyMs: number;
            proofFormatValid: boolean;
        };
        reason?: string;
    } | null;
    requested_at: string;
    settled_at: string | null;
}

interface LifecycleEvent {
    eventId: string;
    assetId: string;
    eventType: string;
    actor: string;
    data: Record<string, unknown>;
    timestamp: string;
    txHash?: string;
}

// ============================================
// CONSTANTS
// ============================================

const ASSET_TYPES = [
    { id: 'property', name: 'Property', icon: Building2, color: 'blue', description: 'Real estate assets' },
    { id: 'invoice', name: 'Invoice', icon: FileCheck, color: 'green', description: 'Invoice financing' },
    { id: 'receivable', name: 'Receivable', icon: DollarSign, color: 'orange', description: 'Account receivables' },
    { id: 'equipment', name: 'Equipment', icon: Box, color: 'purple', description: 'Industrial equipment' },
    { id: 'commodity', name: 'Commodity', icon: TrendingUp, color: 'amber', description: 'Commodity tokens' },
    { id: 'bond', name: 'Bond', icon: CreditCard, color: 'indigo', description: 'Fixed income bonds' }
];

// ============================================
// MINT MODAL COMPONENT
// ============================================

function MintAssetModal({
    isOpen,
    onClose,
    onMint
}: {
    isOpen: boolean;
    onClose: () => void;
    onMint: (data: any) => void;
}) {
    const [type, setType] = useState('property');
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [value, setValue] = useState('');
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const { address: walletAddress } = useAppKitAccount();
    const { sessions, loading: sessionsLoading } = useUserSessions(walletAddress || null);

    // Calculate minting fee (0.1% of asset value, min 0.01 USDC)
    const calculatedFee = useMemo(() => {
        const assetValue = parseFloat(value) || 0;
        return Math.max(0.01, assetValue * 0.001).toFixed(4);
    }, [value]);

    // Get selected session and available balance
    const selectedSession = useMemo(() => {
        return sessions.find(s => s.session_id === selectedSessionId) || null;
    }, [sessions, selectedSessionId]);

    const availableBalance = useMemo(() => {
        return selectedSession ? getAvailableBalance(selectedSession) : 0;
    }, [selectedSession]);

    const hasInsufficientBalance = useMemo(() => {
        if (!selectedSessionId) return false;
        return parseFloat(calculatedFee) > availableBalance;
    }, [selectedSessionId, calculatedFee, availableBalance]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !value.trim()) return;

        if (hasInsufficientBalance) {
            alert(`Insufficient session balance! Need ${calculatedFee} USDC but only ${availableBalance.toFixed(4)} USDC available.`);
            return;
        }

        setLoading(true);
        try {
            await onMint({
                type,
                name,
                description,
                value,
                currency: 'USDC',
                sessionId: selectedSessionId
            });
            setName('');
            setDescription('');
            setValue('');
            setSelectedSessionId(null);
            onClose();
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-lg"
            >
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Mint RWA Asset</h2>
                        <p className="text-sm text-gray-500">Tokenize a real-world asset</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Asset Type Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Asset Type
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {ASSET_TYPES.map(t => {
                                const Icon = t.icon;
                                const isSelected = type === t.id;
                                return (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => setType(t.id)}
                                        className={`p-3 rounded-lg border-2 text-center transition-all ${isSelected
                                            ? 'border-emerald-500 bg-emerald-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <Icon className={`w-5 h-5 mx-auto mb-1 ${isSelected ? 'text-emerald-600' : 'text-gray-400'
                                            }`} />
                                        <span className={`text-xs font-medium ${isSelected ? 'text-emerald-700' : 'text-gray-600'
                                            }`}>
                                            {t.name}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Asset Name
                        </label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Manhattan Office Building"
                            required
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Description
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Brief description of the asset..."
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                            rows={3}
                        />
                    </div>

                    {/* Value */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Asset Value (USDC)
                        </label>
                        <Input
                            type="number"
                            step="0.01"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            placeholder="1000000.00"
                            required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Total value of the asset being tokenized
                        </p>
                    </div>

                    {/* Session Selector */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Payment Session (Optional)
                        </label>
                        <select
                            value={selectedSessionId || ''}
                            onChange={(e) => setSelectedSessionId(e.target.value || null)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            disabled={sessionsLoading}
                        >
                            <option value="">Pay directly (no session)</option>
                            {sessions.map(session => (
                                <option key={session.session_id} value={session.session_id}>
                                    {formatSessionDisplay(session)}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                            {sessionsLoading ? 'Loading sessions...' :
                                sessions.length === 0 ? 'No active sessions. Create one in x402 Sessions page.' :
                                    'Select a session to pay the minting fee from your session budget'}
                        </p>
                        {selectedSession && (
                            <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-600">Available Balance:</span>
                                    <span className="font-semibold text-gray-900">{availableBalance.toFixed(4)} USDC</span>
                                </div>
                                <div className="flex justify-between text-xs mt-1">
                                    <span className="text-gray-600">Minting Fee:</span>
                                    <span className="font-semibold text-gray-900">{calculatedFee} USDC</span>
                                </div>
                                <div className="flex justify-between text-xs mt-1 pt-1 border-t border-gray-300">
                                    <span className="text-gray-600">After Minting:</span>
                                    <span className={`font-bold ${hasInsufficientBalance ? 'text-red-600' : 'text-green-600'}`}>
                                        {hasInsufficientBalance ? 'INSUFFICIENT!' : `${(availableBalance - parseFloat(calculatedFee)).toFixed(4)} USDC`}
                                    </span>
                                </div>
                            </div>
                        )}
                        {hasInsufficientBalance && (
                            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                                <p className="text-xs text-red-700">
                                    ⚠️ Insufficient balance! Need {calculatedFee} USDC but only {availableBalance.toFixed(4)} USDC available.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Minting Fee Display */}
                    {value && parseFloat(value) > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-blue-900">Minting Fee</p>
                                    <p className="text-xs text-blue-700 mt-0.5">
                                        0.1% of asset value (minimum 0.01 USDC)
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-bold text-blue-900">{calculatedFee} USDC</p>
                                    <p className="text-xs text-blue-700">via x402</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            className="flex-1"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading || !name.trim() || !value.trim()}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                        >
                            {loading ? (
                                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Plus className="w-4 h-4 mr-2" />
                            )}
                            Mint Asset
                        </Button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}

// ============================================
// ASSET DETAIL MODAL
// ============================================

function AssetDetailModal({
    asset,
    events,
    onClose
}: {
    asset: RWAAsset | null;
    events: LifecycleEvent[];
    onClose: () => void;
}) {
    if (!asset) return null;

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'bg-green-100 text-green-700';
            case 'minted': return 'bg-blue-100 text-blue-700';
            case 'pending': return 'bg-yellow-100 text-yellow-700';
            case 'frozen': return 'bg-red-100 text-red-700';
            case 'redeemed': return 'bg-gray-100 text-gray-700';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    const getEventIcon = (type: string) => {
        switch (type) {
            case 'mint': return <Plus className="w-4 h-4" />;
            case 'transfer': return <ArrowRight className="w-4 h-4" />;
            case 'freeze': return <XCircle className="w-4 h-4" />;
            case 'unfreeze': return <CheckCircle2 className="w-4 h-4" />;
            case 'redeem': return <DollarSign className="w-4 h-4" />;
            case 'payment': return <CreditCard className="w-4 h-4" />;
            default: return <Activity className="w-4 h-4" />;
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
            >
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">{asset.name}</h2>
                        <p className="text-sm text-gray-500 font-mono">{asset.assetId.slice(0, 20)}...</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {/* Asset Info */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-gray-50 rounded-lg p-4">
                            <div className="text-sm text-gray-500 mb-1">Value</div>
                            <div className="text-2xl font-bold text-gray-900">${parseFloat(asset.value).toLocaleString()}</div>
                            <div className="text-xs text-gray-500">{asset.currency}</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4">
                            <div className="text-sm text-gray-500 mb-1">Status</div>
                            <Badge className={`${getStatusColor(asset.status)} capitalize`}>
                                {asset.status}
                            </Badge>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4">
                            <div className="text-sm text-gray-500 mb-1">Type</div>
                            <div className="font-medium capitalize">{asset.type}</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4">
                            <div className="text-sm text-gray-500 mb-1">Created</div>
                            <div className="text-sm">{new Date(asset.createdAt).toLocaleDateString()}</div>
                        </div>
                    </div>

                    {/* Description */}
                    {asset.description && (
                        <div className="mb-6">
                            <h3 className="text-sm font-medium text-gray-700 mb-2">Description</h3>
                            <p className="text-gray-600 text-sm">{asset.description}</p>
                        </div>
                    )}

                    {/* Owner */}
                    <div className="mb-6">
                        <h3 className="text-sm font-medium text-gray-700 mb-2">Owner</h3>
                        <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="font-mono text-sm text-gray-600">
                                {asset.owner.slice(0, 10)}...{asset.owner.slice(-8)}
                            </span>
                        </div>
                    </div>

                    {/* Lifecycle Events */}
                    <div>
                        <h3 className="text-sm font-medium text-gray-700 mb-3">Lifecycle Events</h3>
                        <div className="space-y-3">
                            {events.length === 0 ? (
                                <div className="text-center py-6 text-gray-500 text-sm">
                                    No lifecycle events yet
                                </div>
                            ) : (
                                events.map((event, i) => (
                                    <motion.div
                                        key={event.eventId}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                                    >
                                        <div className="p-2 bg-white rounded-lg border border-gray-200">
                                            {getEventIcon(event.eventType)}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium text-sm capitalize">
                                                    {event.eventType}
                                                </span>
                                                <span className="text-xs text-gray-500">
                                                    {new Date(event.timestamp).toLocaleString()}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 font-mono mt-1">
                                                By: {event.actor.slice(0, 8)}...
                                            </p>
                                            {event.txHash && (
                                                <a
                                                    href={`https://explorer.cronos.org/testnet/tx/${event.txHash}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-blue-600 hover:text-blue-800 font-mono mt-1 flex items-center gap-1 hover:underline"
                                                >
                                                    <span>Tx: {event.txHash.slice(0, 16)}...</span>
                                                    <ArrowRight className="w-3 h-3" />
                                                </a>
                                            )}
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function RWAServices() {
    const [requests, setRequests] = useState<RWARequest[]>([]);
    const [assets, setAssets] = useState<RWAAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedType, setSelectedType] = useState<string | null>(null);
    const [showMintModal, setShowMintModal] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<RWAAsset | null>(null);
    const [assetEvents, setAssetEvents] = useState<LifecycleEvent[]>([]);
    const [activeTab, setActiveTab] = useState<'assets' | 'state_machine' | 'settlements'>('assets');
    const [selectedRWAId, setSelectedRWAId] = useState<string | null>(null);

    // Wallet connection hooks for production-grade signing
    const { address: walletAddress } = useAppKitAccount();
    const { walletProvider } = useAppKitProvider('eip155');

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [requestsRes, assetsRes] = await Promise.all([
                supabase
                    .from('rwa_execution_requests')
                    .select('*')
                    .order('requested_at', { ascending: false })
                    .limit(50),
                supabase
                    .from('rwa_assets')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(50)
            ]);

            setRequests(requestsRes.data || []);
            setAssets((assetsRes.data || []).map(a => ({
                assetId: a.asset_id,
                type: a.type,
                name: a.name,
                description: a.description,
                owner: a.owner_address,
                value: a.value,
                currency: a.currency,
                status: a.status,
                metadata: a.metadata,
                createdAt: a.created_at
            })));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleViewAsset = async (asset: RWAAsset) => {
        setSelectedAsset(asset);
        const { data } = await supabase
            .from('rwa_lifecycle_events')
            .select('*')
            .eq('asset_id', asset.assetId)
            .order('timestamp', { ascending: false });
        setAssetEvents((data || []).map(e => ({
            eventId: e.event_id,
            assetId: e.asset_id,
            eventType: e.event_type,
            actor: e.actor,
            data: e.data,
            timestamp: e.timestamp,
            txHash: e.tx_hash
        })));
    };

    const handleMintAsset = async (data: any) => {
        try {
            const response = await fetch('/api/rwa/assets/mint', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...data,
                    owner: walletAddress || '0x742d35Cc6634C0532925a3b844Bc454e4438f51B'
                })
            });

            if (!response.ok) {
                throw new Error('Failed to initiate minting');
            }

            const result = await response.json();
            const { assetId, handoffData, mintingFee } = result;

            if (handoffData) {
                await handleHandoffSigning(assetId, handoffData, mintingFee);
            }

            await loadData();
        } catch (err) {
            console.error('Mint failed:', err);
            alert(`Minting failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    };

    const handleHandoffSigning = async (assetId: string, handoffData: any, mintingFee: string) => {
        if (!walletAddress || !walletProvider) {
            alert('Please connect your wallet first');
            return;
        }

        try {
            // Type assertion for wallet provider
            const ethersProvider = new BrowserProvider(walletProvider as any);
            const signer = await ethersProvider.getSigner();

            const domain = {
                name: 'Relay Core RWA',
                version: '1',
                chainId: await signer.provider.getNetwork().then(n => Number(n.chainId)),
                verifyingContract: '0x0000000000000000000000000000000000000000'
            };

            const types = {
                RWAMint: [
                    { name: 'action', type: 'string' },
                    { name: 'assetId', type: 'string' },
                    { name: 'assetType', type: 'string' },
                    { name: 'name', type: 'string' },
                    { name: 'value', type: 'string' },
                    { name: 'currency', type: 'string' },
                    { name: 'owner', type: 'address' },
                    { name: 'mintingFee', type: 'string' },
                    { name: 'deadline', type: 'uint256' }
                ]
            };

            const value = {
                action: handoffData.action,
                assetId: handoffData.asset.assetId,
                assetType: handoffData.asset.type,
                name: handoffData.asset.name,
                value: handoffData.asset.value,
                currency: handoffData.asset.currency,
                owner: handoffData.asset.owner,
                mintingFee: mintingFee,
                deadline: handoffData.deadline
            };

            const signature = await signer.signTypedData(domain, types, value);

            const confirmResponse = await fetch(`/api/rwa/assets/${assetId}/confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    txHash: signature,
                    signedData: {
                        domain,
                        types,
                        value,
                        signature
                    }
                })
            });

            if (!confirmResponse.ok) {
                throw new Error('Failed to confirm minting');
            }

            alert(`Asset minted successfully! Minting fee: ${mintingFee} USDC`);
        } catch (err) {
            console.error('Handoff signing failed:', err);
            if (err instanceof Error && err.message.includes('user rejected')) {
                alert('Transaction cancelled by user');
            } else {
                alert(`Signing failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
            }
            throw err;
        }
    };

    function getStatusBadge(status: string) {
        switch (status) {
            case 'settled':
                return <Badge className="bg-green-100 text-green-700">Settled</Badge>;
            case 'verified':
                return <Badge className="bg-blue-100 text-blue-700">Verified</Badge>;
            case 'refunded':
                return <Badge className="bg-red-100 text-red-700">Refunded</Badge>;
            case 'failed':
                return <Badge className="bg-red-100 text-red-700">Failed</Badge>;
            default:
                return <Badge className="bg-amber-100 text-amber-700">Pending</Badge>;
        }
    }

    function formatAddress(addr: string) {
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    }

    const stats = {
        totalAssets: assets.length,
        activeAssets: assets.filter(a => a.status === 'active' || a.status === 'minted').length,
        totalValue: assets.reduce((sum, a) => sum + parseFloat(a.value || '0'), 0),
        settlements: requests.filter(r => r.status === 'settled').length
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                            <Building2 className="w-8 h-8 text-emerald-500" />
                            RWA Management
                        </h1>
                        <p className="text-gray-600 mt-1">
                            Real-world asset tokenization and settlement
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            onClick={loadData}
                            disabled={loading}
                        >
                            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                        <Button
                            onClick={() => setShowMintModal(true)}
                            className="bg-emerald-600 hover:bg-emerald-700"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Mint Asset
                        </Button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <Card className="border-0 shadow-sm">
                        <CardContent className="p-4">
                            <div className="text-sm text-gray-500">Total Assets</div>
                            <div className="text-2xl font-bold text-gray-900">{stats.totalAssets}</div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-sm">
                        <CardContent className="p-4">
                            <div className="text-sm text-gray-500">Active Assets</div>
                            <div className="text-2xl font-bold text-green-600">{stats.activeAssets}</div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-sm">
                        <CardContent className="p-4">
                            <div className="text-sm text-gray-500">Total Value</div>
                            <div className="text-2xl font-bold text-emerald-600">${stats.totalValue.toLocaleString()}</div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-sm">
                        <CardContent className="p-4">
                            <div className="text-sm text-gray-500">Settlements</div>
                            <div className="text-2xl font-bold text-blue-600">{stats.settlements}</div>
                        </CardContent>
                    </Card>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => setActiveTab('assets')}
                        className={`px-4 py-2 rounded-lg font-medium transition ${activeTab === 'assets'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        Assets
                    </button>
                    <button
                        onClick={() => setActiveTab('state_machine')}
                        className={`px-4 py-2 rounded-lg font-medium transition ${activeTab === 'state_machine'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        State Machine
                    </button>
                    <button
                        onClick={() => setActiveTab('settlements')}
                        className={`px-4 py-2 rounded-lg font-medium transition ${activeTab === 'settlements'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        Settlements
                    </button>
                </div>

                {/* Asset Types Filter */}
                {activeTab === 'state_machine' && (
                    <div className="space-y-6">
                        {selectedRWAId ? (
                            <div>
                                <Button
                                    variant="outline"
                                    onClick={() => setSelectedRWAId(null)}
                                    className="mb-4"
                                >
                                    ← Back to List
                                </Button>
                                <RWAStateMachine
                                    rwaId={selectedRWAId}
                                    onTransition={async (toState) => {
                                        try {
                                            const response = await fetch(`/api/rwa/assets/${selectedRWAId}/state`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    status: toState,
                                                    actor: walletAddress || '0x742d35Cc6634C0532925a3b844Bc454e4438f51B',
                                                    reason: `Transition to ${toState}`
                                                })
                                            });

                                            if (!response.ok) {
                                                const error = await response.json();
                                                throw new Error(error.error || 'Failed to transition state');
                                            }

                                            alert(`Successfully transitioned to ${toState.toUpperCase()}`);
                                            await loadData();
                                        } catch (err) {
                                            console.error('State transition failed:', err);
                                            alert(`Transition failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
                                        }
                                    }}
                                />
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold">RWA State Machines</h3>
                                    <Button onClick={() => setShowMintModal(true)}>
                                        <Plus className="w-4 h-4 mr-2" />
                                        Create State Machine
                                    </Button>
                                </div>
                                {assets.length === 0 ? (
                                    <Card>
                                        <CardContent className="py-12 text-center">
                                            <Activity className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                                            <p className="text-gray-600">No RWA state machines yet</p>
                                            <Button onClick={() => setShowMintModal(true)} className="mt-4">
                                                Create Your First RWA
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <div className="grid gap-4">
                                        {assets.map((asset) => (
                                            <Card
                                                key={asset.assetId}
                                                className="cursor-pointer hover:shadow-lg transition-shadow"
                                                onClick={() => setSelectedRWAId(asset.assetId)}
                                            >
                                                <CardContent className="p-6">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <h4 className="font-semibold text-lg">{asset.name}</h4>
                                                            <p className="text-sm text-gray-600 mt-1">{asset.assetId}</p>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <Badge variant="outline">
                                                                {asset.status}
                                                            </Badge>
                                                            <Button variant="outline" size="sm">
                                                                View Details →
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'assets' && (
                    <div className="mb-6">
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                            {ASSET_TYPES.map(type => {
                                const Icon = type.icon;
                                const isSelected = selectedType === type.id;
                                const count = assets.filter(a => a.type === type.id).length;
                                return (
                                    <motion.button
                                        key={type.id}
                                        onClick={() => setSelectedType(isSelected ? null : type.id)}
                                        className={`p-4 rounded-xl border transition text-center ${isSelected
                                            ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-200'
                                            : 'bg-white border-gray-200 hover:border-emerald-200'
                                            }`}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        <Icon className={`w-6 h-6 mx-auto mb-2 ${isSelected ? 'text-emerald-600' : 'text-gray-400'
                                            }`} />
                                        <div className={`text-xs font-medium ${isSelected ? 'text-emerald-700' : 'text-gray-600'
                                            }`}>
                                            {type.name}
                                        </div>
                                        <Badge variant="secondary" className="mt-1">
                                            {count}
                                        </Badge>
                                    </motion.button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* RWA Flow Diagram */}
                <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl p-6 mb-8 text-white">
                    <h3 className="font-semibold mb-4">RWA Lifecycle Flow</h3>
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        {['Mint Asset', 'Handoff Sign', 'Active', 'Agent Manage', 'Settle/Redeem'].map((step, i) => (
                            <div key={step} className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold">
                                    {i + 1}
                                </div>
                                <span className="text-sm">{step}</span>
                                {i < 4 && <ArrowRight className="w-4 h-4 opacity-50 hidden md:block" />}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <AnimatePresence mode="wait">
                    {activeTab === 'assets' ? (
                        <motion.div
                            key="assets"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <Card className="border-0 shadow-sm">
                                <CardHeader className="border-b bg-gray-50">
                                    <CardTitle className="text-lg">RWA Assets</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Asset</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Value</th>
                                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Owner</th>
                                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {assets.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                                                            <Box className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                                            <p>No RWA assets yet</p>
                                                            <Button
                                                                onClick={() => setShowMintModal(true)}
                                                                className="mt-4 bg-emerald-600 hover:bg-emerald-700"
                                                                size="sm"
                                                            >
                                                                <Plus className="w-4 h-4 mr-2" />
                                                                Mint Your First Asset
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    assets
                                                        .filter(a => !selectedType || a.type === selectedType)
                                                        .map(asset => (
                                                            <motion.tr
                                                                key={asset.assetId}
                                                                initial={{ opacity: 0 }}
                                                                animate={{ opacity: 1 }}
                                                                className="hover:bg-gray-50"
                                                            >
                                                                <td className="px-4 py-3">
                                                                    <div className="font-medium text-gray-900">{asset.name}</div>
                                                                    <div className="text-xs text-gray-500 font-mono">
                                                                        {asset.assetId.slice(0, 16)}...
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <Badge variant="outline" className="capitalize">
                                                                        {asset.type}
                                                                    </Badge>
                                                                </td>
                                                                <td className="px-4 py-3 text-right font-mono font-medium">
                                                                    ${parseFloat(asset.value).toLocaleString()}
                                                                </td>
                                                                <td className="px-4 py-3 text-center">
                                                                    <Badge className={`capitalize ${asset.status === 'active' || asset.status === 'minted'
                                                                        ? 'bg-green-100 text-green-700'
                                                                        : asset.status === 'pending'
                                                                            ? 'bg-yellow-100 text-yellow-700'
                                                                            : 'bg-gray-100 text-gray-600'
                                                                        }`}>
                                                                        {asset.status}
                                                                    </Badge>
                                                                </td>
                                                                <td className="px-4 py-3 font-mono text-sm text-gray-600">
                                                                    {formatAddress(asset.owner)}
                                                                </td>
                                                                <td className="px-4 py-3 text-right">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => handleViewAsset(asset)}
                                                                    >
                                                                        <Eye className="w-4 h-4 mr-1" />
                                                                        View
                                                                    </Button>
                                                                </td>
                                                            </motion.tr>
                                                        ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="settlements"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <Card className="border-0 shadow-sm">
                                <CardHeader className="border-b bg-gray-50">
                                    <CardTitle className="text-lg">Execution Requests</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Request ID</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agent</th>
                                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Latency</th>
                                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Date</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {requests.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                                                            <FileCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                                            <p>No execution requests yet</p>
                                                            <p className="text-sm mt-1">Use MCP tools to create RWA service requests</p>
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    requests.map(request => (
                                                        <motion.tr
                                                            key={request.id}
                                                            initial={{ opacity: 0 }}
                                                            animate={{ opacity: 1 }}
                                                            className="hover:bg-gray-50"
                                                        >
                                                            <td className="px-4 py-3 font-mono text-sm text-gray-900">
                                                                {request.request_id.slice(0, 12)}...
                                                            </td>
                                                            <td className="px-4 py-3 text-sm text-gray-600">
                                                                {request.service_id.replace('rwa_', '').replace(/_/g, ' ')}
                                                            </td>
                                                            <td className="px-4 py-3 font-mono text-sm text-gray-600">
                                                                {formatAddress(request.agent_address)}
                                                            </td>
                                                            <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                                                                ${parseFloat(request.price).toFixed(2)}
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                {getStatusBadge(request.status)}
                                                            </td>
                                                            <td className="px-4 py-3 text-right text-sm text-gray-500">
                                                                {request.verification?.slaMetrics?.latencyMs
                                                                    ? `${request.verification.slaMetrics.latencyMs}ms`
                                                                    : '-'}
                                                            </td>
                                                            <td className="px-4 py-3 text-right text-sm text-gray-500">
                                                                {new Date(request.requested_at).toLocaleDateString()}
                                                            </td>
                                                        </motion.tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Info Card */}
                <Card className="mt-8 bg-emerald-50 border-emerald-200">
                    <CardContent className="p-6">
                        <h3 className="font-semibold text-emerald-900 mb-2">What is RWA Management?</h3>
                        <p className="text-emerald-700 text-sm mb-4">
                            RWA (Real-World Asset) Management enables tokenization of physical assets with
                            on-chain escrow guarantees. Mint assets, manage their lifecycle through agents,
                            and settle payments automatically based on proof verification.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5" />
                                <span className="text-emerald-700">Handoff-signed minting</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5" />
                                <span className="text-emerald-700">Full lifecycle tracking</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5" />
                                <span className="text-emerald-700">SLA-backed settlements</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Modals */}
            <AnimatePresence>
                {showMintModal && (
                    <MintAssetModal
                        isOpen={showMintModal}
                        onClose={() => setShowMintModal(false)}
                        onMint={handleMintAsset}
                    />
                )}
                {selectedAsset && (
                    <AssetDetailModal
                        asset={selectedAsset}
                        events={assetEvents}
                        onClose={() => setSelectedAsset(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
