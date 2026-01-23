import type { PlaygroundNode, PlaygroundEdge, ExecutionLogEntry } from '../types/playground.types';

export class MockExecutionEngine {
    private nodes: Map<string, PlaygroundNode>;
    private edges: Map<string, PlaygroundEdge>;
    private executionLog: ExecutionLogEntry[];
    private onNodeUpdate: (nodeId: string, data: any) => void;
    private onEdgeUpdate: (edgeId: string, data: any) => void;
    private onLog: (entry: ExecutionLogEntry) => void;

    constructor(
        nodes: PlaygroundNode[],
        edges: PlaygroundEdge[],
        callbacks: {
            onNodeUpdate: (nodeId: string, data: any) => void;
            onEdgeUpdate: (edgeId: string, data: any) => void;
            onLog: (entry: ExecutionLogEntry) => void;
        }
    ) {
        this.nodes = new Map(nodes.map(n => [n.id, n]));
        this.edges = new Map(edges.map(e => [e.id, e]));
        this.executionLog = [];
        this.onNodeUpdate = callbacks.onNodeUpdate;
        this.onEdgeUpdate = callbacks.onEdgeUpdate;
        this.onLog = callbacks.onLog;
    }

    async execute(): Promise<void> {
        const sortedNodes = this.topologicalSort();

        for (const node of sortedNodes) {
            await this.executeNode(node);
        }
    }

    private topologicalSort(): PlaygroundNode[] {
        const sorted: PlaygroundNode[] = [];
        const visited = new Set<string>();
        const temp = new Set<string>();

        const visit = (nodeId: string) => {
            if (temp.has(nodeId)) {
                throw new Error('Cycle detected in flow');
            }
            if (visited.has(nodeId)) {
                return;
            }

            temp.add(nodeId);

            const incomingEdges = Array.from(this.edges.values())
                .filter(e => e.target === nodeId);

            for (const edge of incomingEdges) {
                visit(edge.source);
            }

            temp.delete(nodeId);
            visited.add(nodeId);

            const node = this.nodes.get(nodeId);
            if (node) {
                sorted.push(node);
            }
        };

        for (const node of this.nodes.values()) {
            if (!visited.has(node.id)) {
                visit(node.id);
            }
        }

        return sorted;
    }

    private async executeNode(node: PlaygroundNode): Promise<void> {
        this.updateNodeStatus(node.id, 'executing');

        try {
            if (!node || !node.type) {
                throw new Error('Invalid node: missing type');
            }

            if (!node.data) {
                throw new Error('Invalid node: missing data');
            }

            switch (node.type) {
                case 'x402_step1':
                    await this.executeStep1(node);
                    break;
                case 'x402_step2':
                    await this.executeStep2(node);
                    break;
                case 'x402_step3':
                    await this.executeStep3(node);
                    break;
                case 'x402_step4':
                    await this.executeStep4(node);
                    break;
                case 'x402_step5':
                    await this.executeStep5(node);
                    break;
                case 'x402_step6':
                    await this.executeStep6(node);
                    break;
                case 'x402_step7':
                    await this.executeStep7(node);
                    break;
                case 'x402_step8':
                    await this.executeStep8(node);
                    break;
                case 'x402_step9':
                    await this.executeStep9(node);
                    break;
                case 'service_agent_discovery':
                    await this.executeAgentDiscovery(node);
                    break;
                case 'service_session_manager':
                    await this.executeSessionManager(node);
                    break;
                case 'service_dex_aggregator':
                    await this.executeDexAggregator(node);
                    break;
                case 'service_rwa_settlement':
                    await this.executeRwaSettlement(node);
                    break;
                case 'service_meta_agent':
                    await this.executeMetaAgent(node);
                    break;
                case 'service_payment_indexer':
                    await this.executePaymentIndexer(node);
                    break;
                case 'service_agent_registry':
                    await this.executeAgentRegistry(node);
                    break;
                case 'service_escrow':
                    await this.executeEscrow(node);
                    break;
                case 'service_trade_router':
                    await this.executeTradeRouter(node);
                    break;
                case 'service_pyth_oracle':
                    await this.executePythOracle(node);
                    break;
                case 'service_agent_indexer':
                    await this.executeAgentIndexer(node);
                    break;
                case 'service_reputation_indexer':
                    await this.executeReputationIndexer(node);
                    break;
                case 'service_rwa_state_indexer':
                    await this.executeRwaStateIndexer(node);
                    break;
                case 'service_identity':
                    await this.executeIdentity(node);
                    break;
                case 'service_social_identity':
                    await this.executeSocialIdentity(node);
                    break;
                case 'service_cronos_sdk':
                    await this.executeCronosSdk(node);
                    break;
                case 'service_crypto_mcp':
                    await this.executeCryptoMcp(node);
                    break;
                case 'service_well_known':
                    await this.executeWellKnown(node);
                    break;
                case 'service_health_check':
                    await this.executeHealthCheck(node);
                    break;
                case 'service_observability':
                    await this.executeObservability(node);
                    break;
                case 'service_task_store':
                    await this.executeTaskStore(node);
                    break;
                case 'service_rwa_proof':
                    await this.executeRwaProof(node);
                    break;
                case 'util_logger':
                    await this.executeLogger(node);
                    break;
                case 'util_inspector':
                    await this.executeInspector(node);
                    break;
                case 'util_delay':
                    await this.executeDelay(node);
                    break;
                case 'util_conditional':
                    await this.executeConditional(node);
                    break;
                default:
                    this.log('warning', `Unknown node type: ${node.type}`);
                    throw new Error(`Unsupported node type: ${node.type}`);
            }

            this.updateNodeStatus(node.id, 'complete');
            this.propagateData(node);
        } catch (error) {
            this.updateNodeStatus(node.id, 'error');
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.log('error', `Node ${node.id} failed: ${errorMessage}`);

            this.onNodeUpdate(node.id, {
                error: errorMessage,
                errorTime: Date.now()
            });

            throw error;
        }
    }

