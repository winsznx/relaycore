import { useCallback, useState } from 'react';
import {
    ReactFlow,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    MarkerType,
    BackgroundVariant
} from '@xyflow/react';
import type { Node, Edge, Connection, NodeTypes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Play, Trash2, Eye, EyeOff, Activity, Wallet as WalletIcon
} from 'lucide-react';
import logoFavicon from '@/assets/relay-favicon.svg';

import { AgentNode } from './Playground/components/nodes/AgentNode';
import { SessionNode } from './Playground/components/nodes/SessionNode';
import { WalletNode } from './Playground/components/nodes/WalletNode';
import { IndexerNode } from './Playground/components/nodes/IndexerNode';
import { EndpointNode } from './Playground/components/nodes/EndpointNode';
import { X402Step1Node } from './Playground/components/nodes/X402Step1Node';
import { X402Step2Node } from './Playground/components/nodes/X402Step2Node';
import { X402Step3Node } from './Playground/components/nodes/X402Step3Node';
import { X402Step4Node } from './Playground/components/nodes/X402Step4Node';
import { X402Step5Node } from './Playground/components/nodes/X402Step5Node';
import { X402Step6Node } from './Playground/components/nodes/X402Step6Node';
import { X402Step7Node } from './Playground/components/nodes/X402Step7Node';
import { X402Step8Node } from './Playground/components/nodes/X402Step8Node';
import { X402Step9Node } from './Playground/components/nodes/X402Step9Node';
import { ServiceAgentDiscoveryNode } from './Playground/components/nodes/ServiceAgentDiscoveryNode';
import { ServiceSessionManagerNode } from './Playground/components/nodes/ServiceSessionManagerNode';
import { ServiceDexAggregatorNode } from './Playground/components/nodes/ServiceDexAggregatorNode';
import { ServiceRwaSettlementNode } from './Playground/components/nodes/ServiceRwaSettlementNode';
import { ServiceMetaAgentNode } from './Playground/components/nodes/ServiceMetaAgentNode';
import { ServicePaymentIndexerNode } from './Playground/components/nodes/ServicePaymentIndexerNode';
import { ServiceAgentRegistryNode } from './Playground/components/nodes/ServiceAgentRegistryNode';
import { ServiceEscrowNode } from './Playground/components/nodes/ServiceEscrowNode';
import { ServiceTradeRouterNode } from './Playground/components/nodes/ServiceTradeRouterNode';
import { ServicePythOracleNode } from './Playground/components/nodes/ServicePythOracleNode';
import { ServiceAgentIndexerNode } from './Playground/components/nodes/ServiceAgentIndexerNode';
import { ServiceReputationIndexerNode } from './Playground/components/nodes/ServiceReputationIndexerNode';
import { ServiceRwaStateIndexerNode } from './Playground/components/nodes/ServiceRwaStateIndexerNode';
import { ServiceIdentityNode } from './Playground/components/nodes/ServiceIdentityNode';
import { ServiceSocialIdentityNode } from './Playground/components/nodes/ServiceSocialIdentityNode';
import { ServiceCronosSdkNode } from './Playground/components/nodes/ServiceCronosSdkNode';
import { ServiceCryptoMcpNode } from './Playground/components/nodes/ServiceCryptoMcpNode';
import { ServiceWellKnownNode } from './Playground/components/nodes/ServiceWellKnownNode';
import { ServiceHealthCheckNode } from './Playground/components/nodes/ServiceHealthCheckNode';
import { ServiceObservabilityNode } from './Playground/components/nodes/ServiceObservabilityNode';
import { ServiceTaskStoreNode } from './Playground/components/nodes/ServiceTaskStoreNode';
import { ServiceRwaProofNode } from './Playground/components/nodes/ServiceRwaProofNode';

import { UtilLoggerNode } from './Playground/components/nodes/UtilLoggerNode';
import { UtilInspectorNode } from './Playground/components/nodes/UtilInspectorNode';
import { UtilDelayNode } from './Playground/components/nodes/UtilDelayNode';
import { UtilConditionalNode } from './Playground/components/nodes/UtilConditionalNode';

import { InspectorPanel } from './Playground/components/panels/InspectorPanel';
import { ActivityStream } from './Playground/components/panels/ActivityStream';

