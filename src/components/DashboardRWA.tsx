/**
 * DashboardRWA - Production-grade RWA management interface
 * 
 * Features:
 * - Create RWA state machines
 * - View RWA lifecycle
 * - Trigger state transitions with x402 payment
 * - Multi-agent coordination
 * - Complete audit trail
 */

import { useState, useEffect } from 'react';
import { useAppKitAccount } from '@reown/appkit/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RWAStateMachine } from './RWAStateMachine';
import {
    FileText, Plus, Search,
    Activity, Clock, CheckCircle2, AlertCircle,
    Play, DollarSign, Loader2
} from 'lucide-react';

interface RWA {
    rwaId: string;
    currentState: string;
    previousState: string | null;
    createdAt: string;
    updatedAt: string;
    transitionCount: number;
    lastAgent?: string;
    metadata?: Record<string, unknown>;
}

export function DashboardRWA() {
    const { isConnected } = useAppKitAccount();
    const [rwas, setRwas] = useState<RWA[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRWA, setSelectedRWA] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterState, setFilterState] = useState<string>('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newRWAId, setNewRWAId] = useState('');
    const [newRWAMetadata, setNewRWAMetadata] = useState('{}');

    // Execute/Settle modal state
    const [showExecuteModal, setShowExecuteModal] = useState(false);
    const [showSettleModal, setShowSettleModal] = useState(false);
    const [executeForm, setExecuteForm] = useState({
        serviceId: '',
        sessionId: '',
        agentAddress: '',
        input: '{}'
    });
    const [settleForm, setSettleForm] = useState({
        requestId: '',
        result: '{}'
    });
    const [executePending, setExecutePending] = useState(false);
    const [settlePending, setSettlePending] = useState(false);
    const [executionResult, setExecutionResult] = useState<any>(null);
    const [settlementResult, setSettlementResult] = useState<any>(null);

    useEffect(() => {
        if (isConnected) {
            fetchRWAs();
        }
    }, [isConnected]);

    const fetchRWAs = async () => {
        try {
            setLoading(true);
            setLoading(true);
            const apiUrl = import.meta.env.VITE_API_URL || 'https://api.relaycore.xyz';
            const response = await fetch(`${apiUrl}/api/rwa/state-machines`);
            if (response.ok) {
                const data = await response.json();
                setRwas(data.stateMachines || []);
            }
        } catch (error) {
            console.error('Failed to fetch RWAs:', error);
        } finally {
            setLoading(false);
        }
    };

    const createRWA = async () => {
        if (!newRWAId.trim()) return;

        try {
            let metadata = {};
            try {
                metadata = JSON.parse(newRWAMetadata);
            } catch {
                metadata = { description: newRWAMetadata };
            }

            const apiUrl = import.meta.env.VITE_API_URL || 'https://api.relaycore.xyz';
            const response = await fetch(`${apiUrl}/api/rwa/state-machine/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rwaId: newRWAId,
                    metadata
                })
            });

            if (response.ok) {
                setShowCreateModal(false);
                setNewRWAId('');
                setNewRWAMetadata('{}');
                fetchRWAs();
            }
        } catch (error) {
            console.error('Failed to create RWA:', error);
        }
    };

    const executeService = async () => {
        if (!executeForm.serviceId || !executeForm.sessionId || !executeForm.agentAddress) {
            return;
        }

        setExecutePending(true);
        setExecutionResult(null);

        try {
            let input = {};
            try {
                input = JSON.parse(executeForm.input);
            } catch {
                input = { raw: executeForm.input };
            }

            const apiUrl = import.meta.env.VITE_API_URL || 'https://api.relaycore.xyz';
            const response = await fetch(`${apiUrl}/api/rwa/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serviceId: executeForm.serviceId,
                    sessionId: executeForm.sessionId,
                    agentAddress: executeForm.agentAddress,
                    input
                })
            });

            const data = await response.json();

            if (response.ok) {
                setExecutionResult({
                    success: true,
                    ...data.settlement
                });
                // Pre-fill settle form with requestId
                setSettleForm(prev => ({
                    ...prev,
                    requestId: data.settlement?.requestId || ''
                }));
            } else {
                setExecutionResult({
                    success: false,
                    error: data.error || 'Execution failed'
                });
            }
        } catch (error) {
            console.error('Failed to execute service:', error);
            setExecutionResult({
                success: false,
                error: 'Network error'
            });
        } finally {
            setExecutePending(false);
        }
    };

    const settleExecution = async () => {
        if (!settleForm.requestId) {
            return;
        }

        setSettlePending(true);
        setSettlementResult(null);

        try {
            let result = {};
            try {
                result = JSON.parse(settleForm.result);
            } catch {
                result = { raw: settleForm.result };
            }

            const apiUrl = import.meta.env.VITE_API_URL || 'https://api.relaycore.xyz';
            const response = await fetch(`${apiUrl}/api/rwa/settle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requestId: settleForm.requestId,
                    proof: {
                        timestamp: Date.now(),
                        result
                    }
                })
            });

            const data = await response.json();

            if (response.ok) {
                setSettlementResult({
                    success: true,
                    ...data.settlement
                });
            } else {
                setSettlementResult({
                    success: false,
                    error: data.error || 'Settlement failed'
                });
            }
        } catch (error) {
            console.error('Failed to settle execution:', error);
            setSettlementResult({
                success: false,
                error: 'Network error'
            });
        } finally {
            setSettlePending(false);
        }
    };

    const filteredRWAs = rwas.filter(rwa => {
        const matchesSearch = rwa.rwaId.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter = filterState === 'all' || rwa.currentState === filterState;
        return matchesSearch && matchesFilter;
    });

    const stateCounts = rwas.reduce((acc, rwa) => {
        acc[rwa.currentState] = (acc[rwa.currentState] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    if (!isConnected) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Card className="max-w-md">
                    <CardContent className="pt-6 text-center">
                        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                        <h3 className="text-lg font-semibold mb-2">Connect Wallet</h3>
                        <p className="text-gray-600">
                            Connect your wallet to manage RWA state machines
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (selectedRWA) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <Button
                        variant="outline"
                        onClick={() => setSelectedRWA(null)}
                    >
                        ← Back to RWAs
                    </Button>
                </div>
                <RWAStateMachine
                    rwaId={selectedRWA}
                    onTransition={() => {
                        fetchRWAs();
                    }}
                />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">RWA State Machines</h2>
                    <p className="text-gray-600 mt-1">
                        Manage real-world asset lifecycles with x402 payment enforcement
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => setShowExecuteModal(true)} variant="outline">
                        <Play className="w-4 h-4 mr-2" />
                        Execute Service
                    </Button>
                    <Button onClick={() => setShowSettleModal(true)} variant="outline">
                        <DollarSign className="w-4 h-4 mr-2" />
                        Settle Execution
                    </Button>
                    <Button onClick={() => setShowCreateModal(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Create RWA
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Total RWAs</p>
                                <p className="text-2xl font-bold">{rwas.length}</p>
                            </div>
                            <FileText className="w-8 h-8 text-blue-500" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Active</p>
                                <p className="text-2xl font-bold">
                                    {(stateCounts.verified || 0) + (stateCounts.escrowed || 0) + (stateCounts.in_process || 0)}
                                </p>
                            </div>
                            <Activity className="w-8 h-8 text-green-500" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Settled</p>
                                <p className="text-2xl font-bold">{stateCounts.settled || 0}</p>
                            </div>
                            <CheckCircle2 className="w-8 h-8 text-purple-500" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Disputed</p>
                                <p className="text-2xl font-bold">{stateCounts.disputed || 0}</p>
                            </div>
                            <AlertCircle className="w-8 h-8 text-red-500" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>RWA List</CardTitle>
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <Input
                                    placeholder="Search RWAs..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10 w-64"
                                />
                            </div>
                            <select
                                value={filterState}
                                onChange={(e) => setFilterState(e.target.value)}
                                className="px-3 py-2 border rounded-md"
                            >
                                <option value="all">All States</option>
                                <option value="created">Created</option>
                                <option value="verified">Verified</option>
                                <option value="escrowed">Escrowed</option>
                                <option value="in_process">In Process</option>
                                <option value="fulfilled">Fulfilled</option>
                                <option value="settled">Settled</option>
                                <option value="disputed">Disputed</option>
                            </select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                            <p className="mt-4 text-gray-600">Loading RWAs...</p>
                        </div>
                    ) : filteredRWAs.length === 0 ? (
                        <div className="text-center py-12">
                            <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                            <p className="text-gray-600">No RWAs found</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredRWAs.map((rwa) => (
                                <div
                                    key={rwa.rwaId}
                                    onClick={() => setSelectedRWA(rwa.rwaId)}
                                    className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3">
                                                <h3 className="font-semibold">{rwa.rwaId}</h3>
                                                <Badge variant="outline" className={getStateBadgeClass(rwa.currentState)}>
                                                    {rwa.currentState}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-4 h-4" />
                                                    {new Date(rwa.updatedAt).toLocaleDateString()}
                                                </span>
                                                <span>{rwa.transitionCount} transitions</span>
                                                {rwa.lastAgent && (
                                                    <span>Last: {rwa.lastAgent.slice(0, 8)}...</span>
                                                )}
                                            </div>
                                        </div>
                                        <Button variant="outline" size="sm">
                                            View Details
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card className="w-full max-w-md">
                        <CardHeader>
                            <CardTitle>Create New RWA</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">RWA ID</label>
                                <Input
                                    placeholder="e.g., invoice_12345"
                                    value={newRWAId}
                                    onChange={(e) => setNewRWAId(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Metadata (JSON)</label>
                                <textarea
                                    className="w-full px-3 py-2 border rounded-md"
                                    rows={4}
                                    placeholder='{"assetType": "invoice", "value": "1000"}'
                                    value={newRWAMetadata}
                                    onChange={(e) => setNewRWAMetadata(e.target.value)}
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={createRWA} className="flex-1">
                                    Create
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        setNewRWAId('');
                                        setNewRWAMetadata('{}');
                                    }}
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {showExecuteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card className="w-full max-w-lg">
                        <CardHeader>
                            <CardTitle>Execute RWA Service</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Service ID</label>
                                <Input
                                    placeholder="e.g., compliance_check"
                                    value={executeForm.serviceId}
                                    onChange={(e) => setExecuteForm(prev => ({ ...prev, serviceId: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Session ID</label>
                                <Input
                                    placeholder="e.g., session_123456"
                                    value={executeForm.sessionId}
                                    onChange={(e) => setExecuteForm(prev => ({ ...prev, sessionId: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Agent Address</label>
                                <Input
                                    placeholder="0x..."
                                    value={executeForm.agentAddress}
                                    onChange={(e) => setExecuteForm(prev => ({ ...prev, agentAddress: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Input (JSON)</label>
                                <textarea
                                    className="w-full px-3 py-2 border rounded-md"
                                    rows={3}
                                    placeholder='{"documentId": "doc_123"}'
                                    value={executeForm.input}
                                    onChange={(e) => setExecuteForm(prev => ({ ...prev, input: e.target.value }))}
                                />
                            </div>
                            {executionResult && (
                                <div className={`p-3 rounded-lg ${executionResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                                    {executionResult.success ? (
                                        <div className="space-y-1">
                                            <p className="font-medium text-green-700">Execution Started</p>
                                            <p className="text-sm text-green-600">Request ID: {executionResult.requestId}</p>
                                            <p className="text-sm text-green-600">Price: {executionResult.price} USDC</p>
                                        </div>
                                    ) : (
                                        <p className="text-red-700">{executionResult.error}</p>
                                    )}
                                </div>
                            )}
                            <div className="flex gap-2">
                                <Button onClick={executeService} className="flex-1" disabled={executePending}>
                                    {executePending ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Executing...
                                        </>
                                    ) : (
                                        <>
                                            <Play className="w-4 h-4 mr-2" />
                                            Execute
                                        </>
                                    )}
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setShowExecuteModal(false);
                                        setExecutionResult(null);
                                    }}
                                    className="flex-1"
                                >
                                    Close
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {showSettleModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card className="w-full max-w-lg">
                        <CardHeader>
                            <CardTitle>Settle RWA Execution</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Request ID</label>
                                <Input
                                    placeholder="e.g., req_1234567890_abc123"
                                    value={settleForm.requestId}
                                    onChange={(e) => setSettleForm(prev => ({ ...prev, requestId: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Result (JSON)</label>
                                <textarea
                                    className="w-full px-3 py-2 border rounded-md"
                                    rows={4}
                                    placeholder='{"status": "completed", "data": {}}'
                                    value={settleForm.result}
                                    onChange={(e) => setSettleForm(prev => ({ ...prev, result: e.target.value }))}
                                />
                            </div>
                            {settlementResult && (
                                <div className={`p-3 rounded-lg ${settlementResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                                    {settlementResult.success ? (
                                        <div className="space-y-1">
                                            <p className="font-medium text-green-700">Settlement Complete</p>
                                            <p className="text-sm text-green-600">Status: {settlementResult.status}</p>
                                            <p className="text-sm text-green-600">Price: {settlementResult.price} USDC</p>
                                            {settlementResult.slaMetrics && (
                                                <p className="text-sm text-green-600">
                                                    SLA: {settlementResult.slaMetrics.latencyMs}ms latency
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-red-700">{settlementResult.error}</p>
                                    )}
                                </div>
                            )}
                            <div className="flex gap-2">
                                <Button onClick={settleExecution} className="flex-1" disabled={settlePending}>
                                    {settlePending ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Settling...
                                        </>
                                    ) : (
                                        <>
                                            <DollarSign className="w-4 h-4 mr-2" />
                                            Settle
                                        </>
                                    )}
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setShowSettleModal(false);
                                        setSettlementResult(null);
                                    }}
                                    className="flex-1"
                                >
                                    Close
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}

function getStateBadgeClass(state: string): string {
    const classes: Record<string, string> = {
        created: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
        verified: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
        escrowed: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
        in_process: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
        fulfilled: 'bg-green-500/10 text-green-600 border-green-500/20',
        settled: 'bg-green-600/10 text-green-700 border-green-600/20',
        disputed: 'bg-red-500/10 text-red-600 border-red-500/20',
    };
    return classes[state] || '';
}
