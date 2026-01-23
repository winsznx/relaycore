/**
 * RWA Agent Service - Phase 9 Implementation
 * 
 * Manages the lifecycle of RWA (Real-World Asset) operations:
 * - Asset minting with handoff signing
 * - Lifecycle state management
 * - Escrow-backed payments
 * - SLA verification and settlement
 */

import { supabase } from '../../lib/supabase';
import logger from '../../lib/logger';
import { facilitatorService } from '../x402/facilitator-service.js';
import { escrowPaymentHelper, type EscrowSession } from '../escrow/escrow-payment-helper.js';

// ============================================
// INTERFACES
// ============================================

export interface RWAAsset {
    assetId: string;
    type: 'property' | 'invoice' | 'receivable' | 'equipment' | 'commodity' | 'bond';
    name: string;
    description: string;
    owner: string;
    value: string;
    currency: string;
    status: 'pending' | 'minted' | 'active' | 'frozen' | 'redeemed';
    metadata: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}

export interface RWAMintRequest {
    type: RWAAsset['type'];
    name: string;
    description: string;
    owner: string;
    value: string;
    currency: string;
    metadata?: Record<string, unknown>;
    sessionId?: number; // Escrow session for payment
}

export interface RWALifecycleEvent {
    eventId: string;
    assetId: string;
    eventType: 'mint' | 'transfer' | 'update' | 'freeze' | 'unfreeze' | 'redeem' | 'payment';
    actor: string;
    data: Record<string, unknown>;
    timestamp: Date;
    txHash?: string;
}

export interface RWASettlement {
    requestId: string;
    assetId: string;
    agentAddress: string;
    serviceType: string;
    price: string;
    status: 'pending' | 'verified' | 'settled' | 'refunded' | 'failed';
    slaMetrics?: {
        latencyMs: number;
        proofFormatValid: boolean;
    };
    settledAt?: Date;
}

// ============================================
// RWA AGENT SERVICE
// ============================================

export class RWAAgentService {
    private static instance: RWAAgentService;

    private constructor() { }

    static getInstance(): RWAAgentService {
        if (!RWAAgentService.instance) {
            RWAAgentService.instance = new RWAAgentService();
        }
        return RWAAgentService.instance;
    }

