import { supabase } from '../../lib/supabase';

interface ReputationScore {
    serviceId: string;
    reputationScore: number;
    successRate: number;
    reliabilityScore: number;
    speedScore: number;
    volumeScore: number;
    recencyWeight: number;
}

export class ReputationEngine {
    async calculateReputation(serviceId: string): Promise<ReputationScore> {
        const { data: payments } = await supabase
            .from('payments')
            .select('*')
            .eq('service_id', serviceId)
            .order('block_timestamp', { ascending: false });

        if (!payments || payments.length === 0) {
            return {
                serviceId,
                reputationScore: 0,
                successRate: 0,
                reliabilityScore: 0,
                speedScore: 0,
                volumeScore: 0,
                recencyWeight: 1.0
            };
        }

        const totalPayments = payments.length;
        const successfulPayments = payments.filter(p => p.status === 'success').length;
        const failedPayments = payments.filter(p => p.status === 'failed').length;
        const successRate = (successfulPayments / totalPayments) * 100;

        const latencies = payments
            .filter(p => p.latency_ms)
            .map(p => p.latency_ms)
            .sort((a, b) => a - b);

        const avgLatency = latencies.length > 0
            ? latencies.reduce((a, b) => a + b, 0) / latencies.length
            : 0;

        const uniquePayers = new Set(payments.map(p => p.payer_address)).size;
        const repeatCustomers = totalPayments - uniquePayers;

        const totalVolume = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

        const now = Date.now();
        const daysSinceFirst = payments.length > 0
            ? (now - new Date(payments[payments.length - 1].block_timestamp).getTime()) / (1000 * 60 * 60 * 24)
            : 0;

        const recencyWeight = Math.max(0.5, 1 - (daysSinceFirst / 365));

        // Scoring components (0-100 each)
        const reliabilityScore = successRate;
        const speedScore = avgLatency > 0 ? Math.max(0, 100 - (avgLatency / 100)) : 100;
        const volumeScore = Math.min(100, (totalVolume / 1000) * 100);
        const repeatScore = Math.min(100, (repeatCustomers / totalPayments) * 100);

        // Weighted reputation score
        const reputationScore = (
            reliabilityScore * 0.4 +
            speedScore * 0.2 +
            volumeScore * 0.2 +
            repeatScore * 0.2
        ) * recencyWeight;

        // Update database
        await supabase.from('reputations').upsert({
            service_id: serviceId,
            total_payments: totalPayments,
            successful_payments: successfulPayments,
            failed_payments: failedPayments,
            avg_latency_ms: Math.round(avgLatency),
            unique_payers: uniquePayers,
            repeat_customers: repeatCustomers,
            total_volume_usd: totalVolume,
            reputation_score: Math.round(reputationScore * 100) / 100,
            success_rate: Math.round(successRate * 100) / 100,
            reliability_score: Math.round(reliabilityScore * 100) / 100,
            speed_score: Math.round(speedScore * 100) / 100,
            volume_score: Math.round(volumeScore * 100) / 100,
            recency_weight: Math.round(recencyWeight * 100) / 100,
            last_calculated: new Date().toISOString()
        });

        return {
            serviceId,
            reputationScore: Math.round(reputationScore * 100) / 100,
            successRate: Math.round(successRate * 100) / 100,
            reliabilityScore: Math.round(reliabilityScore * 100) / 100,
            speedScore: Math.round(speedScore * 100) / 100,
            volumeScore: Math.round(volumeScore * 100) / 100,
            recencyWeight: Math.round(recencyWeight * 100) / 100
        };
    }

    async calculateAllReputations() {
        const { data: services } = await supabase
            .from('services')
            .select('id')
            .eq('is_active', true);

        if (!services) return;

        for (const service of services) {
            try {
                await this.calculateReputation(service.id);
                console.log('Updated reputation for:', service.id);
            } catch (error) {
                console.error('Failed to calculate reputation:', error);
            }
        }
    }

    async getTopServices(category?: string, limit = 10) {
        let query = supabase
            .from('services')
            .select('*, reputations(*)')
            .eq('is_active', true)
            .order('reputation_score', { ascending: false, foreignTable: 'reputations' })
            .limit(limit);

        if (category) {
            query = query.eq('category', category);
        }

        const { data, error } = await query;
        return { data, error };
    }
}

export const reputationEngine = new ReputationEngine();
