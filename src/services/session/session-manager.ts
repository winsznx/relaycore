/**
 * SessionManager - Off-Chain Session Management
 * 
 * Manages spending sessions without on-chain escrow, leveraging
 * x402's gasless payment system for efficient budget control.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import logger from '../../lib/logger.js';
import type {
    Session,
    SessionPayment,
    CreateSessionParams,
    SessionBudgetCheck,
    RecordPaymentParams,
    SessionStats,
    SessionSummary
} from './types';

export class SessionManager {
    constructor(
        private supabase: SupabaseClient,
        private relayWalletAddress: string
    ) { }

    /**
     * Create a new spending session
     */
    async createSession(params: CreateSessionParams): Promise<Session> {
        const expiresAt = new Date(Date.now() + params.durationHours * 3600000);
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        logger.info('Creating session', {
            owner: params.ownerAddress,
            maxSpend: params.maxSpend,
            duration: params.durationHours
        });

        const { data, error } = await this.supabase
            .from('escrow_sessions')
            .insert({
                session_id: sessionId,
                owner_address: params.ownerAddress.toLowerCase(),
                escrow_agent: this.relayWalletAddress.toLowerCase(),
                max_spend: params.maxSpend,
                expiry: expiresAt.toISOString(),
                deposited: '0',
                released: '0',
                is_active: true,
                created_tx_hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                created_block: 0
            })
            .select()
            .single();

        if (error) {
            logger.error('Failed to create session', error);
            throw error;
        }

        logger.info('Session created', { sessionId: data.session_id });
        return data;
    }

    /**
     * Check if session can afford a payment
     */
    async checkBudget(sessionId: string, amount: string): Promise<SessionBudgetCheck> {
        const session = await this.getSession(sessionId);

        if (!session) {
            return {
                canAfford: false,
                remaining: '0',
                released: '0',
                maxSpend: '0',
                reason: 'Session not found'
            };
        }

        if (!session.is_active) {
            return {
                canAfford: false,
                remaining: '0',
                released: session.released,
                maxSpend: session.max_spend,
                reason: 'Session is inactive'
            };
        }

        const now = new Date();
        const expiresAt = new Date(session.expiry);
        if (now > expiresAt) {
            // Auto-expire the session
            await this.expireSession(sessionId);
            return {
                canAfford: false,
                remaining: '0',
                released: session.released,
                maxSpend: session.max_spend,
                reason: 'Session expired'
            };
        }

        const maxSpend = parseFloat(session.max_spend);
        const released = parseFloat(session.released);
        const requestAmount = parseFloat(amount);
        const remaining = maxSpend - released;

        const canAfford = remaining >= requestAmount;

        return {
            canAfford,
            remaining: remaining.toFixed(6),
            released: released.toFixed(6),
            maxSpend: maxSpend.toFixed(6),
            reason: canAfford ? undefined : `Insufficient budget (need ${requestAmount}, have ${remaining})`
        };
    }

    /**
     * Record a payment from the session
     */
    async recordPayment(sessionId: string, payment: RecordPaymentParams): Promise<void> {
        logger.info('Recording session payment', {
            sessionId,
            agent: payment.agentAddress,
            amount: payment.amount
        });

        // Update session spending atomically
        const { error: updateError } = await this.supabase.rpc(
            'increment_session_spending',
            { p_session_id: sessionId, p_amount: payment.amount }
        );

        if (updateError) {
            logger.error('Failed to update session spending', updateError);
            throw updateError;
        }

        // Record payment
        const { error: insertError } = await this.supabase
            .from('session_payments')
            .insert({
                session_id: sessionId,
                agent_address: payment.agentAddress,
                agent_name: payment.agentName,
                amount: payment.amount,
                tx_hash: payment.txHash,
                payment_method: payment.paymentMethod || 'x402',
                metadata: payment.metadata
            });

        if (insertError) {
            logger.error('Failed to record payment', insertError);
            throw insertError;
        }

        logger.info('Payment recorded successfully', { sessionId });
    }

    /**
     * Get session by ID
     */
    async getSession(sessionId: string): Promise<Session | null> {
        const { data, error } = await this.supabase
            .from('escrow_sessions')
            .select('*')
            .eq('session_id', sessionId)
            .single();

        if (error) {
            if (error.code !== 'PGRST116') { // Not found error
                logger.error('Failed to get session', error);
            }
            return null;
        }

        return data;
    }

    /**
     * Get active session for a user
     */
    async getActiveSession(ownerAddress: string): Promise<Session | null> {
        const { data, error } = await this.supabase
            .from('escrow_sessions')
            .select('*')
            .eq('owner_address', ownerAddress)
            .eq('is_active', true)
            .gt('expiry', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            logger.error('Failed to get active session', error);
            return null;
        }

        return data;
    }

    /**
     * Get all sessions for a user
     */
    async getUserSessions(ownerAddress: string, limit = 10): Promise<Session[]> {
        const { data, error } = await this.supabase
            .from('escrow_sessions')
            .select('*')
            .eq('owner_address', ownerAddress)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            logger.error('Failed to get user sessions', error);
            return [];
        }

        return data || [];
    }

    /**
     * Get payment history for a session
     */
    async getSessionPayments(sessionId: string): Promise<SessionPayment[]> {
        const { data, error } = await this.supabase
            .from('session_payments')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: false });

        if (error) {
            logger.error('Failed to get session payments', error);
            return [];
        }

        return data || [];
    }

    /**
     * Get session summary with payments and stats
     */
    async getSessionSummary(sessionId: string): Promise<SessionSummary | null> {
        const session = await this.getSession(sessionId);
        if (!session) return null;

        const payments = await this.getSessionPayments(sessionId);

        const maxSpend = parseFloat(session.max_spend);
        const released = parseFloat(session.released);
        const remaining = maxSpend - released;
        const utilizationPercent = maxSpend > 0 ? (released / maxSpend) * 100 : 0;

        return {
            session,
            payments,
            stats: {
                totalReleased: released.toFixed(6),
                paymentCount: payments.length,
                remaining: remaining.toFixed(6),
                utilizationPercent: parseFloat(utilizationPercent.toFixed(2))
            }
        };
    }

    /**
     * Close a session
     */
    async closeSession(sessionId: string): Promise<void> {
        logger.info('Closing session', { sessionId });

        const { error } = await this.supabase
            .from('escrow_sessions')
            .update({
                is_active: false,
                closed_at: new Date().toISOString()
            })
            .eq('session_id', sessionId);

        if (error) {
            logger.error('Failed to close session', error);
            throw error;
        }

        logger.info('Session closed', { sessionId });
    }

    /**
     * Expire a session
     */
    private async expireSession(sessionId: string): Promise<void> {
        logger.info('Expiring session', { sessionId });

        const { error } = await this.supabase
            .from('escrow_sessions')
            .update({ is_active: false })
            .eq('session_id', sessionId);

        if (error) {
            logger.error('Failed to expire session', error);
        }
    }

    /**
     * Get session statistics for a user
     */
    async getUserStats(ownerAddress: string): Promise<SessionStats> {
        const sessions = await this.getUserSessions(ownerAddress, 1000);

        const activeSessions = sessions.filter(s => s.is_active).length;
        const totalReleased = sessions.reduce((sum, s) => sum + parseFloat(s.released), 0);
        const averageSpend = sessions.length > 0 ? totalReleased / sessions.length : 0;

        return {
            totalSessions: sessions.length,
            activeSessions,
            totalReleased: totalReleased.toFixed(6),
            totalPayments: 0,
            averageSpendPerSession: averageSpend.toFixed(6)
        };
    }

    /**
     * Clean up expired sessions
     */
    async cleanupExpiredSessions(): Promise<number> {
        logger.info('Cleaning up expired sessions');

        const { data, error } = await this.supabase
            .from('escrow_sessions')
            .update({ is_active: false })
            .eq('is_active', true)
            .lt('expiry', new Date().toISOString())
            .select('session_id');

        if (error) {
            logger.error('Failed to cleanup expired sessions', error);
            return 0;
        }

        const count = data?.length || 0;
        logger.info(`Expired ${count} sessions`);
        return count;
    }
}
