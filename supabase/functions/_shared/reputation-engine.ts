import { createClient } from 'jsr:@supabase/supabase-js@2'
import Redis from 'npm:ioredis'

const CACHE_TTL = 300 // 5 minutes

export interface ReputationMetrics {
    totalPayments: number
    successfulPayments: number
    failedPayments: number
    timeoutPayments: number
    avgLatencyMs: number
    medianLatencyMs: number
    p95LatencyMs: number
    uniquePayers: number
    repeatCustomers: number
    totalVolumeUsd: number
    firstPaymentDate: Date
    lastPaymentDate: Date
}

export interface ReputationScore {
    serviceId: string
    reputationScore: number
    successRate: number
    reliabilityScore: number
    speedScore: number
    volumeScore: number
    recencyWeight: number
    calculatedAt: Date
}

export class ReputationEngine {
    private supabase: any
    private redis: Redis

    constructor() {
        this.supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )
        this.redis = new Redis(Deno.env.get('REDIS_URL')!)
    }

    // Calculate reputation for a single service
    async calculateReputation(serviceId: string): Promise<ReputationScore> {
        // Check cache first
        const cached = await this.redis.get(`reputation:${serviceId}`)
        if (cached) {
            // Parse dates back to Date objects if needed, but JSON.parse usually returns strings
            const parsed = JSON.parse(cached)
            return {
                ...parsed,
                calculatedAt: new Date(parsed.calculatedAt)
            }
        }

        // Fetch raw metrics
        const metrics = await this.fetchServiceMetrics(serviceId)

        if (!metrics || metrics.totalPayments === 0) {
            return this.getDefaultScore(serviceId)
        }

        // Calculate component scores
        const successRate = (metrics.successfulPayments / metrics.totalPayments) * 100
        const reliabilityScore = this.calculateReliabilityScore(metrics)
        const speedScore = this.calculateSpeedScore(metrics)
        const volumeScore = this.calculateVolumeScore(metrics)
        const recencyWeight = this.calculateRecencyWeight(metrics)

        // Weighted composite score
        const reputationScore = (
            0.40 * reliabilityScore +
            0.25 * speedScore +
            0.20 * volumeScore +
            0.15 * (metrics.repeatCustomers / metrics.uniquePayers * 100)
        ) * recencyWeight

        const score: ReputationScore = {
            serviceId,
            reputationScore: Math.min(100, Math.max(0, reputationScore)),
            successRate,
            reliabilityScore,
            speedScore,
            volumeScore,
            recencyWeight,
            calculatedAt: new Date()
        }

        // Store in database
        await this.storeReputation(serviceId, metrics, score)

        // Cache result
        await this.redis.setex(
            `reputation:${serviceId}`,
            CACHE_TTL,
            JSON.stringify(score)
        )

        return score
    }

    // Fetch raw metrics from database
    private async fetchServiceMetrics(serviceId: string): Promise<ReputationMetrics | null> {
        const { data: payments } = await this.supabase
            .from('payments')
            .select('status, latency_ms, payer_address, amount, block_timestamp')
            .eq('service_id', serviceId)
            .order('block_timestamp', { ascending: true })

        if (!payments || payments.length === 0) {
            return null
        }

        const successful = payments.filter((p: any) => p.status === 'success')
        const failed = payments.filter((p: any) => p.status === 'failed')
        const timeout = payments.filter((p: any) => p.status === 'timeout')

        const latencies = successful
            .map((p: any) => p.latency_ms)
            .filter((l: any) => l !== null)
            .sort((a: any, b: any) => a - b)

        const uniquePayers = new Set(payments.map((p: any) => p.payer_address))
        const payerCounts = payments.reduce((acc: any, p: any) => {
            acc[p.payer_address] = (acc[p.payer_address] || 0) + 1
            return acc
        }, {} as Record<string, number>)

        const repeatCustomers = Object.values(payerCounts).filter((count: any) => count > 1).length

        return {
            totalPayments: payments.length,
            successfulPayments: successful.length,
            failedPayments: failed.length,
            timeoutPayments: timeout.length,
            avgLatencyMs: latencies.length > 0
                ? latencies.reduce((sum: number, l: number) => sum + l, 0) / latencies.length
                : 0,
            medianLatencyMs: latencies.length > 0
                ? latencies[Math.floor(latencies.length / 2)]
                : 0,
            p95LatencyMs: latencies.length > 0
                ? latencies[Math.floor(latencies.length * 0.95)]
                : 0,
            uniquePayers: uniquePayers.size,
            repeatCustomers,
            totalVolumeUsd: payments.reduce((sum: number, p: any) => sum + parseFloat(p.amount || 0), 0),
            firstPaymentDate: new Date(payments[0].block_timestamp),
            lastPaymentDate: new Date(payments[payments.length - 1].block_timestamp)
        }
    }

    // Calculate reliability score (0-100)
    private calculateReliabilityScore(metrics: ReputationMetrics): number {
        const successRate = (metrics.successfulPayments / metrics.totalPayments)

        // Penalize services with high failure rates more severely
        const failureRatio = metrics.failedPayments / metrics.totalPayments
        const timeoutRatio = metrics.timeoutPayments / metrics.totalPayments

        const reliabilityPenalty = (failureRatio * 2) + (timeoutRatio * 1.5)

        return Math.max(0, (successRate - reliabilityPenalty) * 100)
    }

    // Calculate speed score (0-100)
    private calculateSpeedScore(metrics: ReputationMetrics): number {
        // Ideal latency thresholds
        const EXCELLENT_LATENCY = 1000 // 1 second
        const GOOD_LATENCY = 3000 // 3 seconds
        const ACCEPTABLE_LATENCY = 5000 // 5 seconds

        const avgLatency = metrics.avgLatencyMs

        if (avgLatency <= EXCELLENT_LATENCY) return 100
        if (avgLatency <= GOOD_LATENCY) return 80
        if (avgLatency <= ACCEPTABLE_LATENCY) return 60

        // Exponential decay after acceptable threshold
        return Math.max(0, 60 * Math.exp(-(avgLatency - ACCEPTABLE_LATENCY) / 5000))
    }

    // Calculate volume score (0-100)
    private calculateVolumeScore(metrics: ReputationMetrics): number {
        // Normalize volume (logarithmic scale)
        const MIN_PAYMENTS = 10
        const MAX_PAYMENTS = 10000

        if (metrics.totalPayments < MIN_PAYMENTS) {
            return (metrics.totalPayments / MIN_PAYMENTS) * 50
        }

        const logVolume = Math.log10(metrics.totalPayments)
        const logMax = Math.log10(MAX_PAYMENTS)
        const logMin = Math.log10(MIN_PAYMENTS)

        return Math.min(100, 50 + ((logVolume - logMin) / (logMax - logMin)) * 50)
    }

    // Calculate recency weight (0.5-1.0)
    private calculateRecencyWeight(metrics: ReputationMetrics): number {
        const now = new Date()
        const daysSinceLastPayment = (now.getTime() - metrics.lastPaymentDate.getTime()) / (1000 * 60 * 60 * 24)

        // Exponential decay: weight = 1.0 if active today, 0.5 if inactive for 30+ days
        const weight = Math.exp(-daysSinceLastPayment / 30)
        return Math.max(0.5, Math.min(1.0, weight))
    }

    // Store reputation in database
    private async storeReputation(
        serviceId: string,
        metrics: ReputationMetrics,
        score: ReputationScore
    ) {
        // Simple retry logic inline for demo
        let retries = 3;
        while (retries > 0) {
            const { error } = await this.supabase
                .from('reputations')
                .upsert({
                    service_id: serviceId,
                    total_payments: metrics.totalPayments,
                    successful_payments: metrics.successfulPayments,
                    failed_payments: metrics.failedPayments,
                    timeout_payments: metrics.timeoutPayments,
                    avg_latency_ms: Math.round(metrics.avgLatencyMs),
                    median_latency_ms: metrics.medianLatencyMs,
                    p95_latency_ms: metrics.p95LatencyMs,
                    unique_payers: metrics.uniquePayers,
                    repeat_customers: metrics.repeatCustomers,
                    total_volume_usd: metrics.totalVolumeUsd.toFixed(2),
                    reputation_score: score.reputationScore.toFixed(2),
                    success_rate: score.successRate.toFixed(2),
                    reliability_score: score.reliabilityScore.toFixed(2),
                    speed_score: score.speedScore.toFixed(2),
                    volume_score: score.volumeScore.toFixed(2),
                    recency_weight: score.recencyWeight.toFixed(2),
                    last_calculated: score.calculatedAt.toISOString(),
                    calculation_version: 1
                })

            if (!error) break;
            retries--;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    // Default score for services with no payments
    private getDefaultScore(serviceId: string): ReputationScore {
        return {
            serviceId,
            reputationScore: 0,
            successRate: 0,
            reliabilityScore: 0,
            speedScore: 0,
            volumeScore: 0,
            recencyWeight: 1.0,
            calculatedAt: new Date()
        }
    }

    // Batch update all service reputations
    async updateAllReputations() {
        const { data: services } = await this.supabase
            .from('services')
            .select('id')
            .eq('is_active', true)

        if (!services) return

        console.log('Starting batch reputation update', { count: services.length })

        for (const service of services) {
            try {
                await this.calculateReputation(service.id)
                console.log('Reputation updated', { serviceId: service.id })
            } catch (error) {
                console.error('Reputation calculation failed', error, { serviceId: service.id })
            }
        }

        // Refresh materialized view
        await this.supabase.rpc('refresh_service_rankings')

        console.log('Batch reputation update completed')
    }

    // Invalidate cache for a service
    async invalidateCache(serviceId: string) {
        await this.redis.del(`reputation:${serviceId}`)
    }
}
