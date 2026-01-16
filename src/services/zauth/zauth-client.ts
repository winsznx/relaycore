/**
 * zAuth x402 Integration
 * 
 * Provides endpoint verification before payments
 * API: https://back.zauthx402.com
 */

export interface ZAuthEndpoint {
    id: string;
    url: string;
    status: 'WORKING' | 'FAILING' | 'FLAKY' | 'UNTESTED' | 'OVER_BUDGET';
    method: string;
    network: string;
    protocolName: string;
    title?: string;
    description?: string;
    lastTestedAt: string;
    lastSuccessAt: string | null;
    lastFailureAt: string | null;
    totalAttempts: number;
    successCount: number;
    failureCount: number;
    successRate: number;
    lastPriceUsdc: string;
    maxPriceUsdc: string;
    raw402Header?: any;
    lastRequest?: any;
    lastResponse?: any;
}

export interface ZAuthCall {
    id: string;
    endpointId: string;
    method: string;
    success: boolean;
    statusCode: number;
    errorText: string | null;
    priceUsdc: string;
    paymentTx: string;
    network: string;
    request: any;
    response: any;
    durationMs: number;
    createdAt: string;
}

export interface ZAuthStats {
    total: number;
    WORKING: number;
    FAILING: number;
    FLAKY: number;
    UNTESTED: number;
    OVER_BUDGET: number;
}

const ZAUTH_API_BASE = 'https://back.zauthx402.com/api/x402';

/**
 * zAuth x402 Client
 * Verify endpoint reliability before making payments
 */
export class ZAuthClient {
    private cache: Map<string, { data: ZAuthEndpoint; timestamp: number }> = new Map();
    private cacheTTL = 60000; // 1 minute cache

    /**
     * Get all verified endpoints
     */
    async getEndpoints(params?: {
        status?: ZAuthEndpoint['status'];
        network?: string;
        limit?: number;
        offset?: number;
    }): Promise<{ endpoints: ZAuthEndpoint[]; stats: ZAuthStats }> {
        const queryParams = new URLSearchParams();
        if (params?.status) queryParams.set('status', params.status);
        if (params?.network) queryParams.set('network', params.network);
        if (params?.limit) queryParams.set('limit', params.limit.toString());
        if (params?.offset) queryParams.set('offset', params.offset.toString());

        const url = `${ZAUTH_API_BASE}/endpoints?${queryParams}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`zAuth API error: ${response.statusText}`);
        }

        return response.json();
    }

    /**
     * Get endpoint details by URL
     */
    async getEndpoint(endpointUrl: string): Promise<ZAuthEndpoint | null> {
        // Check cache first
        const cached = this.cache.get(endpointUrl);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            return cached.data;
        }

        try {
            const encodedUrl = encodeURIComponent(endpointUrl);
            const url = `${ZAUTH_API_BASE}/endpoints/${encodedUrl}`;
            const response = await fetch(url);

            if (!response.ok) {
                if (response.status === 404) return null;
                throw new Error(`zAuth API error: ${response.statusText}`);
            }

            const data = await response.json();

            // Cache the result
            this.cache.set(endpointUrl, { data, timestamp: Date.now() });

            return data;
        } catch (error) {
            console.error('zAuth endpoint lookup failed:', error);
            return null;
        }
    }

    /**
     * Get call history for an endpoint
     */
    async getEndpointCalls(endpointId: string, limit = 10): Promise<ZAuthCall[]> {
        const url = `${ZAUTH_API_BASE}/endpoints/${endpointId}/calls?limit=${limit}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`zAuth API error: ${response.statusText}`);
        }

        const data = await response.json();
        return data.calls;
    }

    /**
     * Verify if endpoint is safe to use
     * Returns true if endpoint is working with good success rate
     */
    async isEndpointReliable(
        endpointUrl: string,
        minSuccessRate = 80
    ): Promise<{ reliable: boolean; reason?: string; endpoint?: ZAuthEndpoint }> {
        const endpoint = await this.getEndpoint(endpointUrl);

        if (!endpoint) {
            return {
                reliable: false,
                reason: 'Endpoint not found in zAuth database (untested)',
            };
        }

        if (endpoint.status === 'FAILING') {
            return {
                reliable: false,
                reason: 'Endpoint is currently failing',
                endpoint,
            };
        }

        if (endpoint.status === 'OVER_BUDGET') {
            return {
                reliable: false,
                reason: 'Endpoint price exceeds testing budget',
                endpoint,
            };
        }

        if (endpoint.successRate < minSuccessRate) {
            return {
                reliable: false,
                reason: `Success rate too low: ${endpoint.successRate}% (min: ${minSuccessRate}%)`,
                endpoint,
            };
        }

        if (endpoint.status === 'FLAKY') {
            return {
                reliable: true, // Still usable but warn
                reason: 'Endpoint is flaky (intermittent failures)',
                endpoint,
            };
        }

        return {
            reliable: true,
            endpoint,
        };
    }

    /**
     * Get working endpoints for a specific network
     */
    async getWorkingEndpoints(network: string = 'cronos'): Promise<ZAuthEndpoint[]> {
        const { endpoints } = await this.getEndpoints({
            status: 'WORKING',
            network,
            limit: 100,
        });
        return endpoints;
    }

    /**
     * Clear cache (useful for testing)
     */
    clearCache(): void {
        this.cache.clear();
    }
}

// Singleton instance
export const zauthClient = new ZAuthClient();

/**
 * Helper function to verify endpoint before payment
 * Use this in your x402 payment flow
 */
export async function verifyBeforePayment(
    endpointUrl: string
): Promise<{ canProceed: boolean; warning?: string }> {
    const result = await zauthClient.isEndpointReliable(endpointUrl);

    if (!result.reliable) {
        console.warn(`zAuth verification failed: ${result.reason}`);
        return {
            canProceed: false,
            warning: result.reason,
        };
    }

    if (result.reason) {
        // Flaky endpoint - warn but allow
        console.warn(`zAuth warning: ${result.reason}`);
        return {
            canProceed: true,
            warning: result.reason,
        };
    }

    console.log(`zAuth verified: ${endpointUrl} (${result.endpoint?.successRate}% success rate)`);
    return { canProceed: true };
}
