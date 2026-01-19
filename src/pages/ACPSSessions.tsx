/**
 * x402 Sessions Page
 * 
 * View and manage gasless payment sessions
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Wallet,
    Clock,
    ArrowRightLeft,
    CheckCircle2,
    XCircle,
    RefreshCw,
    Plus,
    ExternalLink,
    Shield,
    Zap
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Session {
    session_id: number;
    owner_address: string;
    max_spend: string;
    deposited: string;
    spent: string;
    payment_count: number;
    status: string;
    expires_at: string;
    created_at: string;
    authorized_agents: string[];
    deposit_tx_hash?: string;
}

interface Payment {
    id: string;
    session_id: number;
    agent_address: string;
    amount: string;
    execution_id: string;
    tx_hash: string;
    created_at: string;
}

export default function ACPSSessions() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSession, setSelectedSession] = useState<Session | null>(null);

    useEffect(() => {
        loadSessions();
    }, []);

    async function loadSessions() {
        setLoading(true);
        const { data } = await supabase
            .from('escrow_sessions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);

        setSessions(data || []);
        setLoading(false);
    }

    async function loadPayments(sessionId: number) {
        const { data } = await supabase
            .from('session_payments')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: false });

        setPayments(data || []);
    }

    function getStatusColor(status: string) {
        switch (status) {
            case 'active': return 'bg-green-100 text-green-700';
            case 'closed': return 'bg-gray-100 text-gray-700';
            case 'expired': return 'bg-red-100 text-red-700';
            default: return 'bg-amber-100 text-amber-700';
        }
    }

    function formatAddress(addr: string) {
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                            <Shield className="w-8 h-8 text-orange-500" />
                            x402 Sessions
                        </h1>
                        <p className="text-gray-600 mt-1">
                            Gasless payment sessions powered by x402 protocol
                        </p>
                    </div>
                    <button
                        onClick={loadSessions}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                        <div className="text-sm text-gray-500">Total Sessions</div>
                        <div className="text-2xl font-bold text-gray-900">{sessions.length}</div>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                        <div className="text-sm text-gray-500">Active Sessions</div>
                        <div className="text-2xl font-bold text-green-600">
                            {sessions.filter(s => s.status === 'active').length}
                        </div>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                        <div className="text-sm text-gray-500">Total Budget</div>
                        <div className="text-2xl font-bold text-blue-600">
                            ${sessions.reduce((sum, s) => sum + parseFloat(s.max_spend || '0'), 0).toFixed(2)}
                        </div>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                        <div className="text-sm text-gray-500">Total Spent</div>
                        <div className="text-2xl font-bold text-orange-600">
                            ${sessions.reduce((sum, s) => sum + parseFloat(s.spent || '0'), 0).toFixed(2)}
                        </div>
                    </div>
                </div>

                {/* Contract Info */}
                <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl p-4 mb-8 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm opacity-80">x402 Gasless Sessions</div>
                            <div className="text-lg">All payments gasless • No gas fees • Complete audit trail</div>
                        </div>
                        <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-lg">
                            <Zap className="w-4 h-4" />
                            Powered by x402
                        </div>
                    </div>
                </div>

                {/* Sessions Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Sessions List */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-gray-100">
                            <h2 className="font-semibold text-gray-900">Sessions</h2>
                        </div>
                        <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                            {sessions.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">
                                    <Wallet className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                    <p>No sessions yet</p>
                                    <p className="text-sm mt-1">Create a session via MCP tools</p>
                                </div>
                            ) : (
                                sessions.map(session => (
                                    <motion.div
                                        key={session.session_id}
                                        onClick={() => {
                                            setSelectedSession(session);
                                            loadPayments(session.session_id);
                                        }}
                                        className={`p-4 cursor-pointer hover:bg-gray-50 transition ${selectedSession?.session_id === session.session_id ? 'bg-orange-50' : ''
                                            }`}
                                        whileHover={{ x: 4 }}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-semibold text-gray-900">
                                                Session #{session.session_id}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(session.status)}`}>
                                                {session.status}
                                            </span>
                                        </div>
                                        <div className="text-sm text-gray-500 mb-2">
                                            Owner: {formatAddress(session.owner_address || '')}
                                        </div>
                                        <div className="flex items-center gap-4 text-sm">
                                            <span className="text-blue-600">
                                                Budget: ${parseFloat(session.max_spend || '0').toFixed(2)}
                                            </span>
                                            <span className="text-orange-600">
                                                Spent: ${parseFloat(session.spent || '0').toFixed(2)}
                                            </span>
                                            <span className="text-green-600">
                                                Remaining: ${(parseFloat(session.max_spend || '0') - parseFloat(session.spent || '0')).toFixed(2)}
                                            </span>
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Session Details */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-gray-100">
                            <h2 className="font-semibold text-gray-900">
                                {selectedSession ? `Session #${selectedSession.session_id} Details` : 'Select a Session'}
                            </h2>
                        </div>
                        {selectedSession ? (
                            <div className="p-4">
                                {/* Session Info */}
                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div>
                                        <div className="text-xs text-gray-500 mb-1">Budget</div>
                                        <div className="font-semibold">${parseFloat(selectedSession.max_spend).toFixed(2)}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-500 mb-1">Spent</div>
                                        <div className="font-semibold text-orange-600">
                                            ${parseFloat(selectedSession.spent || '0').toFixed(2)}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-500 mb-1">Remaining</div>
                                        <div className="font-semibold text-green-600">
                                            ${(parseFloat(selectedSession.max_spend || '0') - parseFloat(selectedSession.spent || '0')).toFixed(2)}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-500 mb-1">Payments</div>
                                        <div className="font-semibold text-blue-600">
                                            {selectedSession.payment_count || 0}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-500 mb-1">Created</div>
                                        <div className="font-medium text-sm">
                                            {new Date(selectedSession.created_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-500 mb-1">Expires</div>
                                        <div className="font-medium text-sm">
                                            {selectedSession.expires_at ? new Date(selectedSession.expires_at).toLocaleDateString() : 'N/A'}
                                        </div>
                                    </div>
                                </div>

                                {/* Authorized Agents */}
                                <div className="mb-6">
                                    <div className="text-xs text-gray-500 mb-2">Authorized Agents</div>
                                    <div className="flex flex-wrap gap-2">
                                        {(selectedSession.authorized_agents || []).map((agent, i) => (
                                            <span key={i} className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">
                                                {formatAddress(agent)}
                                            </span>
                                        ))}
                                        {(!selectedSession.authorized_agents || selectedSession.authorized_agents.length === 0) && (
                                            <span className="text-gray-400 text-sm">No agents authorized</span>
                                        )}
                                    </div>
                                </div>

                                {/* Payments */}
                                <div>
                                    <div className="text-xs text-gray-500 mb-2">Payment History</div>
                                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                        {payments.length === 0 ? (
                                            <div className="text-center text-gray-400 py-4">
                                                No payments yet
                                            </div>
                                        ) : (
                                            payments.map(payment => (
                                                <div key={payment.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                                    <div>
                                                        <div className="font-medium text-sm">${parseFloat(payment.amount).toFixed(2)}</div>
                                                        <div className="text-xs text-gray-500">
                                                            To: {formatAddress(payment.agent_address)}
                                                        </div>
                                                    </div>
                                                    {payment.tx_hash && (
                                                        <a
                                                            href={`https://testnet.cronoscan.com/tx/${payment.tx_hash}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-orange-500 hover:text-orange-600"
                                                        >
                                                            <ExternalLink className="w-4 h-4" />
                                                        </a>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-8 text-center text-gray-500">
                                <ArrowRightLeft className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                <p>Select a session to view details</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* How it Works */}
                <div className="mt-12 bg-white rounded-xl border border-gray-200 p-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">How x402 Sessions Work</h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="text-center">
                            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Plus className="w-6 h-6 text-orange-600" />
                            </div>
                            <h3 className="font-semibold mb-1">1. Create Session</h3>
                            <p className="text-sm text-gray-500">Create session with budget and duration</p>
                        </div>
                        <div className="text-center">
                            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Wallet className="w-6 h-6 text-blue-600" />
                            </div>
                            <h3 className="font-semibold mb-1">2. Pay via x402</h3>
                            <p className="text-sm text-gray-500">Pay Relay once (gasless) to activate session</p>
                        </div>
                        <div className="text-center">
                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Zap className="w-6 h-6 text-green-600" />
                            </div>
                            <h3 className="font-semibold mb-1">3. Hire Agents</h3>
                            <p className="text-sm text-gray-500">Relay pays agents from session (gasless)</p>
                        </div>
                        <div className="text-center">
                            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <CheckCircle2 className="w-6 h-6 text-purple-600" />
                            </div>
                            <h3 className="font-semibold mb-1">4. Auto-Refund</h3>
                            <p className="text-sm text-gray-500">Remaining balance refunded via x402 (gasless)</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
