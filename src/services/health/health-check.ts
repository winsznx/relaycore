import { supabase } from '../../lib/supabase.js';
import { getProvider } from '../../lib/blockchain/provider.js';

/**
 * Health Check Service
 * 
 * Monitors system health and dependencies
 */

export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    uptime: number;
    checks: {
        database: HealthCheck;
        rpc: HealthCheck;
        indexer: HealthCheck;
        cache: HealthCheck;
    };
}

export interface HealthCheck {
    status: 'pass' | 'fail';
    responseTime?: number;
    error?: string;
    details?: any;
}

export class HealthCheckService {
    private startTime: number;

    constructor() {
        this.startTime = Date.now();
    }

    /**
     * Get comprehensive health status
     */
    async getHealth(): Promise<HealthStatus> {
        const [database, rpc, indexer, cache] = await Promise.all([
            this.checkDatabase(),
            this.checkRPC(),
            this.checkIndexer(),
            this.checkCache(),
        ]);

        const allHealthy = [database, rpc, indexer, cache].every(
            (check) => check.status === 'pass'
        );
        const anyFailed = [database, rpc, indexer, cache].some(
            (check) => check.status === 'fail'
        );

        return {
            status: allHealthy ? 'healthy' : anyFailed ? 'unhealthy' : 'degraded',
            timestamp: new Date().toISOString(),
            uptime: Date.now() - this.startTime,
            checks: {
                database,
                rpc,
                indexer,
                cache,
            },
        };
    }

    /**
     * Check database connectivity
     */
    private async checkDatabase(): Promise<HealthCheck> {
        const start = Date.now();

        try {
            const { error } = await supabase
                .from('indexer_state')
                .select('indexer_name')
                .limit(1);

            if (error) throw error;

            return {
                status: 'pass',
                responseTime: Date.now() - start,
            };
        } catch (error: any) {
            return {
                status: 'fail',
                responseTime: Date.now() - start,
                error: error.message,
            };
        }
    }

    /**
     * Check RPC connectivity
     */
    private async checkRPC(): Promise<HealthCheck> {
        const start = Date.now();

        try {
            const provider = getProvider();
            const blockNumber = await provider.getBlockNumber();

            return {
                status: 'pass',
                responseTime: Date.now() - start,
                details: { blockNumber },
            };
        } catch (error: any) {
            return {
                status: 'fail',
                responseTime: Date.now() - start,
                error: error.message,
            };
        }
    }

    /**
     * Check indexer status
     */
    private async checkIndexer(): Promise<HealthCheck> {
        const start = Date.now();

        try {
            const { data, error } = await supabase
                .from('indexer_state')
                .select('*')
                .order('updated_at', { ascending: false })
                .limit(1)
                .single();

            if (error) throw error;

            // Check if indexer is lagging (more than 1 hour old)
            const lastUpdate = new Date(data.updated_at).getTime();
            const lag = Date.now() - lastUpdate;
            const isLagging = lag > 60 * 60 * 1000; // 1 hour

            return {
                status: isLagging ? 'fail' : 'pass',
                responseTime: Date.now() - start,
                details: {
                    lastBlock: data.last_block,
                    lastUpdate: data.updated_at,
                    lagMs: lag,
                },
            };
        } catch (error: any) {
            return {
                status: 'fail',
                responseTime: Date.now() - start,
                error: error.message,
            };
        }
    }

    /**
     * Check cache status (in-memory for now)
     */
    private async checkCache(): Promise<HealthCheck> {
        const start = Date.now();

        try {
            // Simple memory check
            const memUsage = process.memoryUsage();
            const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
            const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
            const usagePercent = (heapUsedMB / heapTotalMB) * 100;

            return {
                status: usagePercent < 90 ? 'pass' : 'fail',
                responseTime: Date.now() - start,
                details: {
                    heapUsedMB: heapUsedMB.toFixed(2),
                    heapTotalMB: heapTotalMB.toFixed(2),
                    usagePercent: usagePercent.toFixed(2),
                },
            };
        } catch (error: any) {
            return {
                status: 'fail',
                responseTime: Date.now() - start,
                error: error.message,
            };
        }
    }

    /**
     * Get simple status (for load balancers)
     */
    async isHealthy(): Promise<boolean> {
        const health = await this.getHealth();
        return health.status === 'healthy';
    }

    /**
     * Get metrics for monitoring
     */
    async getMetrics() {
        const health = await this.getHealth();

        return {
            uptime: health.uptime,
            timestamp: health.timestamp,
            status: health.status,
            checks: {
                database: {
                    healthy: health.checks.database.status === 'pass',
                    responseTime: health.checks.database.responseTime,
                },
                rpc: {
                    healthy: health.checks.rpc.status === 'pass',
                    responseTime: health.checks.rpc.responseTime,
                    blockNumber: health.checks.rpc.details?.blockNumber,
                },
                indexer: {
                    healthy: health.checks.indexer.status === 'pass',
                    lag: health.checks.indexer.details?.lagMs,
                },
                cache: {
                    healthy: health.checks.cache.status === 'pass',
                    memoryUsage: health.checks.cache.details?.usagePercent,
                },
            },
        };
    }
}

// Singleton instance
export const healthCheckService = new HealthCheckService();