import { useRealtimeExecution } from './Playground/hooks/useRealtimeExecution';
import { RealExecutionEngine } from './Playground/engine/RealExecutionEngine';
import type {
    ExecutionMode,
    ExecutionLogEntry,
    PlaygroundNode,
    PlaygroundEdge
} from './Playground/types/playground.types';

const nodeTypes: NodeTypes = {
    agent: AgentNode,
    session: SessionNode,
    wallet: WalletNode,
    indexer: IndexerNode,
    endpoint: EndpointNode,
    x402_step1: X402Step1Node,
    x402_step2: X402Step2Node,
    x402_step3: X402Step3Node,
    x402_step4: X402Step4Node,
    x402_step5: X402Step5Node,
    x402_step6: X402Step6Node,
    x402_step7: X402Step7Node,
    x402_step8: X402Step8Node,
    x402_step9: X402Step9Node,
    service_agent_discovery: ServiceAgentDiscoveryNode,
    service_session_manager: ServiceSessionManagerNode,
    service_dex_aggregator: ServiceDexAggregatorNode,
    service_rwa_settlement: ServiceRwaSettlementNode,
    service_meta_agent: ServiceMetaAgentNode,
    service_payment_indexer: ServicePaymentIndexerNode,
    service_agent_registry: ServiceAgentRegistryNode,
    service_escrow: ServiceEscrowNode,
    service_trade_router: ServiceTradeRouterNode,
    service_pyth_oracle: ServicePythOracleNode,
    service_agent_indexer: ServiceAgentIndexerNode,
    service_reputation_indexer: ServiceReputationIndexerNode,
    service_rwa_state_indexer: ServiceRwaStateIndexerNode,
    service_identity: ServiceIdentityNode,
    service_social_identity: ServiceSocialIdentityNode,
    service_cronos_sdk: ServiceCronosSdkNode,
    service_crypto_mcp: ServiceCryptoMcpNode,
    service_well_known: ServiceWellKnownNode,
    service_health_check: ServiceHealthCheckNode,
    service_observability: ServiceObservabilityNode,
    service_task_store: ServiceTaskStoreNode,
    service_rwa_proof: ServiceRwaProofNode,
    util_logger: UtilLoggerNode,
    util_inspector: UtilInspectorNode,
    util_delay: UtilDelayNode,
    util_conditional: UtilConditionalNode
};

