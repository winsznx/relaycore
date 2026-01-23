/**
 * Escrow Payment Integration Helper
 * 
 * Provides utilities for checking and using escrow sessions for agent payments.
 * Used by both the meta-agent service and the SDK.
 */

import { supabase } from '../../lib/supabase.js';
import logger from '../../lib/logger.js';

export interface EscrowSession {
    session_id: string;
    owner_address: string;
    escrow_agent: string;
    deposited: string;
    released: string;
    max_spend: string;
    expiry: string;
    is_active: boolean;
}

export interface PaymentResult {
    method: 'escrow' | 'direct';
    txHash?: string;
    escrowSessionId?: string;
    amount: string;
    success: boolean;
    error?: string;
}

export class EscrowPaymentHelper {
    private apiUrl: string;

    constructor(apiUrl?: string) {
        this.apiUrl = apiUrl || process.env.RELAY_CORE_API_URL || 'https://api.relaycore.xyz';
    }

    /**
     * Find active escrow session for a user with sufficient balance
     */
    async findActiveSession(
        ownerAddress: string,
        requiredAmount: number
    ): Promise<EscrowSession | null> {
        try {
            const { data: sessions, error } = await supabase
                .from('escrow_sessions')
                .select('*')
                .eq('owner_address', ownerAddress)
                .eq('is_active', true)
                .gte('expiry', new Date().toISOString())
                .order('created_at', { ascending: false });

            if (error || !sessions || sessions.length === 0) {
                return null;
            }

            // Find first session with sufficient balance
            for (const session of sessions) {
                const remaining = parseFloat(session.deposited) - parseFloat(session.released || '0');
                if (remaining >= requiredAmount) {
                    return session;
                }
            }

            return null;
        } catch (error) {
            logger.error('Error finding active escrow session', error as Error);
            return null;
        }
    }

    /**
     * Pay from escrow session
     */
    async payFromEscrow(
        sessionId: string,
        agentAddress: string,
        amount: string,
        executionId: string
    ): Promise<PaymentResult> {
        try {
            const response = await fetch(`${this.apiUrl}/api/sessions/${sessionId}/release`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agent: agentAddress,
                    amount,
                    executionId
                })
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ message: 'Unknown error' }));
                return {
                    method: 'escrow',
                    amount,
                    success: false,
                    error: error.message || 'Escrow release failed'
                };
            }

            const data = await response.json();
            return {
                method: 'escrow',
                txHash: data.txHash,
                escrowSessionId: sessionId,
                amount,
                success: true
            };
        } catch (error) {
            logger.error('Escrow payment failed', error as Error);
            return {
                method: 'escrow',
                amount,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Attempt to pay using escrow, fall back to direct payment if needed
     */
    async payWithEscrowOrDirect(
        ownerAddress: string,
        agentAddress: string,
        amount: string,
        executionId: string
    ): Promise<PaymentResult> {
        const amountNum = parseFloat(amount);

        // Try escrow first
        const session = await this.findActiveSession(ownerAddress, amountNum);

        if (session) {
            logger.info('Using escrow session for payment', {
                sessionId: session.session_id,
                amount,
                remaining: parseFloat(session.deposited) - parseFloat(session.released || '0')
            });

            const result = await this.payFromEscrow(
                session.session_id,
                agentAddress,
                amount,
                executionId
            );

            if (result.success) {
                return result;
            }

            logger.warn('Escrow payment failed, falling back to direct payment', {
                error: result.error
            });
        }

        // Fall back to direct payment
        logger.info('Using direct x402 payment', { amount });
        return {
            method: 'direct',
            amount,
            success: true // Direct payment handled by x402 middleware
        };
    }

    /**
     * Get all active sessions for a user
     */
    async getActiveSessions(ownerAddress: string): Promise<EscrowSession[]> {
        try {
            const { data: sessions, error } = await supabase
                .from('escrow_sessions')
                .select('*')
                .eq('owner_address', ownerAddress)
                .eq('is_active', true)
                .gte('expiry', new Date().toISOString())
                .order('created_at', { ascending: false });

            if (error) {
                logger.error('Error fetching active sessions', error);
                return [];
            }

            return sessions || [];
        } catch (error) {
            logger.error('Error getting active sessions', error as Error);
            return [];
        }
    }

    /**
     * Get session balance
     */
    getSessionBalance(session: EscrowSession): {
        deposited: number;
        released: number;
        remaining: number;
    } {
        const deposited = parseFloat(session.deposited);
        const released = parseFloat(session.released || '0');
        const remaining = deposited - released;

        return { deposited, released, remaining };
    }
}

// Singleton instance
export const escrowPaymentHelper = new EscrowPaymentHelper();
