import { ethers } from 'ethers';

/**
 * Service Consumer SDK
 * 
 * For agents and applications to discover services, make payments,
 * and consume services on the Relay Core platform.
 */

// Configuration for the SDK
export interface ConsumerSDKConfig {
    apiUrl?: string;
    network?: 'testnet' | 'mainnet';
}

// Service query parameters
export interface ServiceQuery {
    category?: string;
    minReputation?: number;
    maxLatency?: number;
    maxPrice?: number;
    inputType?: string;
    outputType?: string;
    tags?: string[];
    capabilities?: string[];
    sortBy?: 'reputation' | 'latency' | 'price' | 'volume';
    limit?: number;
}

// Discovered service
export interface DiscoveredService {
    id: string;
    name: string;
    description: string;
    category: string;
    endpointUrl: string;
    pricePerCall: string;
    ownerAddress: string;
    reputationScore: number;
    successRate: number;
    avgLatencyMs: number;
    schema?: {
        inputType?: string;
        outputType?: string;
        tags?: string[];
        capabilities?: string[];
    };
}

// Payment result
export interface PaymentResult {
    paymentId: string;
    txHash: string;
    settled: boolean;
}

// Service call result
export interface ServiceCallResult<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    paymentId?: string;
    latencyMs: number;
}

// Workflow step
export interface WorkflowStep {
    serviceId: string;
    serviceName: string;
    inputType: string;
    outputType: string;
}

const DEFAULT_API_URL = 'https://api.relaycore.xyz';
const FACILITATOR_URL = 'https://facilitator.cronoslabs.org/v2/x402';

export class ServiceConsumerSDK {
    private apiUrl: string;
    private network: 'testnet' | 'mainnet';
    private signer: ethers.Signer | null = null;

    constructor(config: ConsumerSDKConfig = {}) {
        this.apiUrl = config.apiUrl || DEFAULT_API_URL;
        this.network = config.network || 'mainnet';
    }

    /**
     * Connect a signer for payment operations
     */
    connectSigner(signer: ethers.Signer): void {
        this.signer = signer;
    }

    /**
     * Discover services matching criteria
     */
    async discoverServices(query: ServiceQuery = {}): Promise<DiscoveredService[]> {
        const params = new URLSearchParams();

        if (query.category) params.set('category', query.category);
        if (query.minReputation) params.set('minReputation', query.minReputation.toString());
        if (query.maxLatency) params.set('maxLatency', query.maxLatency.toString());
        if (query.inputType) params.set('inputType', query.inputType);
        if (query.outputType) params.set('outputType', query.outputType);
        if (query.tags) params.set('tags', query.tags.join(','));
        if (query.capabilities) params.set('capabilities', query.capabilities.join(','));
        if (query.sortBy) params.set('sortBy', query.sortBy);
        if (query.limit) params.set('limit', query.limit.toString());

        const response = await fetch(`${this.apiUrl}/api/services?${params}`);

        if (!response.ok) {
            throw new Error('Failed to discover services');
        }

        const data = await response.json();
        return (data.services || []).map(this.formatService);
    }

    /**
     * Get service details
     */
    async getService(serviceId: string): Promise<DiscoveredService | null> {
        const response = await fetch(`${this.apiUrl}/api/services/${serviceId}`);

        if (!response.ok) {
            if (response.status === 404) return null;
            throw new Error('Failed to get service');
        }

        const data = await response.json();
        return this.formatService(data);
    }

    /**
     * Find services compatible with given input/output types
     */
    async findCompatibleServices(params: {
        inputType?: string;
        outputType?: string;
        tags?: string[];
        capabilities?: string[];
    }): Promise<DiscoveredService[]> {
        const query = new URLSearchParams();
        if (params.inputType) query.set('inputType', params.inputType);
        if (params.outputType) query.set('outputType', params.outputType);
        if (params.tags) query.set('tags', params.tags.join(','));
        if (params.capabilities) query.set('capabilities', params.capabilities.join(','));

        const response = await fetch(`${this.apiUrl}/api/schemas/compatible?${query}`);

        if (!response.ok) {
            throw new Error('Failed to find compatible services');
        }

        const data = await response.json();
        return (data.services || []).map(this.formatService);
    }

    /**
     * Suggest a workflow to transform input type to output type
     */
    async suggestWorkflow(params: {
        startInputType: string;
        endOutputType: string;
        maxSteps?: number;
    }): Promise<WorkflowStep[][]> {
        const query = new URLSearchParams({
            startInputType: params.startInputType,
            endOutputType: params.endOutputType,
        });
        if (params.maxSteps) query.set('maxSteps', params.maxSteps.toString());

        const response = await fetch(`${this.apiUrl}/api/schemas/workflow?${query}`);

        if (!response.ok) {
            throw new Error('Failed to suggest workflow');
        }

        const data = await response.json();
        return data.workflows || [];
    }

    /**
     * Call a service with automatic payment handling
     */
    async callService<T = unknown>(params: {
        serviceId: string;
        endpoint?: string;
        method?: 'GET' | 'POST';
        body?: unknown;
        headers?: Record<string, string>;
    }): Promise<ServiceCallResult<T>> {
        const startTime = performance.now();

        if (!this.signer) {
            throw new Error('Signer not connected. Call connectSigner first.');
        }

        // Get service details if needed
        let endpoint = params.endpoint;
        if (!endpoint) {
            const service = await this.getService(params.serviceId);
            if (!service) {
                return {
                    success: false,
                    error: 'Service not found',
                    latencyMs: Math.round(performance.now() - startTime),
                };
            }
            endpoint = service.endpointUrl;
        }

        // Initial request
        let response = await fetch(endpoint, {
            method: params.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...params.headers,
            },
            body: params.body ? JSON.stringify(params.body) : undefined,
        });