    private async executeStep1(node: PlaygroundNode): Promise<void> {
        await this.delay(500);
        node.data.output = {
            resourceUrl: node.data.config?.url || 'https://api.example.com/resource',
            requestHeaders: { 'User-Agent': 'RelayCore/1.0', 'Accept': 'application/json' },
            requestTime: Date.now(),
            status: 402
        };
        this.log('info', `Mock: GET ${node.data.output.resourceUrl} → 402 Payment Required`);
    }

    private async executeStep2(node: PlaygroundNode): Promise<void> {
        await this.delay(300);
        node.data.output = {
            paymentId: `mock_pay_${Date.now()}`,
            paymentRequirements: {
                payTo: '0x' + '1'.repeat(40),
                maxAmountRequired: '1000000',
                asset: '0x' + '2'.repeat(40),
                network: 'cronos-testnet',
                resource: node.data.input?.resourceUrl || 'https://api.example.com/resource'
            }
        };
        this.log('info', `Mock: 402 Challenge - Payment ID: ${node.data.output.paymentId}`);
    }

    private async executeStep3(node: PlaygroundNode): Promise<void> {
        await this.delay(800);
        node.data.output = {
            paymentHeader: '0x' + 'a'.repeat(128),
            signature: '0x' + 'b'.repeat(130),
            validBefore: Math.floor(Date.now() / 1000) + 300,
            nonce: Math.floor(Math.random() * 1000000)
        };
        this.log('info', 'Mock: EIP-3009 authorization generated');
    }

    private async executeStep4(node: PlaygroundNode): Promise<void> {
        await this.delay(600);
        node.data.output = {
            submissionReceipt: `receipt_${Date.now()}`,
            timestamp: Date.now(),
            status: 'submitted'
        };
        this.log('info', 'Mock: Payment submitted to settlement endpoint');
    }

    private async executeStep5(node: PlaygroundNode): Promise<void> {
        await this.delay(400);
        node.data.output = {
            verificationResult: true,
            isValid: true,
            verifiedAt: Date.now()
        };
        this.log('success', 'Mock: Signature verified successfully');
    }

    private async executeStep6(node: PlaygroundNode): Promise<void> {
        await this.delay(2000);
        node.data.output = {
            txHash: '0x' + Math.random().toString(16).slice(2).padEnd(64, '0'),
            blockNumber: 12345678 + Math.floor(Math.random() * 1000),
            gasUsed: 150000 + Math.floor(Math.random() * 50000)
        };
        this.log('success', `Mock: Settlement complete - Tx: ${node.data.output.txHash.slice(0, 10)}...`);
    }

