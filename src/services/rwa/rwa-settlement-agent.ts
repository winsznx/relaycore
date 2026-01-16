/**
 * RWA Settlement Agent
 * 
 * Handles real-world service verification and settlement.
 * NOT asset tokenization - this is settlement infrastructure.
 * 
 * Flow:
 * 1. Service provider registers with SLA terms
 * 2. Agent requests off-chain execution
 * 3. Escrow locks funds
 * 4. Provider delivers proof of execution
 * 5. Agent verifies proof format
 * 6. Payment released or refunded based on SLA
 */

import { supabase } from '../../lib/supabase';
import logger from '../../lib/logger';
import { getEscrowAgent } from '../escrow/escrow-agent';
import { ethers } from 'ethers';

// Service types that qualify as RWA
export type RWAServiceType =
    | 'compliance_check'
    | 'market_report'
    | 'trade_confirmation'
    | 'settlement_reconciliation'
    | 'price_verification'
    | 'kyc_verification'
    | 'execution_proof'
    | 'data_attestation';

export interface SLATerms {
    maxLatencyMs: number;
    requiredFields: string[];
    proofFormat: 'json' | 'signed' | 'hashed';
    refundConditions: string[];
    validityPeriodSeconds: number;
}

export interface RWAServiceConfig {
    name: string;
    serviceType: RWAServiceType;
    description: string;
    provider: string;
    endpoint: string;
    pricePerCall: string;
    sla: SLATerms;
    verificationMethod: 'signature' | 'hash' | 'callback';
}

export interface ExecutionProof {
    serviceId: string;
    requestId: string;
    timestamp: number;
    result: Record<string, unknown>;
    signature?: string;
    hash?: string;
    externalRef?: string;
    providerAddress: string;
}

export interface VerificationResult {
    valid: boolean;
    slaMetrics: {
        latencyMs: number;
        fieldsPresent: string[];
        fieldsMissing: string[];
        proofFormatValid: boolean;
        withinValidity: boolean;
    };
    reason?: string;
}

export interface SettlementResult {
    success: boolean;
    requestId: string;
    proof?: ExecutionProof;
    verification?: VerificationResult;
    payment?: {
        released: boolean;
        amount: string;
        txHash?: string;
    };
    refund?: {
        reason: string;
        amount: string;
        txHash?: string;
    };
}

export class RWASettlementAgent {
    private registeredServices: Map<string, RWAServiceConfig> = new Map();

    // ============================================
    // SERVICE REGISTRATION
    // ============================================

    /**
     * Register an RWA service with SLA terms
     */
    async registerService(config: RWAServiceConfig): Promise<string> {
        const serviceId = `rwa_${config.serviceType}_${Date.now()}`;

        // Store in memory
        this.registeredServices.set(serviceId, config);

        // Persist to database
        try {
            await supabase.from('services').insert({
                id: serviceId,
                name: config.name,
                service_type: config.serviceType,
                description: config.description,
                endpoint_url: config.endpoint,
                owner_address: config.provider,
                price_per_call: config.pricePerCall,
                category: 'rwa.settlement',
                metadata: {
                    sla: config.sla,
                    verificationMethod: config.verificationMethod,
                    isRWA: true
                },
                is_active: true
            });

            logger.info('RWA service registered', { serviceId, type: config.serviceType });
        } catch (error) {
            logger.error('Failed to persist RWA service', error as Error);
        }

        return serviceId;
    }

    /**
     * Get registered RWA service
     */
    getService(serviceId: string): RWAServiceConfig | undefined {
        return this.registeredServices.get(serviceId);
    }

    /**
     * List all RWA services
     */
    async listServices(serviceType?: RWAServiceType): Promise<RWAServiceConfig[]> {
        try {
            let query = supabase
                .from('services')
                .select('*')
                .eq('category', 'rwa.settlement')
                .eq('is_active', true);

            if (serviceType) {
                query = query.eq('service_type', serviceType);
            }

            const { data } = await query;

            return (data || []).map(s => ({
                name: s.name,
                serviceType: s.service_type as RWAServiceType,
                description: s.description,
                provider: s.owner_address,
                endpoint: s.endpoint_url,
                pricePerCall: s.price_per_call,
                sla: s.metadata?.sla || {},
                verificationMethod: s.metadata?.verificationMethod || 'hash'
            }));
        } catch {
            return Array.from(this.registeredServices.values()).filter(
                s => !serviceType || s.serviceType === serviceType
            );
        }
    }

