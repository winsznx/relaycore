/**
 * Agent-Service Linker
 * 
 * Links agent invocations to service records so that the reputation engine
 * can track metrics for agents displayed in the marketplace.
 */

import { supabase } from '../../lib/supabase';

// Cache of agent name -> service ID mappings
const agentServiceCache = new Map<string, string>();

/**
 * Get the service_id for an agent name
 * 
 * @param agentName The name of the agent (e.g., "PerpAI Quote")
 * @returns The service_id or null if not found
 */
export async function getServiceIdForAgent(agentName: string): Promise<string | null> {
    // Check cache first
    if (agentServiceCache.has(agentName)) {
        return agentServiceCache.get(agentName)!;
    }

    try {
        const { data, error } = await supabase
            .from('services')
            .select('id')
            .eq('name', agentName)
            .single();

        if (error || !data) {
            console.warn(`[AgentServiceLinker] No service found for agent: ${agentName}`);
            return null;
        }

        // Cache the mapping
        agentServiceCache.set(agentName, data.id);
        return data.id;
    } catch (err) {
        console.error(`[AgentServiceLinker] Error looking up service for ${agentName}:`, err);
        return null;
    }
}

/**
 * Record an agent invocation payment linked to its service record
 * 
 * This updates the service's reputation in the marketplace
 */
export async function recordAgentPayment(params: {
    agentName: string;
    agentId: string;
    paymentId: string;
    payerAddress: string;
    amount: string;
    latencyMs: number;
    success: boolean;
}): Promise<void> {
    const { agentName, paymentId, payerAddress, amount, latencyMs, success } = params;

    // Get service_id for this agent
    const serviceId = await getServiceIdForAgent(agentName);
    if (!serviceId) {
        console.log(`[AgentServiceLinker] Skipping payment record - no service found for ${agentName}`);
        return;
    }

    try {
        // Record payment linked to service
        const { error: paymentError } = await supabase.from('payments').upsert({
            payment_id: paymentId,
            service_id: serviceId,
            from_address: payerAddress,
            amount: amount,
            status: success ? 'success' : 'failed',
            latency_ms: latencyMs,
            timestamp: new Date().toISOString(),
        });

        if (paymentError) {
            console.error(`[AgentServiceLinker] Failed to record payment:`, paymentError);
            return;
        }

        console.log(`[AgentServiceLinker] Recorded payment for ${agentName} (service: ${serviceId})`);

        // Update reputation incrementally (faster than full recalculation)
        await updateServiceReputation(serviceId, latencyMs, success);
    } catch (err) {
        console.error(`[AgentServiceLinker] Error recording agent payment:`, err);
    }
}

/**
 * Incrementally update service reputation based on new invocation
 */
async function updateServiceReputation(serviceId: string, latencyMs: number, success: boolean): Promise<void> {
    try {
        // Get current reputation
        const { data: current } = await supabase
            .from('reputations')
            .select('*')
            .eq('service_id', serviceId)
            .single();

        if (!current) {
            // Create initial reputation record
            await supabase.from('reputations').insert({
                service_id: serviceId,
                reputation_score: success ? 80 : 60,
                total_payments: 1,
                successful_payments: success ? 1 : 0,
                failed_payments: success ? 0 : 1,
                avg_latency_ms: latencyMs,
                unique_payers: 1,
                success_rate: success ? 100 : 0,
            });
            return;
        }

        // Calculate new values incrementally
        const totalPayments = (current.total_payments || 0) + 1;
        const successfulPayments = (current.successful_payments || 0) + (success ? 1 : 0);
        const failedPayments = (current.failed_payments || 0) + (success ? 0 : 1);
        const successRate = (successfulPayments / totalPayments) * 100;

        // Rolling average for latency
        const oldAvgLatency = current.avg_latency_ms || 0;
        const avgLatencyMs = Math.round((oldAvgLatency * (totalPayments - 1) + latencyMs) / totalPayments);

        // Calculate new reputation score (simple weighted formula)
        // Success rate: 50%, Speed: 30%, Volume: 20%
        const speedScore = Math.max(0, 100 - (avgLatencyMs / 50)); // Penalty for slow responses
        const volumeScore = Math.min(100, Math.log10(totalPayments + 1) * 25); // Log scale for volume
        const reputationScore = Math.round(
            (successRate * 0.5) + (speedScore * 0.3) + (volumeScore * 0.2)
        );

        // Update reputation
        await supabase.from('reputations').update({
            total_payments: totalPayments,
            successful_payments: successfulPayments,
            failed_payments: failedPayments,
            avg_latency_ms: avgLatencyMs,
            success_rate: Math.round(successRate * 100) / 100,
            reputation_score: Math.min(100, Math.max(0, reputationScore)),
            last_calculated: new Date().toISOString(),
        }).eq('service_id', serviceId);

        console.log(`[AgentServiceLinker] Updated reputation for service ${serviceId}: score=${reputationScore}`);
    } catch (err) {
        console.error(`[AgentServiceLinker] Error updating reputation:`, err);
    }
}

/**
 * Clear the agent-service cache (for testing or after service updates)
 */
export function clearAgentServiceCache(): void {
    agentServiceCache.clear();
}