    private async executeStep7(node: PlaygroundNode): Promise<void> {
        await this.delay(1500);
        node.data.output = {
            settlementProof: `proof_${Date.now()}`,
            confirmations: 12,
            finalized: true
        };
        this.log('success', 'Mock: Settlement confirmed (12 confirmations)');
    }

    private async executeStep8(node: PlaygroundNode): Promise<void> {
        await this.delay(500);
        node.data.output = {
            resourceResponse: {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            },
            statusCode: 200
        };
        this.log('info', 'Mock: Resource request retry with payment ID → 200 OK');
    }

    private async executeStep9(node: PlaygroundNode): Promise<void> {
        await this.delay(300);
        node.data.output = {
            finalContent: {
                data: { message: 'Mock resource content', timestamp: Date.now() },
                size: 1024,
                type: 'application/json'
            }
        };
        this.log('success', 'Mock: Content delivered successfully');
    }

    private async executeAgentDiscovery(node: PlaygroundNode): Promise<void> {
        await this.delay(700);
        const config = (node.data as any).config || {};
        node.data.output = {
            discoveredAgents: [
                { id: 'agent_1', name: 'PerpAI Quote Agent', reputation: 95, endpoint: 'https://api.relaycore.xyz/perpai' },
                { id: 'agent_2', name: 'DEX Arbitrage Bot', reputation: 88, endpoint: 'https://api.relaycore.xyz/dex-arb' },
                { id: 'agent_3', name: 'Compliance Checker', reputation: 92, endpoint: 'https://api.relaycore.xyz/compliance' }
            ].filter(a => !config.minReputation || a.reputation >= config.minReputation)
        };
        this.log('success', `Mock: Found ${(node.data.output as any).discoveredAgents.length} agents matching criteria`);
    }

    private async executeSessionManager(node: PlaygroundNode): Promise<void> {
        await this.delay(600);
        const config = (node.data as any).config || {};
        node.data.output = {
            sessionId: `0x${Math.random().toString(16).slice(2, 18)}`,
            deposited: config.maxSpend || 100,
            remaining: config.maxSpend || 100,
            expiresAt: new Date(Date.now() + (config.duration || 24) * 60 * 60 * 1000).toISOString()
        };
        this.log('success', `Mock: Session created with $${(node.data.output as any).deposited} budget`);
    }

    private async executeDexAggregator(node: PlaygroundNode): Promise<void> {
        await this.delay(900);
        const config = (node.data as any).config || {};
        const quotes = [
            { venue: 'VVS Finance', price: 0.0234, liquidity: 150000 },
            { venue: 'Ferro Protocol', price: 0.0236, liquidity: 80000 },
            { venue: 'Crodex', price: 0.0235, liquidity: 120000 },
            { venue: 'MM Finance', price: 0.0233, liquidity: 200000 }
        ];
        const bestQuote = quotes.reduce((best, q) => q.price > best.price ? q : best, quotes[0]);
        node.data.output = {
            quotes,
            bestPrice: bestQuote.price,
            bestVenue: bestQuote.venue
        };
        this.log('success', `Mock: Best price ${bestQuote.price} on ${bestQuote.venue}`);
    }

    private async executeRwaSettlement(node: PlaygroundNode): Promise<void> {
        await this.delay(1200);
        const config = (node.data as any).config || {};
        const requestId = `rwa_${Date.now()}`;
        const latencyMs = 800 + Math.floor(Math.random() * 500);
        const slaValid = !config.slaMaxLatency || latencyMs < config.slaMaxLatency;

        node.data.output = {
            requestId,
            verificationResult: {
                valid: slaValid,
                slaMetrics: {
                    latencyMs,
                    fieldsPresent: ['timestamp', 'result', 'signature']
                }
            },
            settlementResult: slaValid ? {
                success: true,
                txHash: '0x' + Math.random().toString(16).slice(2).padEnd(64, '0')
            } : {
                success: false
            }
        };
        this.log(slaValid ? 'success' : 'warning',
            `Mock: RWA settlement ${slaValid ? 'completed' : 'failed SLA check'}`);
    }