const nodeTemplates = [
    { type: 'wallet', label: 'Wallet', description: 'User wallet' },
    { type: 'session', label: 'Session', description: 'Escrow session' },
    { type: 'agent', label: 'Agent', description: 'AI agent' },
    { type: 'endpoint', label: 'Endpoint', description: 'API service' },
    { type: 'indexer', label: 'Indexer', description: 'Blockchain indexer' },
    { type: 'x402_step1', label: 'Step 1: Request', description: 'Initial resource request' },
    { type: 'x402_step2', label: 'Step 2: Challenge', description: '402 payment challenge' },
    { type: 'x402_step3', label: 'Step 3: Authorize', description: 'EIP-3009 signature' },
    { type: 'x402_step4', label: 'Step 4: Submit', description: 'Submit payment' },
    { type: 'x402_step5', label: 'Step 5: Verify', description: 'Verify signature' },
    { type: 'x402_step6', label: 'Step 6: Settle', description: 'On-chain settlement' },
    { type: 'x402_step7', label: 'Step 7: Confirm', description: 'Wait for confirmations' },
    { type: 'x402_step8', label: 'Step 8: Retry', description: 'Retry with payment ID' },
    { type: 'x402_step9', label: 'Step 9: Deliver', description: 'Receive content' },
    { type: 'service_agent_discovery', label: 'Agent Discovery', description: 'Find agents by capability' },
    { type: 'service_session_manager', label: 'Session Manager', description: 'Create escrow session' },
    { type: 'service_dex_aggregator', label: 'DEX Aggregator', description: 'Get best price across DEXes' },
    { type: 'service_rwa_settlement', label: 'RWA Settlement', description: 'Real-world asset settlement' },
    { type: 'service_meta_agent', label: 'Meta Agent', description: 'Delegate tasks to agents' },
    { type: 'service_payment_indexer', label: 'Payment Indexer', description: 'Index payment transactions' },
    { type: 'service_agent_registry', label: 'Agent Registry', description: 'Register new agents' },
    { type: 'service_escrow', label: 'Escrow Agent', description: 'Release escrow payments' },
    { type: 'service_trade_router', label: 'Trade Router', description: 'Find best trade route' },
    { type: 'service_pyth_oracle', label: 'Pyth Oracle', description: 'Get price feeds' },
    { type: 'service_agent_indexer', label: 'Agent Indexer', description: 'Index agent activity' },
    { type: 'service_reputation_indexer', label: 'Reputation Indexer', description: 'Track reputation scores' },
    { type: 'service_rwa_state_indexer', label: 'RWA State Indexer', description: 'Track RWA state' },
    { type: 'service_identity', label: 'Identity Resolution', description: 'Resolve wallet identities' },
    { type: 'service_social_identity', label: 'Social Identity', description: 'Link social accounts' },
    { type: 'service_cronos_sdk', label: 'Cronos SDK', description: 'Cronos blockchain operations' },
    { type: 'service_crypto_mcp', label: 'Crypto.com MCP', description: 'Market data from Crypto.com' },
    { type: 'service_well_known', label: 'Well-Known Service', description: 'Fetch agent cards' },
    { type: 'service_health_check', label: 'Health Check', description: 'Check service health' },
    { type: 'service_observability', label: 'Observability', description: 'Metrics and traces' },
    { type: 'service_task_store', label: 'Task Store', description: 'Create and track tasks' },
    { type: 'service_rwa_proof', label: 'RWA Proof', description: 'Submit RWA proofs' },
    { type: 'util_logger', label: 'Logger', description: 'Collect execution logs' },
    { type: 'util_inspector', label: 'Inspector', description: 'Inspect data flow' },
    { type: 'util_delay', label: 'Delay', description: 'Add time delay' },
    { type: 'util_conditional', label: 'Conditional', description: 'Branch based on condition' }
];

const demoFlows = {
    complete_x402_flow: {
        name: 'Complete x402 Payment Flow',
        description: 'All 9 steps of x402 payment protocol',
        nodes: [
            {
                id: 'step1',
                type: 'x402_step1',
                position: { x: 50, y: 100 },
                data: {
                    label: 'Initial Request',
                    status: 'idle',
                    config: {
                        url: 'https://api.relaycore.xyz/agent/hire',
                        method: 'GET'
                    }
                }
            },
            {
                id: 'step2',
                type: 'x402_step2',
                position: { x: 300, y: 100 },
                data: {
                    label: 'Payment Challenge',
                    status: 'idle'
                }
            },
            {
                id: 'step3',
                type: 'x402_step3',
                position: { x: 550, y: 100 },
                data: {
                    label: 'Generate Authorization',
                    status: 'idle'
                }
            },
            {
                id: 'step4',
                type: 'x402_step4',
                position: { x: 800, y: 100 },
                data: {
                    label: 'Submit Payment',
                    status: 'idle'
                }
            },
            {
                id: 'step5',
                type: 'x402_step5',
                position: { x: 1050, y: 100 },
                data: {
                    label: 'Verify Signature',
                    status: 'idle'
                }
            },
            {
                id: 'step6',
                type: 'x402_step6',
                position: { x: 1300, y: 100 },
                data: {
                    label: 'On-Chain Settlement',
                    status: 'idle'
                }
            },
            {
                id: 'step7',
                type: 'x402_step7',
                position: { x: 1550, y: 100 },
                data: {
                    label: 'Confirm Settlement',
                    status: 'idle'
                }
            },
            {
                id: 'step8',
                type: 'x402_step8',
                position: { x: 1800, y: 100 },
                data: {
                    label: 'Retry Request',
                    status: 'idle'
                }
            },
            {
                id: 'step9',
                type: 'x402_step9',
                position: { x: 2050, y: 100 },
                data: {
                    label: 'Content Delivery',
                    status: 'idle'
                }
            }
        ],
        edges: [
            {
                id: 'e1-2',
                source: 'step1',
                target: 'step2',
                animated: true,
                style: { stroke: '#3b82f6', strokeWidth: 2 },
                markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' }
            },
            {
                id: 'e2-3',
                source: 'step2',
                target: 'step3',
                animated: true,
                style: { stroke: '#8b5cf6', strokeWidth: 2 },
                markerEnd: { type: MarkerType.ArrowClosed, color: '#8b5cf6' }
            },
            {
                id: 'e3-4',
                source: 'step3',
                target: 'step4',
                animated: true,
                style: { stroke: '#f59e0b', strokeWidth: 2 },
                markerEnd: { type: MarkerType.ArrowClosed, color: '#f59e0b' }
            },
            {
                id: 'e4-5',
                source: 'step4',
                target: 'step5',
                animated: true,
                style: { stroke: '#06b6d4', strokeWidth: 2 },
                markerEnd: { type: MarkerType.ArrowClosed, color: '#06b6d4' }
            },
            {
                id: 'e5-6',
                source: 'step5',
                target: 'step6',
                animated: true,
                style: { stroke: '#6366f1', strokeWidth: 2 },
                markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' }
            },
            {
                id: 'e6-7',
                source: 'step6',
                target: 'step7',
                animated: true,
                style: { stroke: '#10b981', strokeWidth: 2 },
                markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' }
            },
            {
                id: 'e7-8',
                source: 'step7',
                target: 'step8',
                animated: true,
                style: { stroke: '#14b8a6', strokeWidth: 2 },
                markerEnd: { type: MarkerType.ArrowClosed, color: '#14b8a6' }
            },
            {
                id: 'e8-9',
                source: 'step8',
                target: 'step9',
                animated: true,
                style: { stroke: '#8b5cf6', strokeWidth: 2 },
                markerEnd: { type: MarkerType.ArrowClosed, color: '#8b5cf6' }
            }
        ]
    }
};

