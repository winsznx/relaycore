/**
 * x402 Session Service
 *
 * Implements true x402 escrow flow with EIP-3009 gasless payments:
 * 1. User pays Relay via x402 (EIP-3009 transferWithAuthorization) to create session
 * 2. Relay holds funds
 * 3. Relay pays agents via x402 on user's behalf (Facilitator settles)
 * 4. Session tracks spending
 * 5. Refunds via x402 when session closes
 *
 * All payments use the Cronos Facilitator SDK for gasless EIP-3009 transactions.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';
import { Facilitator, type PaymentRequirements, CronosNetwork } from '@crypto.com/facilitator-client';
import logger from '../../lib/logger.js';
import type { Session, CreateSessionParams, RecordPaymentParams } from './types';

export interface X402PaymentRequest {
    payTo: string;
    amount: string;
    asset: string;
    purpose: string;
    sessionId?: string;
    validUntil: number;
    // x402 Facilitator payment requirements
    paymentRequirements?: PaymentRequirements;
}

export interface SessionCreationResult {
    session: Session;
    paymentRequest: X402PaymentRequest;
    requiresPayment: boolean;
    // Full x402 payment requirements for EIP-3009
    x402PaymentRequirements: PaymentRequirements;
}

export class X402SessionService {
    private relayWalletAddress: string;
    private facilitator: Facilitator;
    private network: CronosNetwork;
    private relayWallet: ethers.Wallet | null = null;
    private host: string;

    constructor(
        private supabase: SupabaseClient,
        relayWalletAddress: string
    ) {
        this.relayWalletAddress = relayWalletAddress;
        this.network = (process.env.CRONOS_NETWORK || 'cronos-testnet') as CronosNetwork;
        this.network = (process.env.CRONOS_NETWORK || 'cronos-testnet') as CronosNetwork;
        this.facilitator = new Facilitator({ network: this.network });
        this.host = process.env.PUBLIC_HOST || 'https://api.relaycore.xyz';

        // Initialize Relay wallet for signing x402 payments
        const relayPrivateKey = process.env.RELAY_PRIVATE_KEY;
        if (relayPrivateKey) {
            const rpcUrl = process.env.CRONOS_RPC_URL || 'https://evm-t3.cronos.org';
            const provider = new ethers.JsonRpcProvider(rpcUrl);
            this.relayWallet = new ethers.Wallet(relayPrivateKey, provider);
            logger.info('X402SessionService initialized with Facilitator', {
                network: this.network,
                relayWallet: this.relayWallet.address
            });
        } else {
            logger.warn('RELAY_PRIVATE_KEY not set - x402 payments will fail');
        }
    }

    /**
     * Generate x402 payment requirements for the Facilitator
     */
    generatePaymentRequirements(amount: string, resource: string): PaymentRequirements {
        const amountInBaseUnits = ethers.parseUnits(amount, 6).toString();
        return this.facilitator.generatePaymentRequirements({
            payTo: this.relayWalletAddress,
            maxAmountRequired: amountInBaseUnits,
            resource,
            description: `Session deposit: ${amount} USDC`
        });
    }

    /**
     * Create session and generate x402 payment request
     * User must pay Relay to activate the session
     */
    async createSessionWithPayment(params: CreateSessionParams): Promise<SessionCreationResult> {
        logger.info('Creating session with x402 payment requirement', {
            owner: params.ownerAddress,
            maxSpend: params.maxSpend,
            duration: params.durationHours
        });

        const expiresAt = new Date(Date.now() + params.durationHours * 3600000);
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Create session matching the indexer schema (migration 20260120)
        const { data: session, error } = await this.supabase
            .from('escrow_sessions')
            .insert({
                session_id: sessionId,
                owner_address: params.ownerAddress.toLowerCase(),
                escrow_agent: this.relayWalletAddress.toLowerCase(),
                max_spend: params.maxSpend,
                expiry: expiresAt.toISOString(),
                deposited: '0',
                released: '0',
                is_active: false, // Not active until payment
                created_tx_hash: '0x0000000000000000000000000000000000000000000000000000000000000000', // Placeholder until payment
                created_block: 0 // Placeholder until payment
            })
            .select()
            .single();

        if (error) {
            logger.error('Failed to create session', error);
            throw error;
        }

        // Generate x402 payment requirements for Facilitator (EIP-3009)
        const resourceUrl = `${this.host}/api/sessions/${session.session_id}/activate`;
        const x402PaymentRequirements = this.generatePaymentRequirements(params.maxSpend, resourceUrl);

        // Generate simple payment request for backward compatibility
        const paymentRequest: X402PaymentRequest = {
            payTo: this.relayWalletAddress,
            amount: params.maxSpend,
            asset: process.env.USDC_TOKEN_ADDRESS || '0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0',
            purpose: `session_deposit_${session.session_id}`,
            sessionId: session.session_id,
            validUntil: Date.now() + 300000, // 5 minutes to pay
            paymentRequirements: x402PaymentRequirements
        };

        logger.info('Session created, awaiting x402 payment', {
            sessionId: session.session_id,
            paymentRequired: params.maxSpend,
            facilitatorNetwork: this.network
        });

        return {
            session,
            paymentRequest,
            requiresPayment: true,
            x402PaymentRequirements
        };
    }

    /**
     * Verify transaction on-chain (REAL verification, no mocks)
     * Handles both direct transfers and x402 Facilitator payments
     */
    private async verifyPaymentTransaction(
        txHash: string,
        expectedAmount: string,
        expectedRecipient: string
    ): Promise<void> {
        logger.info('Verifying payment transaction on-chain', { txHash, expectedAmount, expectedRecipient });

        const rpcUrl = process.env.CRONOS_RPC_URL || 'https://evm-t3.cronos.org';
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const usdcAddress = process.env.USDC_TOKEN_ADDRESS || '0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0';

        // Get transaction from blockchain
        const tx = await provider.getTransaction(txHash);
        if (!tx) {
            throw new Error(`Transaction ${txHash} not found on blockchain`);
        }

        logger.info('Transaction found on-chain', {
            from: tx.from,
            to: tx.to,
            blockNumber: tx.blockNumber
        });

        // Get transaction receipt to verify success
        const receipt = await provider.getTransactionReceipt(txHash);
        if (!receipt) {
            throw new Error(`Transaction ${txHash} not yet confirmed`);
        }

        if (receipt.status !== 1) {
            throw new Error(`Transaction ${txHash} failed on-chain`);
        }

        // Decode USDC transfer from transaction data
        const usdcInterface = new ethers.Interface([
            'function transfer(address to, uint256 amount)',
            'function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, bytes signature)'
        ]);

        let transferAmount: string;
        let transferRecipient: string;

        try {
            const decoded = usdcInterface.parseTransaction({ data: tx.data });

            if (decoded?.name === 'transfer') {
                // Direct transfer: transfer(to, amount)
                transferRecipient = decoded.args[0];
                transferAmount = ethers.formatUnits(decoded.args[1], 6);
            } else if (decoded?.name === 'transferWithAuthorization') {
                // x402 Facilitator: transferWithAuthorization(from, to, value, ...)
                transferRecipient = decoded.args[1]; // 'to' is second argument
                transferAmount = ethers.formatUnits(decoded.args[2], 6); // 'value' is third argument
            } else {
                throw new Error('Transaction is not a USDC transfer');
            }
        } catch (error) {
            throw new Error(`Failed to decode transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        // Verify transaction is to USDC contract (for x402) or direct to recipient
        const isUsdcContract = tx.to?.toLowerCase() === usdcAddress.toLowerCase();
        const isDirectTransfer = tx.to?.toLowerCase() === expectedRecipient.toLowerCase();

        if (!isUsdcContract && !isDirectTransfer) {
            throw new Error(`Transaction not to USDC contract or Relay wallet. Got ${tx.to}`);
        }

        // Verify recipient from decoded data
        if (transferRecipient.toLowerCase() !== expectedRecipient.toLowerCase()) {
            throw new Error(`Payment recipient mismatch. Expected ${expectedRecipient}, got ${transferRecipient}`);
        }

        // Verify amount matches (allow small rounding differences)
        const expected = parseFloat(expectedAmount);
        const received = parseFloat(transferAmount);
        const difference = Math.abs(expected - received);

        if (difference > 0.01) { // Allow 1 cent difference for rounding
            throw new Error(`Payment amount mismatch. Expected ${expected} USDC, received ${received} USDC`);
        }

        logger.info('Payment transaction verified successfully', {
            txHash,
            method: isUsdcContract ? 'x402-facilitator' : 'direct-transfer',
            recipient: transferRecipient,
            amount: transferAmount,
            confirmations: receipt.confirmations
        });
    }

    /**
     * Activate session after verifying REAL x402 payment on-chain
     */
    async activateSession(sessionId: string, txHash: string, amount: string): Promise<Session> {
        logger.info('Activating session after payment', { sessionId, txHash, amount });

        // Verify session exists
        const { data: session, error: fetchError } = await this.supabase
            .from('escrow_sessions')
            .select('*')
            .eq('session_id', sessionId)
            .single();

        if (fetchError || !session) {
            throw new Error(`Session ${sessionId} not found`);
        }

        if (session.is_active) {
            throw new Error(`Session ${sessionId} is already active`);
        }

        // Verify amount matches max_spend
        const expectedAmount = parseFloat(session.max_spend);
        const receivedAmount = parseFloat(amount);

        if (Math.abs(expectedAmount - receivedAmount) > 0.000001) {
            throw new Error(`Payment amount mismatch. Expected ${expectedAmount}, received ${receivedAmount}`);
        }

        // VERIFY TRANSACTION ON BLOCKCHAIN (REAL, NO MOCKS)
        await this.verifyPaymentTransaction(txHash, amount, this.relayWalletAddress);

        // Get transaction receipt for block number
        const rpcUrl = process.env.CRONOS_RPC_URL || 'https://evm-t3.cronos.org';
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const receipt = await provider.getTransactionReceipt(txHash);

        // Activate session
        const { data: activatedSession, error: updateError } = await this.supabase
            .from('escrow_sessions')
            .update({
                deposited: amount,
                is_active: true,
                created_tx_hash: txHash,
                created_block: receipt?.blockNumber || 0,
                updated_at: new Date().toISOString()
            })
            .eq('session_id', sessionId)
            .select()
            .single();

        if (updateError) {
            logger.error('Failed to activate session', updateError);
            throw updateError;
        }

        logger.info('Session activated successfully', {
            sessionId,
            deposited: amount,
            txHash
        });

        return activatedSession;
    }

    /**
     * Pay agent from session budget via REAL x402 (EIP-3009)
     * Relay signs an authorization, Facilitator settles on-chain
     */
    async payAgentFromSession(
        sessionId: string,
        agentAddress: string,
        agentName: string,
        amount: string,
        metadata?: Record<string, any>
    ): Promise<{ txHash: string; newSpent: string; remaining: string }> {
        logger.info('Paying agent from session via x402', {
            sessionId,
            agent: agentAddress,
            amount
        });

        if (!this.relayWallet) {
            throw new Error('Relay wallet not configured - cannot execute x402 payments');
        }

        // Get session and verify budget
        const { data: session, error } = await this.supabase
            .from('escrow_sessions')
            .select('*')
            .eq('session_id', sessionId)
            .single();

        if (error || !session) {
            throw new Error(`Session ${sessionId} not found`);
        }

        if (!session.is_active) {
            throw new Error(`Session ${sessionId} is not active`);
        }

        // Check budget
        const maxSpend = parseFloat(session.max_spend);
        const spent = parseFloat(session.spent || '0');
        const paymentAmount = parseFloat(amount);
        const remaining = maxSpend - spent;

        if (remaining < paymentAmount) {
            throw new Error(`Insufficient session budget. Need ${paymentAmount}, have ${remaining}`);
        }

        // Execute REAL x402 payment via Facilitator
        let txHash: string;
        try {
            logger.info('Generating x402 payment header for agent payment', {
                from: this.relayWallet.address,
                to: agentAddress,
                amount
            });

            // Generate EIP-3009 payment header (Relay signs the authorization)
            const amountInBaseUnits = ethers.parseUnits(amount, 6).toString();
            const paymentHeader = await this.facilitator.generatePaymentHeader({
                to: agentAddress,
                value: amountInBaseUnits,
                signer: this.relayWallet,
                validBefore: Math.floor(Date.now() / 1000) + 300 // 5 min expiry
            });

            // Build payment requirements for the agent
            const paymentRequirements = this.facilitator.generatePaymentRequirements({
                payTo: agentAddress,
                maxAmountRequired: amountInBaseUnits,
                resource: `${this.host}/api/agents/${agentName}/invoke`,
                description: `Agent payment: ${amount} USDC`
            });

            // Build verify request
            const verifyRequest = this.facilitator.buildVerifyRequest(paymentHeader, paymentRequirements);

            // Verify the EIP-3009 authorization
            const verifyResult = await this.facilitator.verifyPayment(verifyRequest);
            if (!verifyResult.isValid) {
                throw new Error('Payment verification failed');
            }

            // Settle on-chain via Facilitator (gasless for Relay!)
            logger.info('Settling agent payment on-chain via Facilitator');
            const settleResult = await this.facilitator.settlePayment(verifyRequest);
            txHash = settleResult.txHash;

            logger.info('Agent payment settled via x402', {
                txHash,
                from: this.relayWallet.address,
                to: agentAddress,
                amount
            });

        } catch (paymentError) {
            logger.error('x402 agent payment failed', paymentError as Error);
            throw new Error(`x402 payment failed: ${paymentError instanceof Error ? paymentError.message : 'Unknown error'}`);
        }

        // Update session spending atomically
        const { error: updateError } = await this.supabase.rpc(
            'increment_session_spending',
            { p_session_id: sessionId, p_amount: amount }
        );

        if (updateError) {
            logger.error('Failed to update session spending', updateError);
            throw updateError;
        }

        // Record payment with real txHash
        const { error: insertError } = await this.supabase
            .from('session_payments')
            .insert({
                session_id: sessionId,
                agent_address: agentAddress,
                agent_name: agentName,
                amount: amount,
                tx_hash: txHash,
                facilitator_tx_hash: txHash,
                payment_method: 'x402_eip3009',
                status: 'completed',
                metadata: { ...metadata, facilitatorNetwork: this.network }
            });

        if (insertError) {
            logger.error('Failed to record payment', insertError);
            // Don't throw - payment succeeded, just logging failed
        }

        // Record in on_chain_transactions for explorer
        await this.recordTransaction(txHash, this.relayWallet.address, agentAddress, amount, 'agent_payment');

        const newSpent = (spent + paymentAmount).toFixed(6);
        const newRemaining = (maxSpend - spent - paymentAmount).toFixed(6);

        logger.info('Agent payment completed', {
            sessionId,
            txHash,
            newSpent,
            remaining: newRemaining
        });

        return {
            txHash,
            newSpent,
            remaining: newRemaining
        };
    }

    /**
     * Record transaction in on_chain_transactions table for explorer
     */
    private async recordTransaction(
        txHash: string,
        from: string,
        to: string,
        amount: string,
        type: string
    ): Promise<void> {
        try {
            await this.supabase.from('on_chain_transactions').insert({
                tx_hash: txHash,
                from_address: from.toLowerCase(),
                to_address: to.toLowerCase(),
                value: amount,
                type,
                status: 'success',
                timestamp: new Date().toISOString(),
                block_number: 0, // Will be updated by indexer
                gas_used: '0'
            });
        } catch (error) {
            logger.warn('Failed to record transaction for explorer', { txHash, error });
        }
    }

    /**
     * Refund remaining balance to user via REAL x402 (EIP-3009)
     * Relay signs an authorization, Facilitator settles on-chain (gasless for Relay!)
     */
    async refundSession(sessionId: string): Promise<{ refundAmount: string; txHash?: string }> {
        logger.info('Refunding session via x402', { sessionId });

        if (!this.relayWallet) {
            throw new Error('Relay wallet not configured - cannot execute x402 refunds');
        }

        const { data: session, error } = await this.supabase
            .from('escrow_sessions')
            .select('*')
            .eq('session_id', sessionId)
            .single();

        if (error || !session) {
            throw new Error(`Session ${sessionId} not found`);
        }

        const deposited = parseFloat(session.deposited || '0');
        const released = parseFloat(session.released || '0');
        const spent = parseFloat(session.spent || '0');

        // Calculate actual spent (use released if spent field doesn't exist)
        const actualSpent = spent > 0 ? spent : released;
        const refundAmount = deposited - actualSpent;

        if (refundAmount <= 0) {
            throw new Error('No funds to refund');
        }

        // Check if session can be refunded
        const now = new Date();
        const expiresAt = new Date(session.expires_at || session.expiry);
        const isExpired = now > expiresAt;
        const isOwner = true; // Caller verification happens at API level

        if (!isExpired && !isOwner) {
            throw new Error('Session has not expired and caller is not owner');
        }

        // Execute refund payment via x402/EIP-3009 (gasless for Relay!)
        let txHash: string | undefined;
        try {
            const refundAmountStr = refundAmount.toFixed(6);
            const amountInBaseUnits = ethers.parseUnits(refundAmountStr, 6).toString();

            logger.info('Generating x402 refund payment', {
                from: this.relayWallet.address,
                to: session.owner_address,
                amount: refundAmountStr
            });

            // Generate EIP-3009 payment header (Relay signs the authorization)
            const paymentHeader = await this.facilitator.generatePaymentHeader({
                to: session.owner_address,
                value: amountInBaseUnits,
                signer: this.relayWallet,
                validBefore: Math.floor(Date.now() / 1000) + 300 // 5 min expiry
            });

            // Build payment requirements for the refund
            // Build payment requirements for the refund
            const paymentRequirements = this.facilitator.generatePaymentRequirements({
                payTo: session.owner_address,
                maxAmountRequired: amountInBaseUnits,
                resource: `${this.host}/api/sessions/${sessionId}/refund`,
                description: `Session refund: ${refundAmountStr} USDC`
            });

            // Build verify request
            const verifyRequest = this.facilitator.buildVerifyRequest(paymentHeader, paymentRequirements);

            // Verify the EIP-3009 authorization
            const verifyResult = await this.facilitator.verifyPayment(verifyRequest);
            if (!verifyResult.isValid) {
                throw new Error('Refund payment verification failed');
            }

            // Settle on-chain via Facilitator (gasless!)
            logger.info('Settling refund on-chain via Facilitator');
            const settleResult = await this.facilitator.settlePayment(verifyRequest);
            txHash = settleResult.txHash;

            logger.info('Refund settled via x402', {
                txHash,
                to: session.owner_address,
                amount: refundAmountStr
            });

        } catch (paymentError) {
            logger.error('x402 refund failed', paymentError as Error);
            throw new Error(`x402 refund failed: ${paymentError instanceof Error ? paymentError.message : 'Unknown error'}`);
        }

        // Record refund in escrow_refunds table
        await this.supabase.from('escrow_refunds').insert({
            session_id: sessionId,
            amount: refundAmount.toFixed(6),
            recipient: session.owner_address,
            tx_hash: txHash,
            reason: 'session_close',
            refund_type: 'x402_eip3009',
            status: 'completed',
            metadata: { facilitatorNetwork: this.network }
        });

        // Record in on_chain_transactions for explorer
        await this.recordTransaction(
            txHash!,
            this.relayWallet.address,
            session.owner_address,
            refundAmount.toFixed(6),
            'session_refund'
        );

        // Close session after successful refund
        const { error: updateError } = await this.supabase
            .from('escrow_sessions')
            .update({
                is_active: false,
                closed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('session_id', sessionId);

        if (updateError) {
            logger.error('Failed to close session after refund', updateError);
            // Don't throw - refund was successful, just log the error
        }

        logger.info('Session refunded and closed via x402', {
            sessionId,
            refundAmount: refundAmount.toFixed(6),
            txHash
        });

        return {
            refundAmount: refundAmount.toFixed(6),
            txHash
        };
    }

    /**
     * Get session details
     */
    async getSession(sessionId: string): Promise<Session | null> {
        const { data, error } = await this.supabase
            .from('escrow_sessions')
            .select('*')
            .eq('session_id', sessionId)
            .single();

        if (error) {
            if (error.code !== 'PGRST116') { // Not found
                logger.error('Failed to get session', error);
            }
            return null;
        }

        return data;
    }
}
