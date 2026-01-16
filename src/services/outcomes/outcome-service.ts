/**
 * Outcome Recording Service
 * 
 * Records delivery outcomes for payments (delivered, failed, timeout)
 * per ARCHITECTURE.md specification
 */

import { supabase } from '../../lib/supabase';

export interface Outcome {
    id: string;
    paymentId: string;
    outcomeType: 'delivered' | 'failed' | 'timeout';
    latencyMs?: number;
    evidence?: Record<string, any>;
    createdAt: string;
}

export interface RecordOutcomeRequest {
    paymentId: string;
    outcomeType: 'delivered' | 'failed' | 'timeout';
    latencyMs?: number;
    evidence?: Record<string, any>;
}

export class OutcomeService {
    /**
     * Record an outcome for a payment
     */
    async record(request: RecordOutcomeRequest): Promise<Outcome> {
        const { data, error } = await supabase
            .from('outcomes')
            .insert({
                payment_id: request.paymentId,
                outcome_type: request.outcomeType,
                latency_ms: request.latencyMs,
                evidence: request.evidence,
            })
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to record outcome: ${error.message}`);
        }

        // Update payment status based on outcome
        await this.updatePaymentStatus(request.paymentId, request.outcomeType);

        // Update service reputation
        await this.updateServiceReputation(request.paymentId, request.outcomeType, request.latencyMs);

        return {
            id: data.id,
            paymentId: data.payment_id,
            outcomeType: data.outcome_type,
            latencyMs: data.latency_ms,
            evidence: data.evidence,
            createdAt: data.created_at,
        };
    }

    /**
     * Get outcomes for a payment
     */
    async getByPayment(paymentId: string): Promise<Outcome[]> {
        const { data, error } = await supabase
            .from('outcomes')
            .select('*')
            .eq('payment_id', paymentId);

        if (error || !data) {
            return [];
        }

        return data.map(d => ({
            id: d.id,
            paymentId: d.payment_id,
            outcomeType: d.outcome_type,
            latencyMs: d.latency_ms,
            evidence: d.evidence,
            createdAt: d.created_at,
        }));
    }

    /**
     * Update payment status based on outcome
     */
    private async updatePaymentStatus(
        paymentId: string,
        outcomeType: 'delivered' | 'failed' | 'timeout'
    ): Promise<void> {
        const status = outcomeType === 'delivered' ? 'settled' : 'failed';

        await supabase
            .from('payments')
            .update({ status })
            .eq('id', paymentId);
    }

    /**
     * Update service reputation based on outcome
     */
    private async updateServiceReputation(
        paymentId: string,
        outcomeType: 'delivered' | 'failed' | 'timeout',
        latencyMs?: number
    ): Promise<void> {
        // Get the payment to find related service
        const { data: payment } = await supabase
            .from('payments')
            .select('to_address')
            .eq('id', paymentId)
            .single();

        if (!payment) return;

        // Get or create reputation record
        const { data: existing } = await supabase
            .from('reputations')
            .select('*')
            .eq('service_id', payment.to_address)
            .single();

        const isSuccess = outcomeType === 'delivered';
        const totalPayments = (existing?.total_payments || 0) + 1;
        const successfulPayments = (existing?.successful_payments || 0) + (isSuccess ? 1 : 0);
        const failedPayments = (existing?.failed_payments || 0) + (isSuccess ? 0 : 1);

        // Calculate new average latency
        const prevAvg = existing?.avg_latency_ms || 0;
        const prevCount = existing?.total_payments || 0;
        const newAvgLatency = latencyMs
            ? Math.round((prevAvg * prevCount + latencyMs) / (prevCount + 1))
            : prevAvg;

        // Calculate reputation score
        const successRate = successfulPayments / totalPayments;
        const normalizedTotal = Math.min(totalPayments / 1000, 1);
        const latencyScore = Math.max(0, 1 - (newAvgLatency / 5000)); // 5s max

        const reputationScore = (
            0.5 * successRate +
            0.2 * normalizedTotal +
            0.2 * latencyScore +
            0.1 * 1 // Placeholder for recency weight
        ) * 100;

        await supabase
            .from('reputations')
            .upsert({
                service_id: payment.to_address,
                total_payments: totalPayments,
                successful_payments: successfulPayments,
                failed_payments: failedPayments,
                avg_latency_ms: newAvgLatency,
                reputation_score: reputationScore.toFixed(2),
                last_calculated: new Date().toISOString(),
            });
    }
}

export const outcomeService = new OutcomeService();