export function Playground() {
    const [address, setAddress] = useState<string | undefined>();
    const [isConnected, setIsConnected] = useState(false);

    const [nodes, setNodes, onNodesChange] = useNodesState([] as unknown as Node[]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([] as unknown as Edge[]);
    const [isRunning, setIsRunning] = useState(false);
    const [executionMode, setExecutionMode] = useState<ExecutionMode>('mock');
    const [executionLog, setExecutionLog] = useState<ExecutionLogEntry[]>([]);
    const [selectedNode, setSelectedNode] = useState<PlaygroundNode | null>(null);
    const [showInspector, setShowInspector] = useState(false);
    const [showActivity, setShowActivity] = useState(true);
    const [showPalette, setShowPalette] = useState(true);
    const [nodeIdCounter, setNodeIdCounter] = useState(1);

    const { lastUpdate } = useRealtimeExecution({
        mode: executionMode,
        onNodeUpdate: (nodeId, data) => {
            setNodes(nds => nds.map(n =>
                n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
            ));
        },
        onEdgeUpdate: (edgeId, data) => {
            setEdges(eds => eds.map(e =>
                e.id === edgeId ? { ...e, ...data } : e
            ));
        },
        onLog: (entry) => {
            setExecutionLog(prev => [...prev, {
                ...entry,
                id: `log-${Date.now()}-${Math.random()}`,
                timestamp: new Date()
            }]);
        }
    });

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
        setSelectedNode(node as unknown as PlaygroundNode);
        setShowInspector(true);
    }, []);

    const addNodeFromPalette = useCallback((nodeType: string) => {
        const newNode: PlaygroundNode = {
            id: `${nodeType}-${nodeIdCounter}`,
            type: nodeType,
            position: { x: 250 + Math.random() * 200, y: 150 + Math.random() * 200 },
            data: createNodeData(nodeType)
        };

        setNodes(nds => [...nds, newNode as unknown as Node]);
        setNodeIdCounter(c => c + 1);
    }, [nodeIdCounter, setNodes]);

    const loadDemoFlow = useCallback((flowKey: keyof typeof demoFlows) => {
        const flow = demoFlows[flowKey];
        setNodes(flow.nodes as unknown as Node[]);
        setEdges(flow.edges as unknown as Edge[]);
        setExecutionLog([{
            id: `log-${Date.now()}`,
            timestamp: new Date(),
            level: 'info',
            category: 'system',
            message: `Loaded demo: ${flow.name}`
        }]);
    }, [setNodes, setEdges]);

    const connectWallet = useCallback(async () => {
        try {
            if (typeof window !== 'undefined' && window.ethereum) {
                const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                if (accounts && accounts.length > 0) {
                    setAddress(accounts[0]);
                    setIsConnected(true);
                    setExecutionLog(prev => [...prev, {
                        id: `log-${Date.now()}`,
                        timestamp: new Date(),
                        level: 'success',
                        category: 'system',
                        message: `Wallet connected: ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`
                    }]);
                }
            } else {
                setExecutionLog(prev => [...prev, {
                    id: `log-${Date.now()}`,
                    timestamp: new Date(),
                    level: 'error',
                    category: 'system',
                    message: 'No wallet detected. Please install MetaMask.'
                }]);
            }
        } catch (error) {
            setExecutionLog(prev => [...prev, {
                id: `log-${Date.now()}`,
                timestamp: new Date(),
                level: 'error',
                category: 'system',
                message: `Wallet connection failed: ${error}`
            }]);
        }
    }, []);

    const clearCanvas = useCallback(() => {
        setNodes([]);
        setEdges([]);
        setExecutionLog([]);
        setSelectedNode(null);
    }, [setNodes, setEdges]);

    const handleExecute = useCallback(async () => {
        if (!address && executionMode === 'real') {
            setExecutionLog(prev => [...prev, {
                id: `log-${Date.now()}`,
                timestamp: new Date(),
                level: 'error',
                category: 'system',
                message: 'Please connect your wallet to execute in real mode'
            }]);
            return;
        }

        setIsRunning(true);

        try {

            if (executionMode === 'mock') {
                setExecutionLog(prev => [...prev, {
                    id: `log-${Date.now()}`,
                    timestamp: new Date(),
                    level: 'info',
                    category: 'system',
                    message: 'Starting mock execution (simulated)'
                }]);

                const { MockExecutionEngine } = await import('./Playground/engine/MockExecutionEngine');
                const mockEngine = new MockExecutionEngine(
                    nodes as unknown as PlaygroundNode[],
                    edges as unknown as PlaygroundEdge[],
                    {
                        onNodeUpdate: (nodeId, data) => {
                            setNodes(nds => nds.map(n =>
                                n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
                            ));
                        },
                        onEdgeUpdate: (edgeId, data) => {
                            setEdges(eds => eds.map(e =>
                                e.id === edgeId ? { ...e, ...data } : e
                            ));
                        },
                        onLog: (entry) => {
                            setExecutionLog(prev => [...prev, {
                                ...entry,
                                id: `log-${Date.now()}-${Math.random()}`,
                                timestamp: new Date()
                            }]);
                        }
                    }
                );

                await mockEngine.execute();

                setExecutionLog(prev => [...prev, {
                    id: `log-${Date.now()}`,
                    timestamp: new Date(),
                    level: 'success',
                    category: 'system',
                    message: 'Mock execution complete'
                }]);

                return;
            }

            const engine = new RealExecutionEngine({
                nodes: nodes as unknown as PlaygroundNode[],
                edges: edges as unknown as PlaygroundEdge[],
                walletAddress: address || '0x0000000000000000000000000000000000000000',
                onNodeUpdate: (nodeId, data) => {
                    setNodes(nds => nds.map(n =>
                        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
                    ));
                },
                onEdgeUpdate: (edgeId, data) => {
                    setEdges(eds => eds.map(e =>
                        e.id === edgeId ? { ...e, ...data } : e
                    ));
                },
                onLog: (entry) => {
                    setExecutionLog(prev => [...prev, {
                        ...entry,
                        id: `log-${Date.now()}-${Math.random()}`,
                        timestamp: new Date()
                    }]);
                }
            });

            await engine.execute();

        } catch (error) {
            setExecutionLog(prev => [...prev, {
                id: `log-${Date.now()}`,
                timestamp: new Date(),
                level: 'error',
                category: 'system',
                message: `Execution failed: ${error}`
            }]);
        } finally {
            setIsRunning(false);
        }
    }, [address, executionMode, nodes, edges, setNodes, setEdges]);

    return (
        <div className="h-screen flex bg-white">
            <style>{`
                .react-flow__attribution {
                    display: none;
                }
            `}</style>

            <AnimatePresence>
                {showPalette && (
                    <motion.div
                        initial={{ x: -224 }}
                        animate={{ x: 0 }}
                        exit={{ x: -224 }}
                        transition={{ type: 'spring', damping: 25 }}
                        className="w-56 bg-gray-50 border-r border-gray-200 flex flex-col"
                    >
                        <div className="p-4 border-b border-gray-200">
                            <h3 className="font-semibold text-gray-900 mb-1">Node Palette</h3>
                            <p className="text-xs text-gray-500">Drag or click to add nodes</p>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {nodeTemplates.map(template => (
                                <button
                                    key={template.type}
                                    onClick={() => addNodeFromPalette(template.type)}
                                    className="w-full p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-sm transition-all text-left group"
                                >
                                    <div className="font-medium text-sm text-gray-900 group-hover:text-blue-600 mb-1">
                                        {template.label}
                                    </div>
                                    <p className="text-xs text-gray-500">{template.description}</p>
                                </button>
                            ))}
                        </div>

                        <div className="p-3 border-t border-gray-200 space-y-2">
                            <h4 className="text-xs font-semibold text-gray-700 mb-2">Demo Flows</h4>
                            {Object.entries(demoFlows).map(([key, flow]) => (
                                <button
                                    key={key}
                                    onClick={() => loadDemoFlow(key as keyof typeof demoFlows)}
                                    className="w-full p-2 text-left text-xs bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors"
                                >
                                    <div className="font-medium text-blue-900">{flow.name}</div>
                                    <div className="text-blue-600">{flow.description}</div>
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="flex-1 flex flex-col">
                <div className="bg-white border-b border-gray-200 px-6 py-3 z-10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link to="/" className="flex items-center gap-2">
                                <img src={logoFavicon} alt="Relay" className="h-6 w-6" />
                                <span className="text-lg font-bold text-gray-900">Interactive Playground</span>
                            </Link>
                            <Badge variant="outline" className="border-green-200 text-green-600">
                                Testnet Sandbox
                            </Badge>
                            {executionMode === 'real' && isConnected && (
                                <Badge variant="default" className="bg-green-600">
                                    <div className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse" />
                                    Live
                                </Badge>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {!address ? (
                                <Button
                                    variant="default"
                                    size="sm"
                                    onClick={connectWallet}
                                >
                                    <WalletIcon className="h-4 w-4 mr-1" />
                                    Connect Wallet
                                </Button>
                            ) : (
                                <Badge variant="outline" className="font-mono text-xs">
                                    {address.slice(0, 6)}...{address.slice(-4)}
                                </Badge>
                            )}
                            <Button variant="outline" size="sm" onClick={() => setShowPalette(!showPalette)}>
                                {showPalette ? 'Hide' : 'Show'} Palette
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setShowInspector(!showInspector)}>
                                {showInspector ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                                Inspector
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setShowActivity(!showActivity)}>
                                <Activity className="h-4 w-4 mr-1" />
                                Activity
                            </Button>
                            <Button variant="outline" size="sm" onClick={clearCanvas}>
                                <Trash2 className="h-4 w-4 mr-1" />
                                Clear
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 flex">
                    <div className="flex-1 relative">
                        <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onConnect={onConnect}
                            onNodeClick={onNodeClick}
                            nodeTypes={nodeTypes}
                            fitView
                        >
                            <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
                            <Controls />
                        </ReactFlow>

                        <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 space-y-3 z-10">
                            <div>
                                <div className="text-xs font-semibold text-gray-700 mb-2">Execution Mode</div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setExecutionMode('mock')}
                                        className={`px-3 py-1 text-xs rounded ${executionMode === 'mock'
                                            ? 'bg-gray-800 text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                    >
                                        Mock
                                    </button>
                                    <button
                                        onClick={() => setExecutionMode('real')}
                                        className={`px-3 py-1 text-xs rounded ${executionMode === 'real'
                                            ? 'bg-green-600 text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                    >
                                        Real
                                    </button>
                                </div>
                                {executionMode === 'mock' && (
                                    <p className="text-xs text-gray-500 mt-1">Simulated execution for testing</p>
                                )}
                                {executionMode === 'real' && (
                                    <p className="text-xs text-green-600 mt-1">Real blockchain transactions</p>
                                )}
                            </div>

                            <Button
                                onClick={handleExecute}
                                disabled={isRunning || nodes.length === 0}
                                className="w-full"
                                size="sm"
                            >
                                <Play className="h-4 w-4 mr-1" />
                                Execute
                            </Button>

                            <div className="text-xs text-gray-500 space-y-1">
                                <div>Nodes: {nodes.length}</div>
                                <div>Edges: {edges.length}</div>
                                <div>Events: {executionLog.length}</div>
                            </div>
                        </div>
                    </div>

                    <AnimatePresence>
                        {showInspector && selectedNode && (
                            <InspectorPanel
                                node={selectedNode}
                                onClose={() => setShowInspector(false)}
                            />
                        )}
                    </AnimatePresence>

                    <AnimatePresence>
                        {showActivity && (
                            <ActivityStream
                                logs={executionLog}
                                onClose={() => setShowActivity(false)}
                            />
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}

function createNodeData(nodeType: string): any {
    const baseData = {
        label: `New ${nodeType}`,
        status: 'idle' as const,
        executionMode: 'real' as const,
        createdAt: new Date(),
        updatedAt: new Date()
    };

    switch (nodeType) {
        case 'wallet':
            return {
                ...baseData,
                type: 'wallet',
                address: '0x0000000000000000000000000000000000000000',
                balance: 0,
                chainId: 25,
                pendingTransactions: []
            };
        case 'session':
            return {
                ...baseData,
                type: 'session',
                sessionId: `0x${Math.random().toString(16).slice(2, 18)}`,
                ownerAddress: '0x0000000000000000000000000000000000000000',
                maxSpend: 100,
                deposited: 0,
                released: 0,
                remaining: 0,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                authorizedAgents: [],
                events: [],
                isActive: false
            };
        case 'agent':
            return {
                ...baseData,
                type: 'agent',
                agentType: 'Generic Agent',
                tools: [],
                costIncurred: 0,
                paymentsSent: [],
                paymentsReceived: [],
                toolCalls: []
            };
        case 'x402_gate':
            return {
                ...baseData,
                type: 'x402_gate',
                price: 0.01,
                asset: 'USDC',
                recipientAddress: '0x0000000000000000000000000000000000000000',
                paymentStatus: 'pending' as const
            };
        case 'endpoint':
            return {
                ...baseData,
                type: 'endpoint',
                url: 'https://api.example.com',
                method: 'GET',
                x402Protected: false,
                responseTime: 0,
                successRate: 0,
                callHistory: []
            };
        case 'indexer':
            return {
                ...baseData,
                type: 'indexer',
                blockHeight: 0,
                latency: 0,
                eventStream: [],
                dataFreshness: 'stale' as const,
                lastUpdate: new Date()
            };
        case 'x402_step1':
            return {
                ...baseData,
                label: 'Step 1: Request',
                type: 'x402_step1',
                config: {
                    url: 'https://api.relaycore.xyz/resource',
                    method: 'GET'
                }
            };
        case 'x402_step2':
            return {
                ...baseData,
                label: 'Step 2: Challenge',
                type: 'x402_step2'
            };
        case 'x402_step3':
            return {
                ...baseData,
                label: 'Step 3: Authorize',
                type: 'x402_step3'
            };
        case 'x402_step4':
            return {
                ...baseData,
                label: 'Step 4: Submit',
                type: 'x402_step4'
            };
        case 'x402_step5':
            return {
                ...baseData,
                label: 'Step 5: Verify',
                type: 'x402_step5'
            };
        case 'x402_step6':
            return {
                ...baseData,
                label: 'Step 6: Settle',
                type: 'x402_step6'
            };
        case 'x402_step7':
            return {
                ...baseData,
                label: 'Step 7: Confirm',
                type: 'x402_step7'
            };
        case 'x402_step8':
            return {
                ...baseData,
                label: 'Step 8: Retry',
                type: 'x402_step8'
            };
        case 'x402_step9':
            return {
                ...baseData,
                label: 'Step 9: Deliver',
                type: 'x402_step9'
            };
        case 'service_agent_discovery':
            return {
                ...baseData,
                label: 'Agent Discovery',
                type: 'service_agent_discovery',
                config: {
                    capability: 'trading',
                    category: 'defi',
                    minReputation: 80
                }
            };
        case 'service_session_manager':
            return {
                ...baseData,
                label: 'Session Manager',
                type: 'service_session_manager',
                config: {
                    maxSpend: 100,
                    duration: 24
                }
            };
        case 'service_dex_aggregator':
            return {
                ...baseData,
                label: 'DEX Aggregator',
                type: 'service_dex_aggregator',
                config: {
                    tokenIn: 'USDC',
                    tokenOut: 'CRO',
                    amount: '100'
                }
            };
        case 'service_rwa_settlement':
            return {
                ...baseData,
                label: 'RWA Settlement',
                type: 'service_rwa_settlement',
                config: {
                    serviceType: 'compliance_check',
                    slaMaxLatency: 5000
                }
            };
        case 'service_meta_agent':
            return { ...baseData, label: 'Meta Agent', type: 'service_meta_agent', config: { task: 'Execute complex task', maxAgents: 5 } };
        case 'service_payment_indexer':
            return { ...baseData, label: 'Payment Indexer', type: 'service_payment_indexer', config: { fromBlock: 0, toBlock: 'latest' } };
        case 'service_agent_registry':
            return { ...baseData, label: 'Agent Registry', type: 'service_agent_registry', config: { agentName: 'New Agent', capabilities: ['trading'] } };
        case 'service_escrow':
            return { ...baseData, label: 'Escrow Agent', type: 'service_escrow', config: { amount: 100, recipient: '0x...' } };
        case 'service_trade_router':
            return { ...baseData, label: 'Trade Router', type: 'service_trade_router', config: { tokenIn: 'USDC', tokenOut: 'CRO', amountIn: '100' } };
        case 'service_pyth_oracle':
            return { ...baseData, label: 'Pyth Oracle', type: 'service_pyth_oracle', config: { symbol: 'CRO/USD' } };
        case 'service_agent_indexer':
            return { ...baseData, label: 'Agent Indexer', type: 'service_agent_indexer', config: { agentAddress: '0x...' } };
        case 'service_reputation_indexer':
            return { ...baseData, label: 'Reputation Indexer', type: 'service_reputation_indexer', config: { agentAddress: '0x...' } };
        case 'service_rwa_state_indexer':
            return { ...baseData, label: 'RWA State Indexer', type: 'service_rwa_state_indexer', config: { requestId: 'rwa_123' } };
        case 'service_identity':
            return { ...baseData, label: 'Identity Resolution', type: 'service_identity', config: { walletAddress: '0x...' } };
        case 'service_social_identity':
            return { ...baseData, label: 'Social Identity', type: 'service_social_identity', config: { platform: 'twitter', platformId: 'user123' } };
        case 'service_cronos_sdk':
            return { ...baseData, label: 'Cronos SDK', type: 'service_cronos_sdk', config: { operation: 'getBalance' } };
        case 'service_crypto_mcp':
            return { ...baseData, label: 'Crypto.com MCP', type: 'service_crypto_mcp', config: { symbol: 'CRO' } };
        case 'service_well_known':
            return { ...baseData, label: 'Well-Known Service', type: 'service_well_known', config: { baseUrl: 'https://agent.example.com' } };
        case 'service_health_check':
            return { ...baseData, label: 'Health Check', type: 'service_health_check', config: {} };
        case 'service_observability':
            return { ...baseData, label: 'Observability', type: 'service_observability', config: { metric: 'requests', timeRange: '1h' } };
        case 'service_task_store':
            return { ...baseData, label: 'Task Store', type: 'service_task_store', config: { task: 'Process data', priority: 'high' } };
        case 'service_rwa_proof':
            return { ...baseData, label: 'RWA Proof', type: 'service_rwa_proof', config: { requestId: 'rwa_123', proof: '0x...' } };
        case 'util_logger':
            return { ...baseData, label: 'Logger', type: 'util_logger', config: {} };
        case 'util_inspector':
            return { ...baseData, label: 'Inspector', type: 'util_inspector', config: {} };
        case 'util_delay':
            return { ...baseData, label: 'Delay', type: 'util_delay', config: { delayMs: 1000 } };
        case 'util_conditional':
            return { ...baseData, label: 'Conditional', type: 'util_conditional', config: { condition: 'value > 0' } };
        default:
            return baseData;
    }
}

export default Playground;