    private async executeMetaAgent(node: PlaygroundNode): Promise<void> {
        await this.delay(1500);
        node.data.output = { result: { status: 'complete' }, agentsUsed: [{ id: '1', name: 'Agent1', cost: 0.5 }, { id: '2', name: 'Agent2', cost: 0.3 }], totalCost: 0.8 };
        this.log('success', 'Mock: Meta agent task delegated to 2 agents');
    }

    private async executePaymentIndexer(node: PlaygroundNode): Promise<void> {
        await this.delay(800);
        node.data.output = { payments: [{ txHash: '0xabc', amount: 100, timestamp: new Date().toISOString() }], totalVolume: 100, lastBlock: 12345 };
        this.log('success', 'Mock: Indexed 1 payment');
    }

    private async executeAgentRegistry(node: PlaygroundNode): Promise<void> {
        await this.delay(900);
        node.data.output = { agentId: `agent_${Date.now()}`, txHash: '0x' + Math.random().toString(16).slice(2, 18), ipfsUri: 'ipfs://Qm...' };
        this.log('success', 'Mock: Agent registered');
    }

    private async executeEscrow(node: PlaygroundNode): Promise<void> {
        await this.delay(1000);
        const config = (node.data as any).config || {};
        node.data.output = { releaseResult: true, txHash: '0x' + Math.random().toString(16).slice(2, 18), releasedAmount: config.amount || 100 };
        this.log('success', 'Mock: Escrow released');
    }

    private async executeTradeRouter(node: PlaygroundNode): Promise<void> {
        await this.delay(1100);
        node.data.output = { bestRoute: [{ venue: 'VVS', percentage: 60 }, { venue: 'Crodex', percentage: 40 }], expectedOut: '105.5', priceImpact: 0.5 };
        this.log('success', 'Mock: Best route found');
    }

    private async executePythOracle(node: PlaygroundNode): Promise<void> {
        await this.delay(400);
        node.data.output = { price: 0.0234 + Math.random() * 0.001, confidence: 0.9999, timestamp: Date.now() };
        this.log('success', 'Mock: Price feed retrieved');
    }

    private async executeAgentIndexer(node: PlaygroundNode): Promise<void> {
        await this.delay(700);
        node.data.output = { activity: [{ type: 'call', timestamp: Date.now() }], successRate: 95.5 };
        this.log('success', 'Mock: Agent activity indexed');
    }

    private async executeReputationIndexer(node: PlaygroundNode): Promise<void> {
        await this.delay(600);
        node.data.output = { reputationScore: 88, trend: 'up', metrics: {} };
        this.log('success', 'Mock: Reputation indexed');
    }

    private async executeRwaStateIndexer(node: PlaygroundNode): Promise<void> {
        await this.delay(650);
        node.data.output = { state: 'verified', transitions: [{ from: 'pending', to: 'verified', timestamp: Date.now() }] };
        this.log('success', 'Mock: RWA state indexed');
    }

    private async executeIdentity(node: PlaygroundNode): Promise<void> {
        await this.delay(750);
        node.data.output = { identities: [{ platform: 'twitter', username: 'user123' }], platforms: ['twitter', 'github'] };
        this.log('success', 'Mock: Identity resolved');
    }

    private async executeSocialIdentity(node: PlaygroundNode): Promise<void> {
        await this.delay(800);
        node.data.output = { walletAddress: '0x' + '1'.repeat(40), verified: true, platform: 'twitter' };
        this.log('success', 'Mock: Social identity linked');
    }

    private async executeCronosSdk(node: PlaygroundNode): Promise<void> {
        await this.delay(500);
        node.data.output = { result: { balance: '1000' }, chainInfo: { chainId: 25, name: 'Cronos' } };
        this.log('success', 'Mock: Cronos SDK operation complete');
    }

    private async executeCryptoMcp(node: PlaygroundNode): Promise<void> {
        await this.delay(600);
        node.data.output = { marketData: { price: 0.023, volume: 1000000 }, orderbook: { bids: [], asks: [] } };
        this.log('success', 'Mock: Market data retrieved');
    }

