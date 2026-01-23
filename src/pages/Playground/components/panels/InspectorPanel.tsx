/**
 * Inspector Panel
 * Right sidebar showing detailed information about selected node
 */

import { X, Copy, Download, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { PlaygroundNode, ExecutionLogEntry } from '../types/playground.types';

export interface InspectorPanelProps {
    selectedNode: PlaygroundNode | null;
    executionLog: ExecutionLogEntry[];
    onClose: () => void;
}

export function InspectorPanel({ selectedNode, executionLog, onClose }: InspectorPanelProps) {
    if (!selectedNode) return null;

    const nodeLog = executionLog.filter(entry => entry.nodeId === selectedNode.id);

    const copyNodeData = () => {
        navigator.clipboard.writeText(JSON.stringify(selectedNode, null, 2));
    };

    const exportNodeData = () => {
        const blob = new Blob([JSON.stringify(selectedNode, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedNode.id}-data.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="w-96 h-full bg-white border-l border-gray-200 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Inspector</h2>
                <Button variant="ghost" size="sm" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Node Info */}
                <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center justify-between">
                            <span>Node Information</span>
                            <Badge variant="outline" className="capitalize">
                                {selectedNode.type}
                            </Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <div>
                            <div className="text-xs text-gray-500">ID</div>
                            <div className="font-mono text-xs text-gray-700 break-all">
                                {selectedNode.id}
                            </div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-500">Label</div>
                            <div className="font-medium text-gray-900">
                                {selectedNode.data.label}
                            </div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-500">Status</div>
                            <Badge
                                variant={
                                    selectedNode.data.status === 'completed' ? 'default' :
                                        selectedNode.data.status === 'failed' ? 'destructive' :
                                            'outline'
                                }
                                className="capitalize"
                            >
                                {selectedNode.data.status}
                            </Badge>
                        </div>
                        <div>
                            <div className="text-xs text-gray-500">Mode</div>
                            <Badge variant="secondary" className="capitalize">
                                {selectedNode.data.executionMode}
                            </Badge>
                        </div>
                    </CardContent>
                </Card>

                {/* Type-Specific Data */}
                {selectedNode.type === 'agent' && selectedNode.data.type === 'agent' && (
                    <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Agent Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <div>
                                <div className="text-xs text-gray-500">Cost Incurred</div>
                                <div className="font-semibold text-gray-900">
                                    ${selectedNode.data.costIncurred.toFixed(4)}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500">Tool Calls</div>
                                <div className="font-semibold text-gray-900">
                                    {selectedNode.data.toolCalls.length}
                                </div>
                            </div>
                            {selectedNode.data.sessionId && (
                                <div>
                                    <div className="text-xs text-gray-500">Session ID</div>
                                    <div className="font-mono text-xs text-gray-700 break-all">
                                        {selectedNode.data.sessionId}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {selectedNode.type === 'x402_gate' && selectedNode.data.type === 'x402_gate' && (
                    <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Payment Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <div>
                                <div className="text-xs text-gray-500">Price</div>
                                <div className="font-semibold text-gray-900">
                                    {selectedNode.data.price} {selectedNode.data.asset}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500">Recipient</div>
                                <div className="font-mono text-xs text-gray-700 break-all">
                                    {selectedNode.data.recipientAddress}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500">Payment Status</div>
                                <Badge
                                    variant={
                                        selectedNode.data.paymentStatus === 'settled' ? 'default' :
                                            selectedNode.data.paymentStatus === 'failed' ? 'destructive' :
                                                'outline'
                                    }
                                    className="capitalize"
                                >
                                    {selectedNode.data.paymentStatus}
                                </Badge>
                            </div>
                            {selectedNode.data.settlementTxHash && (
                                <div>
                                    <div className="text-xs text-gray-500">Transaction Hash</div>
                                    <a
                                        href={`https://cronoscan.com/tx/${selectedNode.data.settlementTxHash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-mono break-all"
                                    >
                                        {selectedNode.data.settlementTxHash.slice(0, 10)}...
                                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                    </a>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {selectedNode.type === 'session' && selectedNode.data.type === 'session' && (
                    <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Session Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <div>
                                <div className="text-xs text-gray-500">Session ID</div>
                                <div className="font-mono text-xs text-gray-700 break-all">
                                    {selectedNode.data.sessionId}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500">Budget Remaining</div>
                                <div className="font-semibold text-emerald-600 text-base">
                                    ${selectedNode.data.remaining.toFixed(2)}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500">Authorized Agents</div>
                                <div className="font-semibold text-gray-900">
                                    {selectedNode.data.authorizedAgents.length}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Execution Log */}
                {nodeLog.length > 0 && (
                    <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Execution Log</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                {nodeLog.map((entry, i) => (
                                    <div
                                        key={i}
                                        className="text-xs p-2 rounded bg-gray-50 border border-gray-100"
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <Badge
                                                variant={
                                                    entry.level === 'success' ? 'default' :
                                                        entry.level === 'error' ? 'destructive' :
                                                            'outline'
                                                }
                                                className="text-xs"
                                            >
                                                {entry.level}
                                            </Badge>
                                            <span className="text-gray-500">
                                                {new Date(entry.timestamp).toLocaleTimeString()}
                                            </span>
                                        </div>
                                        <div className="text-gray-700">{entry.message}</div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={copyNodeData}
                        className="flex-1"
                    >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy JSON
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={exportNodeData}
                        className="flex-1"
                    >
                        <Download className="h-3 w-3 mr-1" />
                        Export
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default InspectorPanel;
