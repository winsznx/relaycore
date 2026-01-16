/**
 * RWA Services Page
 * 
 * View RWA service providers and settlement status
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Building2,
    CheckCircle2,
    XCircle,
    Clock,
    RefreshCw,
    FileCheck,
    ArrowRight,
    Shield,
    Zap,
    DollarSign
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface RWARequest {
    id: string;
    request_id: string;
    service_id: string;
    session_id: number;
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

const SERVICE_TYPES = [
    { id: 'compliance_check', name: 'Compliance Check', icon: Shield, color: 'blue' },
    { id: 'market_report', name: 'Market Report', icon: FileCheck, color: 'green' },
    { id: 'trade_confirmation', name: 'Trade Confirmation', icon: CheckCircle2, color: 'purple' },
    { id: 'price_verification', name: 'Price Verification', icon: DollarSign, color: 'orange' },
    { id: 'execution_proof', name: 'Execution Proof', icon: Zap, color: 'amber' },
    { id: 'data_attestation', name: 'Data Attestation', icon: Building2, color: 'indigo' },
];

export default function RWAServices() {
    const [requests, setRequests] = useState<RWARequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedType, setSelectedType] = useState<string | null>(null);

    useEffect(() => {
        loadRequests();
    }, []);

    async function loadRequests() {
        setLoading(true);
        const { data } = await supabase
            .from('rwa_execution_requests')
            .select('*')
            .order('requested_at', { ascending: false })
            .limit(50);

        setRequests(data || []);
        setLoading(false);
    }

    function getStatusBadge(status: string) {
        switch (status) {
            case 'settled':
                return <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">Settled</span>;
            case 'verified':
                return <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">Verified</span>;
            case 'refunded':
                return <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">Refunded</span>;
            case 'failed':
                return <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">Failed</span>;
            default:
                return <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">Pending</span>;
        }
    }

    function formatAddress(addr: string) {
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    }

    const stats = {
        total: requests.length,
        settled: requests.filter(r => r.status === 'settled').length,
        refunded: requests.filter(r => r.status === 'refunded').length,
        totalValue: requests.filter(r => r.status === 'settled').reduce((sum, r) => sum + parseFloat(r.price || '0'), 0),
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                            <Building2 className="w-8 h-8 text-emerald-500" />
                            RWA Settlement
                        </h1>
                        <p className="text-gray-600 mt-1">
                            Real-world service verification with SLA-backed escrow payments
                        </p>
                    </div>
                    <button
                        onClick={loadRequests}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                        <div className="text-sm text-gray-500">Total Requests</div>
                        <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                        <div className="text-sm text-gray-500">Settled</div>
                        <div className="text-2xl font-bold text-green-600">{stats.settled}</div>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                        <div className="text-sm text-gray-500">Refunded</div>
                        <div className="text-2xl font-bold text-red-600">{stats.refunded}</div>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                        <div className="text-sm text-gray-500">Total Value Settled</div>
                        <div className="text-2xl font-bold text-emerald-600">${stats.totalValue.toFixed(2)}</div>
                    </div>
                </div>

                {/* Service Types */}
                <div className="mb-8">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Service Types</h2>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                        {SERVICE_TYPES.map(type => {
                            const Icon = type.icon;
                            const isSelected = selectedType === type.id;
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
                                    <Icon className={`w-6 h-6 mx-auto mb-2 ${isSelected ? 'text-emerald-600' : 'text-gray-400'}`} />
                                    <div className={`text-xs font-medium ${isSelected ? 'text-emerald-700' : 'text-gray-600'}`}>
                                        {type.name}
                                    </div>
                                </motion.button>
                            );
                        })}
                    </div>
                </div>

                {/* RWA Flow Diagram */}
                <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl p-6 mb-8 text-white">
                    <h3 className="font-semibold mb-4">RWA Settlement Flow</h3>
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold">1</div>
                            <span className="text-sm">Register SLA</span>
                        </div>
                        <ArrowRight className="w-4 h-4 opacity-50" />
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold">2</div>
                            <span className="text-sm">Request Execution</span>
                        </div>
                        <ArrowRight className="w-4 h-4 opacity-50" />
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold">3</div>
                            <span className="text-sm">Submit Proof</span>
                        </div>
                        <ArrowRight className="w-4 h-4 opacity-50" />
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold">4</div>
                            <span className="text-sm">Verify SLA</span>
                        </div>
                        <ArrowRight className="w-4 h-4 opacity-50" />
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold">5</div>
                            <span className="text-sm">Settle/Refund</span>
                        </div>
                    </div>
                </div>

                {/* Requests Table */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-100">
                        <h2 className="font-semibold text-gray-900">Execution Requests</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Request ID</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agent</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Latency</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {requests.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                                            <FileCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                            <p>No RWA execution requests yet</p>
                                            <p className="text-sm mt-1">Use MCP tools to create RWA service requests</p>
                                        </td>
                                    </tr>
                                ) : (
                                    requests
                                        .filter(r => !selectedType || r.service_id.includes(selectedType))
                                        .map(request => (
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
                                                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                                    ${parseFloat(request.price).toFixed(2)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {getStatusBadge(request.status)}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-500">
                                                    {request.verification?.slaMetrics?.latencyMs
                                                        ? `${request.verification.slaMetrics.latencyMs}ms`
                                                        : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-500">
                                                    {new Date(request.requested_at).toLocaleDateString()}
                                                </td>
                                            </motion.tr>
                                        ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Info Card */}
                <div className="mt-8 bg-emerald-50 border border-emerald-200 rounded-xl p-6">
                    <h3 className="font-semibold text-emerald-900 mb-2">What is RWA Settlement?</h3>
                    <p className="text-emerald-700 text-sm mb-4">
                        RWA (Real-World Asset) Settlement enables agents to pay for real-world services with on-chain
                        escrow guarantees. Providers register services with SLA terms, agents request execution,
                        and payments are automatically released or refunded based on proof verification.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5" />
                            <span className="text-emerald-700">SLA-backed verification</span>
                        </div>
                        <div className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5" />
                            <span className="text-emerald-700">Automatic settlement/refund</span>
                        </div>
                        <div className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5" />
                            <span className="text-emerald-700">No custody or legal claims</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