    private async executeWellKnown(node: PlaygroundNode): Promise<void> {
        await this.delay(550);
        node.data.output = { agentCard: { name: 'Agent', version: '1.0' }, resources: [{ type: 'api', url: '/api' }] };
        this.log('success', 'Mock: Agent card fetched');
    }

    private async executeHealthCheck(node: PlaygroundNode): Promise<void> {
        await this.delay(300);
        node.data.output = { status: 'healthy', checks: [{ name: 'database', status: 'ok' }, { name: 'api', status: 'ok' }] };
        this.log('success', 'Mock: All services healthy');
    }

    private async executeObservability(node: PlaygroundNode): Promise<void> {
        await this.delay(700);
        node.data.output = { metrics: [{ name: 'requests', value: 1000 }], traces: [{ id: 'trace1', duration: 100 }] };
        this.log('success', 'Mock: Metrics collected');
    }

    private async executeTaskStore(node: PlaygroundNode): Promise<void> {
        await this.delay(450);
        node.data.output = { taskId: `task_${Date.now()}`, status: 'queued' };
        this.log('success', 'Mock: Task created');
    }

    private async executeRwaProof(node: PlaygroundNode): Promise<void> {
        await this.delay(1000);
        node.data.output = { verificationResult: { valid: true }, slaMetrics: { latency: 850, fieldsPresent: ['proof', 'signature'] } };
        this.log('success', 'Mock: RWA proof verified');
    }

    private async executeLogger(node: PlaygroundNode): Promise<void> {
        this.log('info', 'Mock: Collecting logs');
        await this.delay(300);
        const logs = [
            { timestamp: Date.now() - 2000, message: 'Execution started' },
            { timestamp: Date.now() - 1000, message: 'Processing data' },
            { timestamp: Date.now(), message: 'Execution complete' }
        ];
        node.data.output = { logs, count: logs.length };
        this.log('success', `Mock: Collected ${logs.length} log entries`);
    }

    private async executeInspector(node: PlaygroundNode): Promise<void> {
        this.log('info', 'Mock: Inspecting data');
        await this.delay(200);
        const inputData = (node.data as any).input || { sample: 'data' };
        const dataType = typeof inputData;
        const size = JSON.stringify(inputData).length;
        node.data.output = { data: inputData, dataType, size };
        this.log('success', `Mock: Inspected ${dataType} data (${size} bytes)`);
    }

    private async executeDelay(node: PlaygroundNode): Promise<void> {
        const delayMs = (node.data as any).config?.delayMs || 1000;
        this.log('info', `Mock: Delaying for ${delayMs}ms`);
        await this.delay(delayMs);
        node.data.output = { delayedAt: Date.now(), delayMs };
        this.log('success', `Mock: Delay of ${delayMs}ms completed`);
    }

    private async executeConditional(node: PlaygroundNode): Promise<void> {
        this.log('info', 'Mock: Evaluating condition');
        await this.delay(100);
        const condition = (node.data as any).config?.condition || 'true';
        const conditionResult = Math.random() > 0.5;
        const selectedPath = conditionResult ? 'true' : 'false';
        node.data.output = { conditionResult, selectedPath, condition };
        this.log('success', `Mock: Condition evaluated to ${selectedPath}`);
    }

    private updateNodeStatus(nodeId: string, status: 'idle' | 'executing' | 'complete' | 'error'): void {
        this.onNodeUpdate(nodeId, { status });
    }

    private propagateData(node: PlaygroundNode): void {
        const outgoingEdges = Array.from(this.edges.values())
            .filter(e => e.source === node.id);

        for (const edge of outgoingEdges) {
            this.onEdgeUpdate(edge.id, {
                animated: true,
                style: { stroke: '#10b981', strokeWidth: 3 }
            });

            const targetNode = this.nodes.get(edge.target);
            if (targetNode) {
                this.onNodeUpdate(edge.target, {
                    input: {
                        ...targetNode.data.input,
                        ...node.data.output
                    }
                });
            }
        }
    }

    private log(level: 'info' | 'success' | 'warning' | 'error', message: string): void {
        const entry: ExecutionLogEntry = {
            id: `log_${Date.now()}_${Math.random()}`,
            timestamp: new Date(),
            level,
            category: 'execution',
            message
        };
        this.executionLog.push(entry);
        this.onLog(entry);
    }

    private async delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