    // ============================================
    // EXECUTION REQUEST
    // ============================================

    /**
     * Request off-chain execution with escrow-backed payment
     */
    async requestExecution(
        serviceId: string,
        sessionId: number,
        agentAddress: string,
        input: Record<string, unknown>
    ): Promise<{
        requestId: string;
        status: 'pending' | 'rejected';
        reason?: string;
    }> {
        const service = this.registeredServices.get(serviceId);
        if (!service) {
            return { requestId: '', status: 'rejected', reason: 'Service not found' };
        }

        // Check escrow session has funds
        const escrow = getEscrowAgent();
        const check = await escrow.canExecute(sessionId, agentAddress, service.pricePerCall);

        if (!check.allowed) {
            return { requestId: '', status: 'rejected', reason: check.reason };
        }

        const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        // Record execution request
        try {
            await supabase.from('rwa_execution_requests').insert({
                request_id: requestId,
                service_id: serviceId,
                session_id: sessionId,
                agent_address: agentAddress,
                input: input,
                price: service.pricePerCall,
                sla_terms: service.sla,
                status: 'pending',
                requested_at: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Failed to record execution request', error as Error);
        }

        logger.info('RWA execution requested', { requestId, serviceId, sessionId });

        return { requestId, status: 'pending' };
    }

    // ============================================
    // PROOF SUBMISSION & VERIFICATION
    // ============================================

    /**
     * Submit execution proof for verification
     */
    async submitProof(proof: ExecutionProof): Promise<VerificationResult> {
        // Get the original request
        const { data: request } = await supabase
            .from('rwa_execution_requests')
            .select('*')
            .eq('request_id', proof.requestId)
            .single();

        if (!request) {
            return {
                valid: false,
                slaMetrics: {
                    latencyMs: 0,
                    fieldsPresent: [],
                    fieldsMissing: [],
                    proofFormatValid: false,
                    withinValidity: false
                },
                reason: 'Request not found'
            };
        }

        const service = this.registeredServices.get(request.service_id);
        const sla = service?.sla || request.sla_terms;

        // Verify SLA compliance
        const verification = this.verifySLA(proof, sla, request.requested_at);

        // Record verification result
        try {
            await supabase.from('rwa_execution_requests')
                .update({
                    proof: proof,
                    verification: verification,
                    status: verification.valid ? 'verified' : 'failed',
                    verified_at: new Date().toISOString()
                })
                .eq('request_id', proof.requestId);
        } catch (error) {
            logger.error('Failed to update verification', error as Error);
        }

        return verification;
    }

    /**
     * Verify proof against SLA terms
     */
    private verifySLA(
        proof: ExecutionProof,
        sla: SLATerms,
        requestedAt: string
    ): VerificationResult {
        const now = Date.now();
        const requestTime = new Date(requestedAt).getTime();
        const latencyMs = proof.timestamp - requestTime;

        // Check required fields
        const resultKeys = Object.keys(proof.result);
        const fieldsPresent = sla.requiredFields.filter(f => resultKeys.includes(f));
        const fieldsMissing = sla.requiredFields.filter(f => !resultKeys.includes(f));

        // Check proof format
        let proofFormatValid = false;
        if (sla.proofFormat === 'json') {
            proofFormatValid = typeof proof.result === 'object';
        } else if (sla.proofFormat === 'signed') {
            proofFormatValid = !!proof.signature && this.verifySignature(proof);
        } else if (sla.proofFormat === 'hashed') {
            proofFormatValid = !!proof.hash && this.verifyHash(proof);
        }

        // Check validity period
        const withinValidity = (now - proof.timestamp) < (sla.validityPeriodSeconds * 1000);

        const metrics = {
            latencyMs,
            fieldsPresent,
            fieldsMissing,
            proofFormatValid,
            withinValidity
        };

        // Determine if SLA is met
        const latencyOk = latencyMs <= sla.maxLatencyMs;
        const fieldsOk = fieldsMissing.length === 0;
        const valid = latencyOk && fieldsOk && proofFormatValid && withinValidity;

        let reason: string | undefined;
        if (!valid) {
            if (!latencyOk) reason = `Latency ${latencyMs}ms exceeds SLA ${sla.maxLatencyMs}ms`;
            else if (!fieldsOk) reason = `Missing required fields: ${fieldsMissing.join(', ')}`;
            else if (!proofFormatValid) reason = `Invalid proof format: expected ${sla.proofFormat}`;
            else if (!withinValidity) reason = 'Proof expired';
        }

        return { valid, slaMetrics: metrics, reason };
    }

    /**
     * Verify cryptographic signature on proof
     */
    private verifySignature(proof: ExecutionProof): boolean {
        if (!proof.signature) return false;

        try {
            const message = JSON.stringify({
                requestId: proof.requestId,
                timestamp: proof.timestamp,
                result: proof.result
            });

            const recoveredAddress = ethers.verifyMessage(message, proof.signature);
            return recoveredAddress.toLowerCase() === proof.providerAddress.toLowerCase();
        } catch {
            return false;
        }
    }

    /**
     * Verify hash integrity of proof
     */
    private verifyHash(proof: ExecutionProof): boolean {
        if (!proof.hash) return false;

        try {
            const payload = JSON.stringify({
                requestId: proof.requestId,
                timestamp: proof.timestamp,
                result: proof.result
            });

            const expectedHash = ethers.keccak256(ethers.toUtf8Bytes(payload));
            return expectedHash === proof.hash;
        } catch {
            return false;
        }
    }

    // ============================================
    // SETTLEMENT
    // ============================================

    /**
     * Settle execution based on verification
     */
    async settle(requestId: string): Promise<SettlementResult> {
        const { data: request } = await supabase
            .from('rwa_execution_requests')
            .select('*')
            .eq('request_id', requestId)
            .single();

        if (!request) {
            return { success: false, requestId, refund: { reason: 'Request not found', amount: '0' } };
        }

        if (request.status === 'settled') {
            return { success: true, requestId, proof: request.proof, verification: request.verification };
        }

        const escrow = getEscrowAgent();
        const verification: VerificationResult = request.verification;

        if (verification?.valid) {
            // SLA met - release payment to provider
            const service = this.registeredServices.get(request.service_id);
            const provider = service?.provider || request.proof?.providerAddress;

            if (!provider) {
                return {
                    success: false,
                    requestId,
                    refund: { reason: 'Provider address not found', amount: request.price }
                };
            }

            const release = await escrow.releasePayment(
                request.session_id,
                provider,
                request.price,
                requestId
            );

            await supabase.from('rwa_execution_requests')
                .update({ status: 'settled', settled_at: new Date().toISOString() })
                .eq('request_id', requestId);

            return {
                success: true,
                requestId,
                proof: request.proof,
                verification,
                payment: {
                    released: release.success,
                    amount: request.price,
                    txHash: release.txHash
                }
            };
        } else {
            // SLA failed - refund to session owner
            const refundResult = await escrow.refund(request.session_id);

            await supabase.from('rwa_execution_requests')
                .update({ status: 'refunded', settled_at: new Date().toISOString() })
                .eq('request_id', requestId);

            return {
                success: false,
                requestId,
                verification,
                refund: {
                    reason: verification?.reason || 'SLA not met',
                    amount: refundResult.amount,
                    txHash: refundResult.txHash
                }
            };
        }
    }

    /**
     * Execute full RWA flow: request → fetch → verify → settle
     */
    async executeWithSettlement<T>(
        serviceId: string,
        sessionId: number,
        agentAddress: string,
        input: Record<string, unknown>,
        fetchProof: (requestId: string) => Promise<ExecutionProof>
    ): Promise<SettlementResult & { result?: T }> {
        // 1. Request execution
        const request = await this.requestExecution(serviceId, sessionId, agentAddress, input);
        if (request.status === 'rejected') {
            return {
                success: false,
                requestId: request.requestId,
                refund: { reason: request.reason || 'Request rejected', amount: '0' }
            };
        }

        // 2. Fetch proof from provider
        let proof: ExecutionProof;
        try {
            proof = await fetchProof(request.requestId);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to fetch proof';
            return {
                success: false,
                requestId: request.requestId,
                refund: { reason: message, amount: '0' }
            };
        }

        // 3. Submit and verify proof
        const verification = await this.submitProof(proof);

        // 4. Settle based on verification
        const settlement = await this.settle(request.requestId);

        return {
            ...settlement,
            result: verification.valid ? (proof.result as unknown as T) : undefined
        };
    }
}

// Singleton instance
let rwaAgent: RWASettlementAgent | null = null;

export function getRWASettlementAgent(): RWASettlementAgent {
    if (!rwaAgent) {
        rwaAgent = new RWASettlementAgent();
    }
    return rwaAgent;
}

export function resetRWAAgent(): void {
    rwaAgent = null;
}
