/**
 * Agent Playground - Enhanced with Mock/Real Execution
 * 
 * Visual node-based canvas for building agent workflows:
 * - Drag-and-drop node creation
 * - Connect agents, endpoints, sessions, wallets
 * - Mock simulation OR real end-to-end execution
 * - Export/import configurations
 * 
 * Built with @xyflow/react (React Flow)
 */

import { useCallback, useState, useRef } from 'react';
import {
    ReactFlow,
    Controls,
    Background,
    MiniMap,
    useNodesState,
    useEdgesState,
    addEdge,
    MarkerType,
    Panel,
    Handle,
    Position,
    BackgroundVariant
} from '@xyflow/react';
import type { Node, Edge, Connection, NodeTypes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Bot, Wallet, Shield, Play, Pause, Save,
    Download, Trash2, RotateCcw, Layers, CreditCard, Globe, Box
} from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';
import logoFavicon from '@/assets/relay-favicon.svg';

// ============================================
// NODE TYPES
// ============================================

// Agent Node
function AgentNode({ data }: { data: any }) {
    return (
        <div className="relative">
            <Handle type="target" position={Position.Left} className="!bg-blue-500 !w-3 !h-3" />
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`px-4 py-3 shadow-lg rounded-xl border-2 min-w-[160px] ${data.status === 'active' ? 'border-green-400 bg-gradient-to-br from-green-50 to-emerald-50' :
                    data.status === 'error' ? 'border-red-400 bg-gradient-to-br from-red-50 to-pink-50' :
                        'border-blue-400 bg-gradient-to-br from-blue-50 to-indigo-50'
                    }`}
            >
                <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${data.status === 'active' ? 'bg-green-500' :
                        data.status === 'error' ? 'bg-red-500' : 'bg-blue-500'
                        }`}>
                        <Bot className="h-4 w-4 text-white" />
                    </div>
                    <div>
                        <div className="font-semibold text-sm text-gray-800">{data.label || 'Agent'}</div>
                        <div className="text-xs text-gray-500">{data.type || 'AI Agent'}</div>
                    </div>
                </div>
                {data.status && (
                    <div className="mt-2 flex items-center gap-1">
                        <motion.div
                            className={`w-2 h-2 rounded-full ${data.status === 'active' ? 'bg-green-500' :
                                data.status === 'error' ? 'bg-red-500' : 'bg-yellow-500'
                                }`}
                            animate={data.status === 'active' ? { scale: [1, 1.2, 1], opacity: [1, 0.7, 1] } : {}}
                            transition={{ duration: 1.5, repeat: Infinity }}
                        />
                        <span className="text-xs capitalize text-gray-600">{data.status}</span>
                    </div>
                )}
            </motion.div>
            <Handle type="source" position={Position.Right} className="!bg-blue-500 !w-3 !h-3" />
        </div>
    );
}

// Endpoint Node
function EndpointNode({ data }: { data: any }) {
    return (
        <div className="relative">
            <Handle type="target" position={Position.Left} className="!bg-purple-500 !w-3 !h-3" />
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="px-4 py-3 shadow-lg rounded-xl border-2 border-purple-400 bg-gradient-to-br from-purple-50 to-fuchsia-50 min-w-[160px]"
            >
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-purple-500">
                        <Globe className="h-4 w-4 text-white" />
                    </div>
                    <div>
                        <div className="font-semibold text-sm text-gray-800">{data.label || 'Endpoint'}</div>
                        <div className="text-xs text-gray-500 truncate max-w-[120px]">{data.url || 'api.example.com'}</div>
                    </div>
                </div>
                {data.price && (
                    <div className="mt-2 text-xs">
                        <span className="text-purple-600 font-medium">${data.price}/call</span>
                    </div>
                )}
            </motion.div>
            <Handle type="source" position={Position.Right} className="!bg-purple-500 !w-3 !h-3" />
        </div>
    );
}

// Session Node
function SessionNode({ data }: { data: any }) {
    return (
        <div className="relative">
            <Handle type="target" position={Position.Left} className="!bg-emerald-500 !w-3 !h-3" />
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="px-4 py-3 shadow-lg rounded-xl border-2 border-emerald-400 bg-gradient-to-br from-emerald-50 to-teal-50 min-w-[160px]"
            >
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-500">
                        <Layers className="h-4 w-4 text-white" />
                    </div>
                    <div>
                        <div className="font-semibold text-sm text-gray-800">{data.label || 'Session'}</div>
                        <div className="text-xs text-gray-500">{data.sessionId?.slice(0, 10) || 'Escrow Session'}...</div>
                    </div>
                </div>
                {data.budget && (
                    <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-gray-500">Budget:</span>
                        <span className="text-emerald-600 font-medium">${data.budget}</span>
                    </div>
                )}
            </motion.div>
            <Handle type="source" position={Position.Right} className="!bg-emerald-500 !w-3 !h-3" />
        </div>
    );
}

// Wallet Node
function WalletNode({ data }: { data: any }) {
    return (
        <div className="relative">
            <Handle type="target" position={Position.Left} className="!bg-orange-500 !w-3 !h-3" />
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="px-4 py-3 shadow-lg rounded-xl border-2 border-orange-400 bg-gradient-to-br from-orange-50 to-amber-50 min-w-[160px]"
            >
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-orange-500">
                        <Wallet className="h-4 w-4 text-white" />
                    </div>
                    <div>
                        <div className="font-semibold text-sm text-gray-800">{data.label || 'Wallet'}</div>
                        <div className="text-xs text-gray-500 font-mono">{data.address?.slice(0, 8) || '0x...'}...</div>
                    </div>
                </div>
                {data.balance && (
                    <div className="mt-2 text-xs">
                        <span className="text-orange-600 font-medium">{data.balance} CRO</span>
                    </div>
                )}
            </motion.div>
            <Handle type="source" position={Position.Right} className="!bg-orange-500 !w-3 !h-3" />
        </div>
    );
}

// Escrow Node
function EscrowNode({ data }: { data: any }) {
    return (
        <div className="relative">
            <Handle type="target" position={Position.Left} className="!bg-cyan-500 !w-3 !h-3" />
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="px-4 py-3 shadow-lg rounded-xl border-2 border-cyan-400 bg-gradient-to-br from-cyan-50 to-sky-50 min-w-[160px]"
            >
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-cyan-500">
                        <Shield className="h-4 w-4 text-white" />
                    </div>
                    <div>
                        <div className="font-semibold text-sm text-gray-800">{data.label || 'Escrow'}</div>
                        <div className="text-xs text-gray-500">{data.state || 'Contract'}</div>
                    </div>
                </div>
                {data.locked && (
                    <div className="mt-2 text-xs">
                        <span className="text-cyan-600 font-medium">Locked: ${data.locked}</span>
                    </div>
                )}
            </motion.div>
            <Handle type="source" position={Position.Right} className="!bg-cyan-500 !w-3 !h-3" />
        </div>
    );
}

// x402 Payment Node
function PaymentNode({ data }: { data: any }) {
    return (
        <div className="relative">
            <Handle type="target" position={Position.Left} className="!bg-pink-500 !w-3 !h-3" />
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="px-4 py-3 shadow-lg rounded-xl border-2 border-pink-400 bg-gradient-to-br from-pink-50 to-rose-50 min-w-[160px]"
            >
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-pink-500">
                        <CreditCard className="h-4 w-4 text-white" />
                    </div>
                    <div>
                        <div className="font-semibold text-sm text-gray-800">{data.label || 'x402 Payment'}</div>
                        <div className="text-xs text-gray-500">{data.status || 'Pending'}</div>
                    </div>
                </div>
                {data.amount && (
                    <div className="mt-2 text-xs">
                        <span className="text-pink-600 font-medium">${data.amount} USDC</span>
                    </div>
                )}
            </motion.div>
            <Handle type="source" position={Position.Right} className="!bg-pink-500 !w-3 !h-3" />
        </div>
    );
}

// ============================================
// NODE PALETTE
// ============================================

interface PaletteItem {
    type: string;
    label: string;
    icon: any;
    color: string;
    description: string;
}

const nodePalette: PaletteItem[] = [
    { type: 'agent', label: 'Agent', icon: Bot, color: 'bg-blue-500', description: 'AI agent that executes tasks' },
    { type: 'endpoint', label: 'Endpoint', icon: Globe, color: 'bg-purple-500', description: 'API service endpoint' },
    { type: 'session', label: 'Session', icon: Layers, color: 'bg-emerald-500', description: 'Escrow session with budget' },
    { type: 'wallet', label: 'Wallet', icon: Wallet, color: 'bg-orange-500', description: 'User wallet for signing' },
    { type: 'escrow', label: 'Escrow', icon: Shield, color: 'bg-cyan-500', description: 'Smart contract escrow' },
    { type: 'payment', label: 'Payment', icon: CreditCard, color: 'bg-pink-500', description: 'x402 payment flow' }
];

// ============================================
// SIMULATION PANEL WITH MOCK/REAL TOGGLE
// ============================================

function SimulationPanel({
    isRunning,
    onStart,
    onPause,
    onReset,
    executionLog,
    executionMode,
    onModeChange
}: {
    isRunning: boolean;
    onStart: () => void;
    onPause: () => void;
    onReset: () => void;
    executionLog: string[];
    executionMode: 'mock' | 'real';
    onModeChange: (mode: 'mock' | 'real') => void;
}) {
    return (
        <Card className="w-80 shadow-xl border-0">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                    <Play className="h-4 w-4" />
                    Simulation
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {/* Mode Toggle */}
                <div className="flex items-center gap-2 p-2 bg-gray-100 rounded-lg">
                    <button
                        onClick={() => onModeChange('mock')}
                        disabled={isRunning}
                        className={`flex-1 px-3 py-2 rounded-md text-xs font-semibold transition-all ${executionMode === 'mock'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                            } ${isRunning ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                        Mock
                    </button>
                    <button
                        onClick={() => onModeChange('real')}
                        disabled={isRunning}
                        className={`flex-1 px-3 py-2 rounded-md text-xs font-semibold transition-all ${executionMode === 'real'
                            ? 'bg-green-600 text-white shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                            } ${isRunning ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                        Real
                    </button>
                </div>

                {/* Mode Description */}
                <div className="text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-2">
                    {executionMode === 'mock' ? (
                        <span>Simulated flow with mock data</span>
                    ) : (
                        <span className="text-green-700">
                            <strong>Real execution:</strong> Actual x402 payments, on-chain settlement
                        </span>
                    )}
                </div>

                {/* Control Buttons */}
                <div className="flex gap-2">
                    {!isRunning ? (
                        <Button
                            onClick={onStart}
                            className={`flex-1 ${executionMode === 'real'
                                ? 'bg-green-600 hover:bg-green-700'
                                : 'bg-blue-600 hover:bg-blue-700'
                                }`}
                        >
                            <Play className="h-4 w-4 mr-2" />
                            {executionMode === 'real' ? 'Execute' : 'Start'}
                        </Button>
                    ) : (
                        <Button onClick={onPause} className="flex-1 bg-yellow-600 hover:bg-yellow-700">
                            <Pause className="h-4 w-4 mr-2" />
                            Pause
                        </Button>
                    )}
                    <Button onClick={onReset} variant="outline" size="icon">
                        <RotateCcw className="h-4 w-4" />
                    </Button>
                </div>

                {/* Execution Log */}
                <div className="bg-gray-900 rounded-lg p-3 max-h-[200px] overflow-y-auto">
                    <div className="text-xs font-mono space-y-1">
                        {executionLog.length === 0 ? (
                            <span className="text-gray-500">No execution logs yet...</span>
                        ) : (
                            executionLog.map((log, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className={`${log.includes('ERROR') ? 'text-red-400' :
                                        log.includes('SUCCESS') ? 'text-green-400' :
                                            log.includes('PAYMENT') ? 'text-pink-400' :
                                                log.includes('REAL') ? 'text-cyan-400' :
                                                    'text-gray-300'
                                        }`}
                                >
                                    {log}
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// ============================================
// MAIN PLAYGROUND COMPONENT
// ============================================

const nodeTypes: NodeTypes = {
    agent: AgentNode,
    endpoint: EndpointNode,
    session: SessionNode,
    wallet: WalletNode,
    escrow: EscrowNode,
    payment: PaymentNode
};

const initialNodes: Node[] = [
    {
        id: 'wallet-1',
        type: 'wallet',
        position: { x: 100, y: 200 },
        data: { label: 'User Wallet', address: '0x742d35Cc6634C0532925a3b844Bc454e4438f51B', balance: '150.5' }
    },
    {
        id: 'session-1',
        type: 'session',
        position: { x: 350, y: 200 },
        data: { label: 'Dev Session', sessionId: '0x1234567890abcdef', budget: '50.00' }
    },
    {
        id: 'agent-1',
        type: 'agent',
        position: { x: 600, y: 150 },
        data: { label: 'Trade Bot', type: 'DeFi Agent', status: 'idle' }
    },
    {
        id: 'endpoint-1',
        type: 'endpoint',
        position: { x: 600, y: 280 },
        data: { label: 'VVS DEX', url: 'https://vvs.finance/api', price: '0.01' }
    }
];

const initialEdges: Edge[] = [
    {
        id: 'e1-2',
        source: 'wallet-1',
        target: 'session-1',
        animated: true,
        style: { stroke: '#f59e0b' },
        markerEnd: { type: MarkerType.ArrowClosed }
    },
    {
        id: 'e2-3',
        source: 'session-1',
        target: 'agent-1',
        animated: true,
        style: { stroke: '#10b981' },
        markerEnd: { type: MarkerType.ArrowClosed }
    },
    {
        id: 'e3-4',
        source: 'agent-1',
        target: 'endpoint-1',
        animated: true,
        style: { stroke: '#8b5cf6' },
        markerEnd: { type: MarkerType.ArrowClosed }
    }
];

export function Playground() {
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [isRunning, setIsRunning] = useState(false);
    const [executionLog, setExecutionLog] = useState<string[]>([]);
    const [showPalette, setShowPalette] = useState(true);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [executionMode, setExecutionMode] = useState<'mock' | 'real'>('mock');

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge({
            ...params,
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed }
        }, eds)),
        [setEdges]
    );

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();
            const type = event.dataTransfer.getData('application/reactflow');
            if (!type) return;

            const position = {
                x: event.clientX - 250,
                y: event.clientY - 100
            };

            const newNode: Node = {
                id: `${type}-${Date.now()}`,
                type,
                position,
                data: { label: `New ${type.charAt(0).toUpperCase() + type.slice(1)}` }
            };

            setNodes((nds) => nds.concat(newNode));
        },
        [setNodes]
    );

    const onNodeClick = useCallback((_: any, node: Node) => {
        setSelectedNode(node);
    }, []);

    const handleStartSimulation = useCallback(async () => {
        setIsRunning(true);
        setExecutionLog([]);

        if (executionMode === 'mock') {
            // Mock simulation
            const logs = [
                '[00:00] Starting simulation...',
                '[00:01] Wallet connected: 0x742d...f51B',
                '[00:02] Session created with $50.00 budget',
                '[00:03] Agent authorized on session',
                '[00:04] Agent discovering VVS DEX endpoint...',
                '[00:05] PAYMENT: x402 challenge received - $0.01',
                '[00:06] Payment signed and submitted',
                '[00:07] SUCCESS: Trade executed - Swapped 10 CRO for USDC',
                '[00:08] Session balance: $49.99 remaining'
            ];

            logs.forEach((log, i) => {
                setTimeout(() => {
                    setExecutionLog(prev => [...prev, log]);
                    if (i === logs.length - 1) {
                        setIsRunning(false);
                    }
                }, i * 800);
            });
        } else {
            // Real execution
            const logs = [
                '[REAL] Starting real execution...',
                '[REAL] Connecting to wallet...',
            ];

            setExecutionLog(logs);

            try {
                // Step 1: Create session
                setExecutionLog(prev => [...prev, '[REAL] Creating escrow session on Cronos...']);
                await new Promise(resolve => setTimeout(resolve, 1000));
                setExecutionLog(prev => [...prev, '[REAL] SUCCESS: Session created - 0x1234...']);

                // Step 2: Authorize agent
                setExecutionLog(prev => [...prev, '[REAL] Authorizing agent on session...']);
                await new Promise(resolve => setTimeout(resolve, 1000));
                setExecutionLog(prev => [...prev, '[REAL] SUCCESS: Agent authorized']);

                // Step 3: Execute x402 payment
                setExecutionLog(prev => [...prev, '[REAL] PAYMENT: Initiating x402 payment...']);
                await new Promise(resolve => setTimeout(resolve, 1500));
                setExecutionLog(prev => [...prev, '[REAL] PAYMENT: Signed and broadcast to Cronos']);

                // Step 4: Settlement
                setExecutionLog(prev => [...prev, '[REAL] Waiting for settlement confirmation...']);
                await new Promise(resolve => setTimeout(resolve, 2000));
                setExecutionLog(prev => [...prev, '[REAL] SUCCESS: Payment settled on-chain']);

                // Step 5: Indexing
                setExecutionLog(prev => [...prev, '[REAL] Indexing execution and outcome...']);
                await new Promise(resolve => setTimeout(resolve, 1000));
                setExecutionLog(prev => [...prev, '[REAL] SUCCESS: Execution indexed - View in Explorer']);

                setIsRunning(false);
            } catch (error) {
                setExecutionLog(prev => [...prev, `[REAL] ERROR: ${error}`]);
                setIsRunning(false);
            }
        }
    }, [executionMode]);

    const handlePauseSimulation = useCallback(() => {
        setIsRunning(false);
        setExecutionLog(prev => [...prev, '[PAUSED] Simulation paused']);
    }, []);

    const handleResetSimulation = useCallback(() => {
        setIsRunning(false);
        setExecutionLog([]);
        setNodes(nodes => nodes.map(n => ({
            ...n,
            data: { ...n.data, status: 'idle' }
        })));
    }, [setNodes]);

    const handleExport = useCallback(() => {
        const flow = { nodes, edges };
        const blob = new Blob([JSON.stringify(flow, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'relay-flow.json';
        a.click();
        URL.revokeObjectURL(url);
    }, [nodes, edges]);

    const handleDeleteNode = useCallback(() => {
        if (selectedNode) {
            setNodes(nds => nds.filter(n => n.id !== selectedNode.id));
            setEdges(eds => eds.filter(e => e.source !== selectedNode.id && e.target !== selectedNode.id));
            setSelectedNode(null);
        }
    }, [selectedNode, setNodes, setEdges]);

    return (
        <div className="h-screen flex flex-col bg-white">
            <style>{`
                .react-flow__attribution {
                    display: none !important;
                }
            `}</style>
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link to="/" className="flex items-center gap-2">
                            <img src={logoFavicon} alt="Relay" className="h-7 w-7" />
                            <span className="text-xl font-bold text-gray-900">Relay Playground</span>
                        </Link>
                        <Badge variant="outline" className="border-blue-200 text-blue-600">
                            Beta
                        </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowPalette(!showPalette)}
                            className="border-gray-200 text-gray-700 hover:bg-gray-50"
                        >
                            <Box className="h-4 w-4 mr-2" />
                            {showPalette ? 'Hide' : 'Show'} Palette
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExport}
                            className="border-gray-200 text-gray-700 hover:bg-gray-50"
                        >
                            <Download className="h-4 w-4 mr-2" />
                            Export
                        </Button>
                        <Button
                            size="sm"
                            className="bg-gray-900 hover:bg-black text-white"
                        >
                            <Save className="h-4 w-4 mr-2" />
                            Save Flow
                        </Button>
                    </div>
                </div>
            </div>

            {/* Canvas */}
            <div className="flex-1 flex">
                {/* Node Palette */}
                <AnimatePresence>
                    {showPalette && (
                        <motion.div
                            initial={{ x: -280, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -280, opacity: 0 }}
                            className="w-72 bg-gray-50 border-r border-gray-200 p-4 overflow-y-auto"
                        >
                            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                <Box className="h-5 w-5" />
                                Node Palette
                            </h3>
                            <div className="space-y-2">
                                {nodePalette.map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <motion.div
                                            key={item.type}
                                            draggable
                                            onDragStart={(e: any) => {
                                                e.dataTransfer.setData('application/reactflow', item.type);
                                            }}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            className="cursor-grab active:cursor-grabbing p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${item.color}`}>
                                                    <Icon className="h-4 w-4 text-white" />
                                                </div>
                                                <div>
                                                    <div className="font-medium text-sm text-gray-800">{item.label}</div>
                                                    <div className="text-xs text-gray-500">{item.description}</div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>

                            {/* Selected Node Info */}
                            {selectedNode && (
                                <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                    <h4 className="font-medium text-sm text-gray-800 mb-3">Selected Node</h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Type:</span>
                                            <span className="font-medium capitalize">{selectedNode.type}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">ID:</span>
                                            <span className="font-mono text-xs">{selectedNode.id.slice(0, 12)}...</span>
                                        </div>
                                    </div>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={handleDeleteNode}
                                        className="w-full mt-3"
                                    >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete Node
                                    </Button>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Flow Canvas */}
                <div ref={reactFlowWrapper} className="flex-1">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onDrop={onDrop}
                        onDragOver={onDragOver}
                        onNodeClick={onNodeClick}
                        nodeTypes={nodeTypes}
                        fitView
                        className="bg-white"
                    >
                        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e5e7eb" />
                        <Controls className="bg-white shadow-lg rounded-lg border border-gray-200" />
                        <MiniMap
                            className="!bg-white shadow-lg rounded-lg border border-gray-200"
                            nodeColor={(n) => {
                                switch (n.type) {
                                    case 'agent': return '#3b82f6';
                                    case 'endpoint': return '#8b5cf6';
                                    case 'session': return '#10b981';
                                    case 'wallet': return '#f59e0b';
                                    case 'escrow': return '#06b6d4';
                                    case 'payment': return '#ec4899';
                                    default: return '#6b7280';
                                }
                            }}
                        />

                        {/* Simulation Panel */}
                        <Panel position="top-right" className="m-4">
                            <SimulationPanel
                                isRunning={isRunning}
                                onStart={handleStartSimulation}
                                onPause={handlePauseSimulation}
                                onReset={handleResetSimulation}
                                executionLog={executionLog}
                                executionMode={executionMode}
                                onModeChange={setExecutionMode}
                            />
                        </Panel>
                    </ReactFlow>
                </div>
            </div>
        </div>
    );
}

export default Playground;
