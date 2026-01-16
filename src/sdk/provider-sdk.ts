
/**
 * Service Provider SDK
 * 
 * For service providers to register services, handle payments,
 * and track their reputation on the Relay Core platform.
 */

// Configuration for the SDK
export interface ProviderSDKConfig {
    apiUrl?: string;
    supabaseUrl?: string;
    supabaseKey?: string;
}

// Service registration parameters
export interface ServiceRegistration {
    name: string;
    description: string;
    category: string;
    endpointUrl: string;
    pricePerCall: string;
    inputSchema?: Record<string, unknown>;
    outputSchema?: Record<string, unknown>;
    inputType?: string;
    outputType?: string;
    tags?: string[];
    capabilities?: string[];
}

// Registered service response
export interface RegisteredService {
    id: string;
    name: string;
    endpointUrl: string;
    ownerAddress: string;
    createdAt: string;
}

// Reputation data
export interface ProviderReputation {
    reputationScore: number;
    successRate: number;
    totalPayments: number;
    avgLatencyMs: number;
    trend: 'improving' | 'stable' | 'declining';
}

// Payment received event
export interface PaymentReceived {
    paymentId: string;
    txHash: string;
    amount: string;
    payerAddress: string;
    timestamp: string;
}

// Metrics snapshot
export interface ServiceMetrics {
    timestamp: string;
    successRate: number;
    avgLatencyMs: number;
    callVolume: number;
    reputationScore: number;
}

const DEFAULT_API_URL = 'https://api.relaycore.xyz';

export class ServiceProviderSDK {
    private apiUrl: string;
    private walletAddress: string;

    constructor(walletAddress: string, config: ProviderSDKConfig = {}) {
        this.walletAddress = walletAddress.toLowerCase();
        this.apiUrl = config.apiUrl || DEFAULT_API_URL;
    }

    /**
     * Register a new service
     */
    async registerService(service: ServiceRegistration): Promise<RegisteredService> {
        const response = await fetch(`${this.apiUrl}/api/services`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...service,
                ownerAddress: this.walletAddress,
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to register service: ${error.error || response.statusText}`);
        }

        const data = await response.json();
        return {
            id: data.id,
            name: data.name,
            endpointUrl: data.endpointUrl,
            ownerAddress: this.walletAddress,
            createdAt: new Date().toISOString(),
        };
    }

    /**
     * Update an existing service
     */
    async updateService(
        serviceId: string,
        updates: Partial<ServiceRegistration>
    ): Promise<void> {
        const response = await fetch(`${this.apiUrl}/api/services/${serviceId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updates),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to update service: ${error.error || response.statusText}`);
        }
    }

    /**
     * Deactivate a service
     */
    async deactivateService(serviceId: string): Promise<void> {
        await this.updateService(serviceId, { isActive: false } as any);
    }

    /**
     * Get current reputation
     */
    async getReputation(): Promise<ProviderReputation> {
        const response = await fetch(
            `${this.apiUrl}/api/services?ownerAddress=${this.walletAddress}&limit=1`
        );

        if (!response.ok) {
            throw new Error('Failed to fetch reputation');
        }

        const data = await response.json();
        const service = data.services?.[0];

        if (!service) {
            return {
                reputationScore: 0,
                successRate: 0,
                totalPayments: 0,
                avgLatencyMs: 0,
                trend: 'stable',
            };
        }

        return {
            reputationScore: service.reputationScore || 0,
            successRate: service.successRate || 0,
            totalPayments: service.totalPayments || 0,
            avgLatencyMs: service.avgLatencyMs || 0,
            trend: service.trend || 'stable',
        };
    }

    /**
     * Get service metrics history
     */
    async getMetricsHistory(
        serviceId: string,
        options: { from?: Date; to?: Date } = {}
    ): Promise<ServiceMetrics[]> {
        const params = new URLSearchParams();
        if (options.from) params.set('from', options.from.toISOString());
        if (options.to) params.set('to', options.to.toISOString());

        const response = await fetch(
            `${this.apiUrl}/api/services/${serviceId}/metrics?${params}`
        );

        if (!response.ok) {
            throw new Error('Failed to fetch metrics');
        }

        const data = await response.json();
        return data.data || [];
    }

    /**
     * Get all registered services for this provider
     */
    async getMyServices(): Promise<RegisteredService[]> {
        const response = await fetch(
            `${this.apiUrl}/api/services?ownerAddress=${this.walletAddress}`
        );

        if (!response.ok) {
            throw new Error('Failed to fetch services');
        }

        const data = await response.json();
        return (data.services || []).map((s: Record<string, unknown>) => ({
            id: s.id,
            name: s.name,
            endpointUrl: s.endpointUrl,
            ownerAddress: s.ownerAddress,
            createdAt: s.createdAt,
        }));
    }

    /**
     * Generate x402 payment requirements for an endpoint
     * Use this when building your service's 402 response
     */
    generatePaymentRequirements(params: {
        amount: string;
        resourceUrl: string;
        description?: string;
        timeoutSeconds?: number;
    }): {
        x402Version: number;
        paymentRequirements: {
            scheme: 'exact';
            network: string;
            payTo: string;
            asset: string;
            maxAmountRequired: string;
            maxTimeoutSeconds: number;
            description?: string;
        };
    } {
        return {
            x402Version: 1,
            paymentRequirements: {
                scheme: 'exact',
                network: 'cronos-mainnet',
                payTo: this.walletAddress,
                asset: '0xf951eC28187D9E5Ca673Da8FE6757E6f0Be5F77C', // USDC.e on Cronos
                maxAmountRequired: params.amount,
                maxTimeoutSeconds: params.timeoutSeconds || 60,
                description: params.description,
            },
        };
    }

    /**
     * Verify a payment was made (for use in your service)
     */
    async verifyPayment(paymentId: string): Promise<{
        verified: boolean;
        amount?: string;
        payerAddress?: string;
    }> {
        const response = await fetch(`${this.apiUrl}/api/payments/${paymentId}`);

        if (!response.ok) {
            return { verified: false };
        }

        const data = await response.json();
        return {
            verified: data.payment?.status === 'settled',
            amount: data.payment?.amount,
            payerAddress: data.payment?.payerAddress,
        };
    }

    /**
     * Record a service outcome (success or failure)
     * Call after each service invocation
     */
    async recordOutcome(params: {
        paymentId: string;
        outcomeType: 'delivered' | 'failed' | 'partial';
        latencyMs: number;
        evidence?: Record<string, unknown>;
    }): Promise<void> {
        const response = await fetch(`${this.apiUrl}/api/outcomes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                paymentId: params.paymentId,
                outcomeType: params.outcomeType,
                latencyMs: params.latencyMs,
                evidence: params.evidence,
            }),
        });

        if (!response.ok) {
            console.error('Failed to record outcome');
        }
    }
}

/**
 * Create a Service Provider SDK instance
 */
export function createProviderSDK(
    walletAddress: string,
    config?: ProviderSDKConfig
): ServiceProviderSDK {
    return new ServiceProviderSDK(walletAddress, config);
}

export default ServiceProviderSDK;
