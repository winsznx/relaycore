/**
 * Temporal Indexer - Time-based data indexing
 *
 * Provides time-series metrics for services based on
 * agent_invocations and session_payments data.
 */

import logger from '../../lib/logger.js';
import { supabase } from '../../lib/supabase.js';

export interface TimeSeriesData {
    timestamp: Date;
    value: number;
    metric: string;
}

export interface ServiceMetric {
    timestamp: Date;
    reputation_score: number;
    total_payments: number;
    avg_latency_ms: number;
    call_count: number;
    success_count: number;
}

export interface ServiceTrend {
    direction: 'up' | 'down' | 'stable';
    change: number;
    period: string;
}

export const temporalIndexer = {
    async getTimeSeriesData(metric: string, from: Date, to: Date): Promise<TimeSeriesData[]> {
        logger.info('Fetching time series data', { metric, from, to });
        return [];
    },

    async getServiceMetrics(serviceId: string, from: Date, to: Date): Promise<ServiceMetric[]> {
        logger.info('Fetching service metrics', { serviceId, from, to });

        try {
            // Get the service's owner address
            const { data: service } = await supabase
                .from('services')
                .select('owner_address')
                .eq('id', serviceId)
                .single();

            if (!service?.owner_address) {
                return [];
            }

            const ownerAddress = service.owner_address.toLowerCase();

            // Fetch agent invocations for this service
            const { data: invocations } = await supabase
                .from('agent_invocations')
                .select('created_at, status, latency_ms')
                .or(`service_id.eq.${serviceId},agent_address.ilike.${ownerAddress}`)
                .gte('created_at', from.toISOString())
                .lte('created_at', to.toISOString())
                .order('created_at', { ascending: true });

            // Fetch session payments for this agent
            const { data: payments } = await supabase
                .from('session_payments')
                .select('created_at, amount, status')
                .ilike('agent_address', ownerAddress)
                .gte('created_at', from.toISOString())
                .lte('created_at', to.toISOString())
                .order('created_at', { ascending: true });

            // Get current reputation
            const { data: reputation } = await supabase
                .from('reputations')
                .select('reputation_score, avg_latency_ms')
                .eq('service_id', serviceId)
                .single();

            // Group by day and calculate metrics
            const dayMap = new Map<string, ServiceMetric>();

            // Process invocations
            (invocations || []).forEach(inv => {
                const day = new Date(inv.created_at).toISOString().split('T')[0];
                const existing = dayMap.get(day) || {
                    timestamp: new Date(day),
                    reputation_score: reputation?.reputation_score || 80,
                    total_payments: 0,
                    avg_latency_ms: 0,
                    call_count: 0,
                    success_count: 0
                };
                existing.call_count++;
                if (inv.status === 'success') existing.success_count++;
                if (inv.latency_ms) {
                    existing.avg_latency_ms = (existing.avg_latency_ms * (existing.call_count - 1) + inv.latency_ms) / existing.call_count;
                }
                dayMap.set(day, existing);
            });

            // Process payments
            (payments || []).forEach(pay => {
                const day = new Date(pay.created_at).toISOString().split('T')[0];
                const existing = dayMap.get(day) || {
                    timestamp: new Date(day),
                    reputation_score: reputation?.reputation_score || 80,
                    total_payments: 0,
                    avg_latency_ms: reputation?.avg_latency_ms || 200,
                    call_count: 0,
                    success_count: 0
                };
                existing.total_payments += parseFloat(pay.amount) || 0;
                dayMap.set(day, existing);
            });

            // Convert to array sorted by timestamp
            const metrics = Array.from(dayMap.values()).sort(
                (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
            );

            // If no data, return at least current state with default values
            if (metrics.length === 0) {
                return [{
                    timestamp: new Date(),
                    reputation_score: reputation?.reputation_score || 80,
                    total_payments: 0,
                    avg_latency_ms: reputation?.avg_latency_ms || 200,
                    call_count: 0,
                    success_count: 0
                }];
            }

            return metrics;
        } catch (error) {
            logger.error('Failed to fetch service metrics', error as Error);
            return [];
        }
    },

    async getServiceTrend(serviceId: string): Promise<ServiceTrend> {
        logger.info('Fetching service trend', { serviceId });

        try {
            // Get current reputation
            const { data: current } = await supabase
                .from('reputations')
                .select('reputation_score, total_payments')
                .eq('service_id', serviceId)
                .single();

            if (!current) {
                return { direction: 'stable', change: 0, period: '7d' };
            }

            // Get metrics from 7 days ago to compare
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const metrics = await this.getServiceMetrics(serviceId, weekAgo, new Date());

            if (metrics.length < 2) {
                return { direction: 'stable', change: 0, period: '7d' };
            }

            const firstScore = metrics[0].reputation_score;
            const lastScore = metrics[metrics.length - 1].reputation_score;
            const change = lastScore - firstScore;

            return {
                direction: change > 2 ? 'up' : change < -2 ? 'down' : 'stable',
                change: Math.round(change * 10) / 10,
                period: '7d'
            };
        } catch (error) {
            logger.error('Failed to fetch service trend', error as Error);
            return { direction: 'stable', change: 0, period: '7d' };
        }
    },

    async indexTemporalData(): Promise<void> {
        logger.info('Indexing temporal data');
    }
};

export default temporalIndexer;
