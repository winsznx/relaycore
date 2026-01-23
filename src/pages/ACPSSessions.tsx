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
    Zap,
    AlertCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { CreateSessionModal } from '@/components/CreateSessionModal';
import { useAppKitAccount } from '@reown/appkit/react';

interface Session {
    session_id: string;
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
    is_active: boolean;
}

interface Payment {
    id: string;
    session_id: string;
    agent_address: string;
    agent_name?: string;
    amount: string;
    execution_id: string;
    tx_hash: string;
    created_at: string;
    status?: string;
}

interface AgentInfo {
    address: string;
    name: string;
    totalSpent: number;
    paymentCount: number;
}

export default function ACPSSessions() {
    const { address, isConnected } = useAppKitAccount();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [sessionAgents, setSessionAgents] = useState<AgentInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSession, setSelectedSession] = useState<Session | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);

    useEffect(() => {
        if (isConnected && address) {
            loadSessions();
        } else {
            setSessions([]);
            setLoading(false);
        }
    }, [isConnected, address]);

    async function loadSessions() {
        if (!address) return;

        setLoading(true);
        const { data } = await supabase
            .from('escrow_sessions')
            .select('*')
            .eq('owner_address', address.toLowerCase())
            .order('created_at', { ascending: false })
            .limit(20);

        // Map 'released' column to 'spent' for display
        const mappedSessions = (data || []).map((s: any) => ({
            ...s,
            spent: s.released || s.spent || '0'
        }));
        setSessions(mappedSessions);
        setLoading(false);
    }

    async function loadPayments(sessionId: string) {
        const { data } = await supabase
            .from('session_payments')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: false });

        setPayments(data || []);

        // Derive agent info from payments
        const agentMap = new Map<string, AgentInfo>();
        (data || []).forEach((payment: Payment) => {
            const existing = agentMap.get(payment.agent_address.toLowerCase());
            if (existing) {
                existing.totalSpent += parseFloat(payment.amount) || 0;
                existing.paymentCount += 1;
            } else {
                agentMap.set(payment.agent_address.toLowerCase(), {
                    address: payment.agent_address,
                    name: payment.agent_name || payment.agent_address,
                    totalSpent: parseFloat(payment.amount) || 0,
                    paymentCount: 1
                });
            }
        });
        setSessionAgents(Array.from(agentMap.values()));
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

    // Show connect wallet message if not connected
    if (!isConnected) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
                <div className="max-w-md mx-auto mt-20">
                    <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
                        <AlertCircle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Connect Wallet</h2>
                        <p className="text-gray-600 mb-6">
                            Connect your wallet to view and manage your x402 payment sessions.
                        </p>
                        <appkit-button />
                    </div>
                </div>
            </div>
        );
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
                            Your gasless payment sessions powered by x402 protocol
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={loadSessions}
                            disabled={!address}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition"
                        >
                            <Plus className="w-4 h-4" />
                            Create Session
                        </button>
                    </div>
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
                            {sessions.filter(s => s.is_active).length}
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
                                    <p className="text-sm mt-1">Click "Create Session" to get started</p>
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
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${session.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                                {session.is_active ? 'Active' : 'Inactive'}
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

                                {/* Agents Used */}
                                <div className="mb-6">
                                    <div className="text-xs text-gray-500 mb-2">Agents Used ({sessionAgents.length})</div>
                                    <div className="space-y-2">
                                        {sessionAgents.map((agent, i) => (
                                            <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                                <div>
                                                    <span className="text-sm font-medium text-gray-900">
                                                        {agent.name !== agent.address ? agent.name : formatAddress(agent.address)}
                                                    </span>
                                                    <div className="text-xs text-gray-500 font-mono">
                                                        {formatAddress(agent.address)}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-sm font-semibold text-orange-600">
                                                        ${agent.totalSpent.toFixed(4)}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {agent.paymentCount} calls
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {sessionAgents.length === 0 && (
                                            <span className="text-gray-400 text-sm">No agents used yet</span>
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

                                {/* Refund Button */}
                                {selectedSession.is_active && parseFloat(selectedSession.max_spend) - parseFloat(selectedSession.spent || '0') > 0 && (
                                    <div className="pt-4 border-t border-gray-100">
                                        <button
                                            onClick={async () => {
                                                if (!confirm(`Refund $${(parseFloat(selectedSession.max_spend) - parseFloat(selectedSession.spent || '0')).toFixed(2)} from this session?`)) return;

                                                try {
                                                    const response = await fetch(`/api/sessions/${selectedSession.session_id}/refund`, {
                                                        method: 'POST',
                                                    });

                                                    if (!response.ok) {
                                                        throw new Error('Refund failed');
                                                    }

                                                    const result = await response.json();
                                                    alert(`Refund successful! ${result.refundAmount} USDC returned.`);
                                                    loadSessions();
                                                    setSelectedSession(null);
                                                } catch (error) {
                                                    alert('Refund failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
                                                }
                                            }}
                                            className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
                                        >
                                            <RefreshCw className="w-4 h-4" />
                                            Refund Remaining Balance
                                        </button>
                                    </div>
                                )}
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

                {/* Create Session Modal */}
                <CreateSessionModal
                    isOpen={showCreateModal}
                    onClose={() => setShowCreateModal(false)}
                    onSuccess={loadSessions}
                />
            </div>
        </div>
    );
}