        let paymentId: string | undefined;

        // Handle 402 Payment Required
        if (response.status === 402) {
            const paymentRequired = await response.json();
            const requirements = paymentRequired.paymentRequirements;

            if (!requirements) {
                return {
                    success: false,
                    error: 'Invalid payment requirements',
                    latencyMs: Math.round(performance.now() - startTime),
                };
            }

            // Make payment via facilitator
            const paymentResult = await this.makePayment({
                to: requirements.payTo,
                amount: requirements.maxAmountRequired,
                asset: requirements.asset,
            });

            paymentId = paymentResult.paymentId;

            // Retry with payment header
            response = await fetch(endpoint, {
                method: params.method || 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Payment': paymentResult.txHash,
                    'X-Payment-Id': paymentId,
                    ...params.headers,
                },
                body: params.body ? JSON.stringify(params.body) : undefined,
            });
        }

        const latencyMs = Math.round(performance.now() - startTime);

        if (!response.ok) {
            return {
                success: false,
                error: `Service returned ${response.status}: ${response.statusText}`,
                paymentId,
                latencyMs,
            };
        }

        const data = await response.json();
        return {
            success: true,
            data,
            paymentId,
            latencyMs,
        };
    }

    /**
     * Make a direct payment to a service provider
     */
    async makePayment(params: {
        to: string;
        amount: string;
        asset?: string;
    }): Promise<PaymentResult> {
        if (!this.signer) {
            throw new Error('Signer not connected');
        }

        const signerAddress = await this.signer.getAddress();

        // EIP-3009 authorization for USDC transfer
        const domain = {
            name: 'USD Coin',
            version: '2',
            chainId: this.network === 'mainnet' ? 25 : 338,
            verifyingContract: params.asset || '0xf951eC28187D9E5Ca673Da8FE6757E6f0Be5F77C',
        };

        const types = {
            TransferWithAuthorization: [
                { name: 'from', type: 'address' },
                { name: 'to', type: 'address' },
                { name: 'value', type: 'uint256' },
                { name: 'validAfter', type: 'uint256' },
                { name: 'validBefore', type: 'uint256' },
                { name: 'nonce', type: 'bytes32' },
            ],
        };

        const nonce = ethers.hexlify(ethers.randomBytes(32));
        const validAfter = 0;
        const validBefore = Math.floor(Date.now() / 1000) + 3600;

        const value = {
            from: signerAddress,
            to: params.to,
            value: ethers.parseUnits(params.amount, 6),
            validAfter,
            validBefore,
            nonce,
        };

        // Sign authorization
        const signature = await (this.signer as ethers.Signer & {
            signTypedData: (
                domain: typeof domain,
                types: typeof types,
                value: typeof value
            ) => Promise<string>;
        }).signTypedData(domain, types, value);

        // Submit to facilitator
        const response = await fetch(`${FACILITATOR_URL}/settle`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: signerAddress,
                to: params.to,
                value: params.amount,
                validAfter,
                validBefore,
                nonce,
                signature,
                network: this.network === 'mainnet' ? 'cronos-mainnet' : 'cronos-testnet',
            }),
        });

        if (!response.ok) {
            throw new Error('Payment failed');
        }

        const result = await response.json();
        return {
            paymentId: `pay_${result.txHash?.slice(2, 18) || Date.now()}`,
            txHash: result.txHash || '',
            settled: result.success || false,
        };
    }

    /**
     * Get service dependencies graph
     */
    async getServiceGraph(serviceId: string): Promise<{
        dependencies: Array<{ serviceId: string; callCount: number }>;
        dependents: Array<{ serviceId: string; callCount: number }>;
    }> {
        const [depsResponse, deptsResponse] = await Promise.all([
            fetch(`${this.apiUrl}/api/services/${serviceId}/dependencies`),
            fetch(`${this.apiUrl}/api/services/${serviceId}/dependents`),
        ]);

        const dependencies = depsResponse.ok
            ? (await depsResponse.json()).dependencies
            : [];
        const dependents = deptsResponse.ok
            ? (await deptsResponse.json()).dependents
            : [];

        return { dependencies, dependents };
    }

    /**
     * Find path between two services
     */
    async findServicePath(
        fromServiceId: string,
        toServiceId: string
    ): Promise<{
        path: string[];
        totalLatency: number;
    } | null> {
        const response = await fetch(
            `${this.apiUrl}/api/graph/path?from=${fromServiceId}&to=${toServiceId}`
        );

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        return data.shortestPath || null;
    }

    private formatService(s: Record<string, unknown>): DiscoveredService {
        return {
            id: s.id as string,
            name: s.name as string,
            description: s.description as string,
            category: s.category as string,
            endpointUrl: s.endpointUrl as string,
            pricePerCall: s.pricePerCall as string,
            ownerAddress: s.ownerAddress as string,
            reputationScore: (s.reputationScore as number) || 0,
            successRate: (s.successRate as number) || 0,
            avgLatencyMs: (s.avgLatencyMs as number) || 0,
            schema: s.schema as DiscoveredService['schema'],
        };
    }
}

/**
 * Create a Service Consumer SDK instance
 */
export function createConsumerSDK(config?: ConsumerSDKConfig): ServiceConsumerSDK {
    return new ServiceConsumerSDK(config);
}

export default ServiceConsumerSDK;