    /**
     * Mint a new RWA asset with x402 minting fee
     * Agents pay minting fee from session budget
     */
    async mintAsset(request: RWAMintRequest): Promise<{
        assetId: string;
        handoffRequired: boolean;
        mintingFee: string;
        handoffData?: {
            action: string;
            asset: Partial<RWAAsset>;
            deadline: number;
        };
    }> {
        const assetId = `rwa_${request.type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        // Calculate minting fee (0.1% of asset value, min 0.01 USDC)
        const assetValue = parseFloat(request.value);
        const mintingFee = Math.max(0.01, assetValue * 0.001).toFixed(4);

        // If sessionId provided, deduct minting fee from session
        if (request.sessionId) {
            const { data: session } = await supabase
                .from('escrow_sessions')
                .select('deposited, released, owner_address')
                .eq('session_id', request.sessionId)
                .single();

            if (!session) {
                throw new Error(`Session not found: ${request.sessionId}`);
            }

            const remaining = parseFloat(session.deposited) - parseFloat(session.released);
            const feeNum = parseFloat(mintingFee);

            if (remaining < feeNum) {
                throw new Error(`Insufficient session budget for minting fee: ${remaining} < ${feeNum}`);
            }

            // Record minting fee payment from session budget
            await supabase
                .from('session_payments')
                .insert({
                    session_id: String(request.sessionId),
                    agent_address: 'relay_protocol',
                    agent_name: 'RWA Minting Fee',
                    amount: mintingFee,
                    payment_method: 'session',
                    metadata: {
                        assetId,
                        assetType: request.type,
                        assetValue: request.value,
                        type: 'rwa_minting_fee'
                    }
                });

            // Update session released amount
            await supabase
                .from('escrow_sessions')
                .update({
                    released: (parseFloat(session.released) + feeNum).toString()
                })
                .eq('session_id', request.sessionId);

            logger.info('RWA minting fee paid via x402', {
                assetId,
                sessionId: request.sessionId,
                fee: mintingFee
            });
        }

        const asset: RWAAsset = {
            assetId,
            type: request.type,
            name: request.name,
            description: request.description,
            owner: request.owner,
            value: request.value,
            currency: request.currency,
            status: 'pending',
            metadata: {
                ...request.metadata,
                mintingFee,
                sessionId: request.sessionId
            },
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Store pending asset
        const { error } = await supabase
            .from('rwa_assets')
            .insert({
                asset_id: assetId,
                type: asset.type,
                name: asset.name,
                description: asset.description,
                owner_address: asset.owner,
                value: asset.value,
                currency: asset.currency,
                status: 'pending',
                metadata: asset.metadata,
                created_at: asset.createdAt.toISOString()
            });

        if (error) {
            logger.error('Failed to store RWA asset', error);
            throw new Error(`Failed to mint asset: ${error.message}`);
        }

        // Log lifecycle event
        await this.logLifecycleEvent({
            eventId: `evt_${Date.now()}`,
            assetId,
            eventType: 'mint',
            actor: request.owner,
            data: { request, mintingFee },
            timestamp: new Date()
        });

        logger.info('RWA asset mint initiated with x402 fee', {
            assetId,
            type: request.type,
            mintingFee,
            sessionId: request.sessionId
        });

        return {
            assetId,
            handoffRequired: true,
            mintingFee,
            handoffData: {
                action: 'rwa_mint',
                asset: {
                    assetId,
                    type: asset.type,
                    name: asset.name,
                    value: asset.value,
                    currency: asset.currency,
                    owner: asset.owner
                },
                deadline: Date.now() + 300000 // 5 min deadline
            }
        };
    }

    /**
     * Confirm asset mint after handoff signature
     */
    async confirmMint(assetId: string, txHash: string): Promise<RWAAsset> {
        const { data: asset, error: fetchError } = await supabase
            .from('rwa_assets')
            .select('*')
            .eq('asset_id', assetId)
            .single();

        if (fetchError || !asset) {
            throw new Error(`Asset not found: ${assetId}`);
        }

        const { error: updateError } = await supabase
            .from('rwa_assets')
            .update({
                status: 'minted',
                tx_hash: txHash,
                minted_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('asset_id', assetId);

        if (updateError) {
            throw new Error(`Failed to confirm mint: ${updateError.message}`);
        }

        await this.logLifecycleEvent({
            eventId: `evt_${Date.now()}`,
            assetId,
            eventType: 'mint',
            actor: asset.owner_address,
            data: { confirmed: true, txHash },
            timestamp: new Date(),
            txHash
        });

        logger.info('RWA asset minted', { assetId, txHash });

        return {
            assetId: asset.asset_id,
            type: asset.type,
            name: asset.name,
            description: asset.description,
            owner: asset.owner_address,
            value: asset.value,
            currency: asset.currency,
            status: 'minted',
            metadata: asset.metadata,
            createdAt: new Date(asset.created_at),
            updatedAt: new Date()
        };
    }

    /**
     * Get asset by ID
     */
    async getAsset(assetId: string): Promise<RWAAsset | null> {
        const { data, error } = await supabase
            .from('rwa_assets')
            .select('*')
            .eq('asset_id', assetId)
            .single();

        if (error || !data) return null;

        return {
            assetId: data.asset_id,
            type: data.type,
            name: data.name,
            description: data.description,
            owner: data.owner_address,
            value: data.value,
            currency: data.currency,
            status: data.status,
            metadata: data.metadata,
            createdAt: new Date(data.created_at),
            updatedAt: new Date(data.updated_at || data.created_at)
        };
    }

    /**
     * List assets by owner
     */
    async listAssets(owner?: string, type?: string): Promise<RWAAsset[]> {
        let query = supabase
            .from('rwa_assets')
            .select('*')
            .order('created_at', { ascending: false });

        if (owner) {
            query = query.eq('owner_address', owner);
        }
        if (type) {
            query = query.eq('type', type);
        }

        const { data, error } = await query.limit(100);

        if (error) {
            logger.error('Failed to list RWA assets', error);
            return [];
        }

        return (data || []).map(d => ({
            assetId: d.asset_id,
            type: d.type,
            name: d.name,
            description: d.description,
            owner: d.owner_address,
            value: d.value,
            currency: d.currency,
            status: d.status,
            metadata: d.metadata,
            createdAt: new Date(d.created_at),
            updatedAt: new Date(d.updated_at || d.created_at)
        }));
    }

    /**
     * Update asset lifecycle state
     */
    async updateAssetState(
        assetId: string,
        newStatus: RWAAsset['status'],
        actor: string,
        reason?: string
    ): Promise<RWAAsset> {
        const asset = await this.getAsset(assetId);
        if (!asset) {
            throw new Error(`Asset not found: ${assetId}`);
        }

        // Validate state transition
        const validTransitions: Record<string, string[]> = {
            pending: ['minted'],
            minted: ['active', 'frozen'],
            active: ['frozen', 'redeemed'],
            frozen: ['active', 'redeemed'],
            redeemed: []
        };

        if (!validTransitions[asset.status]?.includes(newStatus)) {
            throw new Error(`Invalid state transition: ${asset.status} -> ${newStatus}`);
        }

        const { error } = await supabase
            .from('rwa_assets')
            .update({
                status: newStatus,
                updated_at: new Date().toISOString()
            })
            .eq('asset_id', assetId);

        if (error) {
            throw new Error(`Failed to update asset: ${error.message}`);
        }

        await this.logLifecycleEvent({
            eventId: `evt_${Date.now()}`,
            assetId,
            eventType: newStatus === 'frozen' ? 'freeze' :
                newStatus === 'active' ? 'unfreeze' :
                    newStatus === 'redeemed' ? 'redeem' : 'update',
            actor,
            data: { previousStatus: asset.status, newStatus, reason },
            timestamp: new Date()
        });

        logger.info('RWA asset state updated', { assetId, from: asset.status, to: newStatus });

        return { ...asset, status: newStatus, updatedAt: new Date() };
    }

    /**
     * Execute RWA service with x402 payment
     * Supports two payment modes:
     * 1. Session-based: Pre-funded session budget (deducts from session)
     * 2. Direct x402: Real-time settlement via Facilitator SDK
     *
     * @param serviceId - The service to execute
     * @param sessionId - Session ID for payment (string format)
     * @param agentAddress - The agent executing the service
     * @param input - Service input parameters
     * @param paymentHeader - Optional x402 payment header for direct settlement
     */
    async executeService(
        serviceId: string,
        sessionId: string | number,
        agentAddress: string,
        input: Record<string, unknown>,
        paymentHeader?: string
    ): Promise<RWASettlement> {
        const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const sessionIdStr = String(sessionId);

        // Get service details
        const { data: service } = await supabase
            .from('services')
            .select('price_per_call, owner_address, endpoint_url')
            .eq('id', serviceId)
            .single();

        if (!service) {
            throw new Error(`Service not found: ${serviceId}`);
        }

        const price = service.price_per_call || '1.00';
        const priceNum = parseFloat(price);
        const priceBaseUnits = Math.round(priceNum * 1000000).toString(); // Convert to USDC base units (6 decimals)

        // Determine payment method and process payment
        let paymentMethod: 'session' | 'x402_direct' = 'session';
        let facilitatorTxHash: string | undefined;

        // Check session budget
        const { data: session } = await supabase
            .from('escrow_sessions')
            .select('deposited, released, max_spend, owner_address, is_active')
            .eq('session_id', sessionIdStr)
            .single();

        if (!session) {
            throw new Error(`Session not found: ${sessionIdStr}`);
        }

        if (!session.is_active) {
            throw new Error(`Session ${sessionIdStr} is not active`);
        }

        const remaining = parseFloat(session.deposited) - parseFloat(session.released || '0');
        if (remaining < priceNum) {
            throw new Error(`Insufficient session budget: ${remaining.toFixed(4)} USDC < ${priceNum.toFixed(4)} USDC required`);
        }

        // If payment header provided, attempt direct x402 settlement
        if (paymentHeader) {
            try {
                const paymentRequirements = facilitatorService.generatePaymentRequirements({
                    merchantAddress: service.owner_address || agentAddress,
                    amount: priceBaseUnits,
                    resourceUrl: `/api/rwa/execute/${serviceId}`,
                    description: `RWA service execution: ${serviceId}`
                });

                const settlementResult = await facilitatorService.settlePayment({
                    paymentHeader,
                    paymentRequirements
                });

                facilitatorTxHash = settlementResult.txHash;
                paymentMethod = 'x402_direct';

                logger.info('RWA payment settled via x402 Facilitator', {
                    requestId,
                    txHash: facilitatorTxHash
                });
            } catch (facilitatorError) {
                logger.error('x402 Facilitator settlement failed, falling back to session payment', facilitatorError as Error);
                // Fall back to session-based payment
            }
        }

        // Record payment and update session
        const newReleased = parseFloat(session.released || '0') + priceNum;

        const { error: updateError } = await supabase
            .from('escrow_sessions')
            .update({
                released: newReleased.toString(),
                updated_at: new Date().toISOString()
            })
            .eq('session_id', sessionIdStr);

        if (updateError) {
            logger.error('Failed to update session', updateError);
            throw new Error(`Session update failed: ${updateError.message}`);
        }

        // Record payment in session_payments table
        const { error: paymentError } = await supabase
            .from('session_payments')
            .insert({
                session_id: sessionIdStr,
                agent_address: agentAddress,
                agent_name: serviceId,
                amount: price,
                payment_method: paymentMethod,
                tx_hash: paymentMethod === 'session' ? `session_${sessionIdStr}_${requestId}` : undefined,
                facilitator_tx_hash: facilitatorTxHash,
                metadata: {
                    requestId,
                    serviceId,
                    input,
                    type: 'rwa_execution',
                    priceBaseUnits
                }
            });

        if (paymentError) {
            logger.error('Failed to record session payment', paymentError);
            // Rollback session update
            await supabase
                .from('escrow_sessions')
                .update({
                    released: session.released
                })
                .eq('session_id', sessionIdStr);
            throw new Error(`Payment recording failed: ${paymentError.message}`);
        }

        // Log to x402 audit
        await supabase.from('x402_audit_log').insert({
            action: 'rwa_execution_payment',
            session_id: sessionIdStr,
            payment_id: requestId,
            agent_address: agentAddress,
            amount: priceNum,
            facilitator_tx_hash: facilitatorTxHash,
            status: 'completed',
            metadata: {
                serviceId,
                paymentMethod,
                priceBaseUnits
            }
        });

        // Create execution request
        const { error } = await supabase
            .from('rwa_execution_requests')
            .insert({
                request_id: requestId,
                service_id: serviceId,
                session_id: sessionIdStr,
                agent_address: agentAddress,
                input,
                price,
                sla_terms: {
                    maxLatencyMs: 5000,
                    proofFormat: 'signed'
                },
                status: 'pending'
            });

        if (error) {
            logger.error('Failed to create RWA execution request', error);
            throw new Error(`Failed to execute service: ${error.message}`);
        }

        logger.info('RWA execution started', {
            requestId,
            serviceId,
            sessionId: sessionIdStr,
            price,
            paymentMethod,
            facilitatorTxHash,
            agentAddress
        });

        return {
            requestId,
            assetId: '',
            agentAddress,
            serviceType: serviceId,
            price,
            status: 'pending'
        };
    }

    /**
     * Settle RWA execution with proof verification and x402 payment settlement
     * If SLA met: Agent keeps payment
     * If SLA failed: Payment refunded to session
     */
    async settleExecution(
        requestId: string,
        proof: {
            timestamp: number;
            result: Record<string, unknown>;
            signature?: string;
        }
    ): Promise<RWASettlement> {
        const { data: request, error: fetchError } = await supabase
            .from('rwa_execution_requests')
            .select('*')
            .eq('request_id', requestId)
            .single();

        if (fetchError || !request) {
            throw new Error(`Request not found: ${requestId}`);
        }

        // Calculate SLA metrics
        const latencyMs = Date.now() - proof.timestamp;
        const maxLatencyMs = request.sla_terms?.maxLatencyMs || 5000;
        const proofFormatValid = !!proof.result;
        const slaMetValid = latencyMs <= maxLatencyMs && proofFormatValid;

        const status = slaMetValid ? 'settled' : 'refunded';

        // Handle x402 payment settlement
        if (!slaMetValid) {
            // SLA FAILED: Refund payment to session
            const priceNum = parseFloat(request.price);

            // Get current session state
            const { data: session } = await supabase
                .from('escrow_sessions')
                .select('released')
                .eq('session_id', request.session_id)
                .single();

            if (session) {
                // Reduce released amount (refund to session budget)
                await supabase
                    .from('escrow_sessions')
                    .update({
                        released: (parseFloat(session.released) - priceNum).toString()
                    })
                    .eq('session_id', request.session_id);

                // Record refund
                await supabase
                    .from('escrow_refunds')
                    .insert({
                        session_id: request.session_id,
                        amount: request.price,
                        reason: 'SLA not met',
                        metadata: {
                            requestId,
                            latencyMs,
                            maxLatencyMs,
                            proofFormatValid
                        }
                    });

                logger.info('RWA payment refunded due to SLA failure', {
                    requestId,
                    sessionId: request.session_id,
                    amount: request.price,
                    latencyMs,
                    maxLatencyMs
                });
            }
        } else {
            // SLA MET: Payment confirmed to agent
            // Update payment record to mark as confirmed
            await supabase
                .from('session_payments')
                .update({
                    metadata: {
                        ...request.input,
                        requestId,
                        confirmed: true,
                        settledAt: new Date().toISOString(),
                        slaMetrics: { latencyMs, proofFormatValid }
                    }
                })
                .eq('session_id', request.session_id)
                .eq('agent_address', request.agent_address)
                .eq('metadata->>requestId', requestId);

            // Record outcome for reputation (using 'delivered' for successful outcomes)
            await supabase
                .from('outcomes')
                .insert({
                    payment_id: requestId,
                    outcome_type: 'delivered',
                    latency_ms: latencyMs,
                    evidence: {
                        requestId,
                        proof,
                        slaMetrics: { latencyMs, proofFormatValid },
                        settlementStatus: 'success'
                    }
                });

            logger.info('RWA payment confirmed to agent', {
                requestId,
                agentAddress: request.agent_address,
                amount: request.price,
                latencyMs
            });
        }

        // Update request
        const { error: updateError } = await supabase
            .from('rwa_execution_requests')
            .update({
                proof,
                verification: {
                    valid: slaMetValid,
                    slaMetrics: { latencyMs, proofFormatValid },
                    reason: slaMetValid ? null : 'SLA not met'
                },
                status,
                verified_at: new Date().toISOString(),
                settled_at: slaMetValid ? new Date().toISOString() : null
            })
            .eq('request_id', requestId);

        if (updateError) {
            throw new Error(`Failed to settle: ${updateError.message}`);
        }

        logger.info('RWA execution settled with x402', {
            requestId,
            status,
            latencyMs,
            slaMetValid,
            paymentAction: slaMetValid ? 'confirmed' : 'refunded'
        });

        return {
            requestId,
            assetId: '',
            agentAddress: request.agent_address,
            serviceType: request.service_id,
            price: request.price,
            status,
            slaMetrics: { latencyMs, proofFormatValid },
            settledAt: slaMetValid ? new Date() : undefined
        };
    }

    /**
     * Get lifecycle events for an asset
     */
    async getLifecycleEvents(assetId: string): Promise<RWALifecycleEvent[]> {
        const { data, error } = await supabase
            .from('rwa_lifecycle_events')
            .select('*')
            .eq('asset_id', assetId)
            .order('timestamp', { ascending: false });

        if (error) {
            logger.error('Failed to fetch lifecycle events', error);
            return [];
        }

        return (data || []).map(e => ({
            eventId: e.event_id,
            assetId: e.asset_id,
            eventType: e.event_type,
            actor: e.actor,
            data: e.data,
            timestamp: new Date(e.timestamp),
            txHash: e.tx_hash
        }));
    }

    /**
     * Log a lifecycle event
     */
    private async logLifecycleEvent(event: RWALifecycleEvent): Promise<void> {
        const { error } = await supabase
            .from('rwa_lifecycle_events')
            .insert({
                event_id: event.eventId,
                asset_id: event.assetId,
                event_type: event.eventType,
                actor: event.actor,
                data: event.data,
                timestamp: event.timestamp.toISOString(),
                tx_hash: event.txHash
            });

        if (error) {
            logger.warn('Failed to log lifecycle event', error);
        }
    }

    /**
     * Get RWA stats for dashboard
     */
    async getStats(): Promise<{
        totalAssets: number;
        activeAssets: number;
        totalValue: number;
        byType: Record<string, number>;
        recentEvents: RWALifecycleEvent[];
    }> {
        const [assetsResult, eventsResult] = await Promise.all([
            supabase.from('rwa_assets').select('type, status, value'),
            supabase.from('rwa_lifecycle_events')
                .select('*')
                .order('timestamp', { ascending: false })
                .limit(10)
        ]);

        const assets = assetsResult.data || [];
        const events = eventsResult.data || [];

        const byType: Record<string, number> = {};
        let totalValue = 0;
        let activeAssets = 0;

        for (const asset of assets) {
            byType[asset.type] = (byType[asset.type] || 0) + 1;
            totalValue += parseFloat(asset.value || '0');
            if (asset.status === 'active' || asset.status === 'minted') {
                activeAssets++;
            }
        }

        return {
            totalAssets: assets.length,
            activeAssets,
            totalValue,
            byType,
            recentEvents: events.map(e => ({
                eventId: e.event_id,
                assetId: e.asset_id,
                eventType: e.event_type,
                actor: e.actor,
                data: e.data,
                timestamp: new Date(e.timestamp),
                txHash: e.tx_hash
            }))
        };
    }
}

// Export singleton
export const rwaAgentService = RWAAgentService.getInstance();
