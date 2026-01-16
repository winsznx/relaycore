/**
 * Escrow Agent Service
 * 
 * Orchestrates ACPS (Agent-Controlled Payment Sessions).
 * Handles session lifecycle, payment authorization, and refunds.
 * 
 * Security Features:
 * - Nonce tracking to prevent replay attacks
 * - Rate limiting per session
 * - Emergency pause capability
 * - Per-call maximum limits
 * - Agent blacklisting
 * - Comprehensive audit logging
 */

import { ethers } from 'ethers';
import { supabase } from '../../lib/supabase';
import logger from '../../lib/logger';
import { notifyPaymentReceived, notifyPaymentSent } from '../bot-linking/notification-service';

const ESCROW_CONTRACT_ABI = [
    'function createSession(address escrowAgent, uint256 maxSpend, uint256 duration, address[] calldata agents) external returns (uint256)',
    'function deposit(uint256 sessionId, uint256 amount) external',
    'function release(uint256 sessionId, address agent, uint256 amount, bytes32 executionId) external',
    'function refund(uint256 sessionId) external',
    'function closeSession(uint256 sessionId) external',
    'function authorizeAgent(uint256 sessionId, address agent) external',
    'function revokeAgent(uint256 sessionId, address agent) external',
    'function remainingBalance(uint256 sessionId) view returns (uint256)',
    'function getSession(uint256 sessionId) view returns (address, address, uint256, uint256, uint256, uint256, uint256, bool)',
    'function isAgentAuthorized(uint256 sessionId, address agent) view returns (bool)',
    'function getAgentSpend(uint256 sessionId, address agent) view returns (uint256)',
    'event SessionCreated(uint256 indexed sessionId, address indexed owner, address escrowAgent, uint256 maxSpend, uint256 expiry)',
    'event PaymentReleased(uint256 indexed sessionId, address indexed agent, uint256 amount, bytes32 executionId)',
    'event SessionRefunded(uint256 indexed sessionId, address indexed owner, uint256 amount)',
];

const ERC20_ABI = [
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function balanceOf(address account) view returns (uint256)',
];

// Security Constants
const MAX_CALL_AMOUNT = '1000'; // Maximum USDC per single release
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_CALLS_PER_WINDOW = 100; // Max releases per minute per session
const NONCE_EXPIRY_MS = 300000; // 5 minute nonce expiry

export interface SessionConfig {
    maxSpend: string;
    durationSeconds: number;
    authorizedAgents: string[];
    maxPerCall?: string;
    rateLimit?: number;
}

export interface SessionState {
    sessionId: number;
    owner: string;
    escrowAgent: string;
    deposited: string;
    released: string;
    remaining: string;
    maxSpend: string;
    expiry: number;
    active: boolean;
    paused: boolean;
}

export interface ReleaseResult {
    success: boolean;
    txHash?: string;
    executionId: string;
    amount: string;
    error?: string;
    nonce?: string;
}

export interface SecurityConfig {
    maxPerCall: string;
    rateLimitPerMinute: number;
    blacklistedAgents: Set<string>;
    paused: boolean;
}

export class EscrowAgentService {
    private provider: ethers.JsonRpcProvider;
    private escrowContract: ethers.Contract;
    private usdcContract: ethers.Contract;
    private agentWallet: ethers.Wallet;

    // Security state
    private securityConfig: SecurityConfig = {
        maxPerCall: MAX_CALL_AMOUNT,
        rateLimitPerMinute: MAX_CALLS_PER_WINDOW,
        blacklistedAgents: new Set(),
        paused: false
    };

    // Rate limiting: sessionId -> {timestamps: number[], count: number}
    private rateLimitState: Map<number, { timestamps: number[]; count: number }> = new Map();

    // Nonce tracking: executionId -> timestamp (to prevent replay)
    private usedNonces: Map<string, number> = new Map();

    // Session-specific configs
    private sessionConfigs: Map<number, { maxPerCall: string; rateLimit: number }> = new Map();

    constructor(
        rpcUrl: string,
        escrowContractAddress: string,
        usdcAddress: string,
        agentPrivateKey: string
    ) {
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.agentWallet = new ethers.Wallet(agentPrivateKey, this.provider);
        this.escrowContract = new ethers.Contract(
            escrowContractAddress,
            ESCROW_CONTRACT_ABI,
            this.agentWallet
        );
        this.usdcContract = new ethers.Contract(
            usdcAddress,
            ERC20_ABI,
            this.agentWallet
        );

        // Clean up expired nonces periodically
        setInterval(() => this.cleanupExpiredNonces(), NONCE_EXPIRY_MS);
    }

    // ============================================
    // SECURITY CONTROLS
    // ============================================

    /**
     * Emergency pause all operations
     */
    pause(): void {
        this.securityConfig.paused = true;
        logger.warn('Escrow Agent PAUSED');
    }

    /**
     * Resume operations
     */
    unpause(): void {
        this.securityConfig.paused = false;
        logger.info('Escrow Agent RESUMED');
    }

    /**
     * Check if system is paused
     */
    isPaused(): boolean {
        return this.securityConfig.paused;
    }

    /**
     * Blacklist an agent from all sessions
     */
    blacklistAgent(address: string): void {
        this.securityConfig.blacklistedAgents.add(address.toLowerCase());
        logger.warn('Agent blacklisted', { address });
    }

    /**
     * Remove agent from blacklist
     */
    unblacklistAgent(address: string): void {
        this.securityConfig.blacklistedAgents.delete(address.toLowerCase());
        logger.info('Agent removed from blacklist', { address });
    }

    /**
     * Check if agent is blacklisted
     */
    isBlacklisted(address: string): boolean {
        return this.securityConfig.blacklistedAgents.has(address.toLowerCase());
    }

    /**
     * Set global max per call limit
     */
    setMaxPerCall(amount: string): void {
        this.securityConfig.maxPerCall = amount;
        logger.info('Max per call updated', { maxPerCall: amount });
    }

    /**
     * Set session-specific limits
     */
    setSessionLimits(sessionId: number, maxPerCall: string, rateLimit: number): void {
        this.sessionConfigs.set(sessionId, { maxPerCall, rateLimit });
        logger.info('Session limits updated', { sessionId, maxPerCall, rateLimit });
    }

    // ============================================
    // RATE LIMITING
    // ============================================

    private checkRateLimit(sessionId: number): { allowed: boolean; reason?: string } {
        const now = Date.now();
        const config = this.sessionConfigs.get(sessionId);
        const maxCalls = config?.rateLimit || this.securityConfig.rateLimitPerMinute;

        let state = this.rateLimitState.get(sessionId);
        if (!state) {
            state = { timestamps: [], count: 0 };
            this.rateLimitState.set(sessionId, state);
        }

        // Remove timestamps outside window
        state.timestamps = state.timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
        state.count = state.timestamps.length;

        if (state.count >= maxCalls) {
            return { allowed: false, reason: `Rate limit exceeded: ${maxCalls} calls per minute` };
        }

        state.timestamps.push(now);
        state.count++;
        return { allowed: true };
    }

    // ============================================
    // NONCE MANAGEMENT
    // ============================================

    private validateNonce(executionId: string): { valid: boolean; reason?: string } {
        if (this.usedNonces.has(executionId)) {
            return { valid: false, reason: 'Execution ID already used (replay attack prevented)' };
        }
        return { valid: true };
    }

    private recordNonce(executionId: string): void {
        this.usedNonces.set(executionId, Date.now());
    }

    private cleanupExpiredNonces(): void {
        const now = Date.now();
        let cleaned = 0;
        for (const [nonce, timestamp] of this.usedNonces.entries()) {
            if (now - timestamp > NONCE_EXPIRY_MS) {
                this.usedNonces.delete(nonce);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            logger.debug('Cleaned expired nonces', { count: cleaned });
        }
    }

    // ============================================
    // SESSION MANAGEMENT
    // ============================================

    /**
     * Create a new payment session
     */
    async createSession(config: SessionConfig): Promise<{
        sessionId: number;
        txHash: string;
        paymentRequired: { amount: string; escrowContract: string };
    }> {
        if (this.securityConfig.paused) {
            throw new Error('Escrow Agent is paused');
        }

        const maxSpendWei = ethers.parseUnits(config.maxSpend, 6);

        const tx = await this.escrowContract.createSession(
            this.agentWallet.address,
            maxSpendWei,
            config.durationSeconds,
            config.authorizedAgents
        );

        const receipt = await tx.wait();

        const event = receipt.logs.find((log: any) => {
            try {
                const parsed = this.escrowContract.interface.parseLog(log);
                return parsed?.name === 'SessionCreated';
            } catch {
                return false;
            }
        });

        const parsed = this.escrowContract.interface.parseLog(event);
        const sessionId = Number(parsed?.args[0]);

        // Store session-specific config
        if (config.maxPerCall || config.rateLimit) {
            this.sessionConfigs.set(sessionId, {
                maxPerCall: config.maxPerCall || this.securityConfig.maxPerCall,
                rateLimit: config.rateLimit || this.securityConfig.rateLimitPerMinute
            });
        }

        await this.recordSession(sessionId, config);
        await this.auditLog('SESSION_CREATED', sessionId, null, config.maxSpend);

        logger.info('Session created', { sessionId, maxSpend: config.maxSpend });

        return {
            sessionId,
            txHash: receipt.hash,
            paymentRequired: {
                amount: config.maxSpend,
                escrowContract: await this.escrowContract.getAddress()
            }
        };
    }

    /**
     * Get session state from contract
     */
    async getSessionState(sessionId: number): Promise<SessionState> {
        const result = await this.escrowContract.getSession(sessionId);

        return {
            sessionId,
            owner: result[0],
            escrowAgent: result[1],
            deposited: ethers.formatUnits(result[2], 6),
            released: ethers.formatUnits(result[3], 6),
            remaining: ethers.formatUnits(result[4], 6),
            maxSpend: ethers.formatUnits(result[5], 6),
            expiry: Number(result[6]),
            active: result[7],
            paused: this.securityConfig.paused
        };
    }

    /**
     * Comprehensive check if agent can execute with payment
     */
    async canExecute(sessionId: number, agent: string, amount: string): Promise<{
        allowed: boolean;
        reason?: string;
        checks: Record<string, boolean>;
    }> {
        const checks: Record<string, boolean> = {};

        // Check 1: System not paused
        checks.systemNotPaused = !this.securityConfig.paused;
        if (!checks.systemNotPaused) {
            return { allowed: false, reason: 'Escrow Agent is paused', checks };
        }

        // Check 2: Agent not blacklisted
        checks.notBlacklisted = !this.isBlacklisted(agent);
        if (!checks.notBlacklisted) {
            return { allowed: false, reason: 'Agent is blacklisted', checks };
        }

        // Check 3: Amount within per-call limit
        const sessionConfig = this.sessionConfigs.get(sessionId);
        const maxPerCall = parseFloat(sessionConfig?.maxPerCall || this.securityConfig.maxPerCall);
        checks.withinCallLimit = parseFloat(amount) <= maxPerCall;
        if (!checks.withinCallLimit) {
            return { allowed: false, reason: `Amount ${amount} exceeds max per call ${maxPerCall}`, checks };
        }

        // Check 4: Rate limit not exceeded
        const rateCheck = this.checkRateLimit(sessionId);
        checks.withinRateLimit = rateCheck.allowed;
        if (!checks.withinRateLimit) {
            return { allowed: false, reason: rateCheck.reason, checks };
        }

        // Check 5: Session active on-chain
        const state = await this.getSessionState(sessionId);
        checks.sessionActive = state.active;
        if (!checks.sessionActive) {
            return { allowed: false, reason: 'Session not active', checks };
        }

        // Check 6: Session not expired
        checks.notExpired = Date.now() / 1000 < state.expiry;
        if (!checks.notExpired) {
            return { allowed: false, reason: 'Session expired', checks };
        }

        // Check 7: Agent authorized on-chain
        const isAuthorized = await this.escrowContract.isAgentAuthorized(sessionId, agent);
        checks.agentAuthorized = isAuthorized;
        if (!checks.agentAuthorized) {
            return { allowed: false, reason: 'Agent not authorized for this session', checks };
        }

        // Check 8: Sufficient balance
        const amountNum = parseFloat(amount);
        const remainingNum = parseFloat(state.remaining);
        checks.sufficientBalance = amountNum <= remainingNum;
        if (!checks.sufficientBalance) {
            return { allowed: false, reason: `Insufficient balance: ${state.remaining} remaining`, checks };
        }

        return { allowed: true, checks };
    }

    /**
     * Release payment to agent after successful execution
     */
    async releasePayment(
        sessionId: number,
        agent: string,
        amount: string,
        executionId: string
    ): Promise<ReleaseResult> {
        // Validate nonce to prevent replay
        const nonceCheck = this.validateNonce(executionId);
        if (!nonceCheck.valid) {
            await this.auditLog('RELEASE_REJECTED', sessionId, agent, amount, executionId, 'REPLAY_ATTACK');
            return {
                success: false,
                executionId,
                amount,
                error: nonceCheck.reason
            };
        }

        // Full security checks
        const check = await this.canExecute(sessionId, agent, amount);
        if (!check.allowed) {
            await this.auditLog('RELEASE_REJECTED', sessionId, agent, amount, executionId, check.reason);
            return {
                success: false,
                executionId,
                amount,
                error: check.reason
            };
        }

        try {
            const amountWei = ethers.parseUnits(amount, 6);
            const execIdBytes = ethers.encodeBytes32String(executionId.slice(0, 31));

            const tx = await this.escrowContract.release(
                sessionId,
                agent,
                amountWei,
                execIdBytes
            );

            const receipt = await tx.wait();

            // Record nonce to prevent replay
            this.recordNonce(executionId);

            await this.recordPayment(sessionId, agent, amount, executionId, receipt.hash);
            await this.auditLog('PAYMENT_RELEASED', sessionId, agent, amount, executionId, 'SUCCESS', receipt.hash);

            // Send Telegram notifications
            const state = await this.getSessionState(sessionId);
            notifyPaymentReceived(agent, state.owner, amount, `Session ${sessionId}`).catch(() => { });
            notifyPaymentSent(state.owner, agent, amount, `Session ${sessionId}`).catch(() => { });

            logger.info('Payment released', { sessionId, agent, amount, executionId });

            return {
                success: true,
                txHash: receipt.hash,
                executionId,
                amount,
                nonce: executionId
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            await this.auditLog('RELEASE_FAILED', sessionId, agent, amount, executionId, message);
            logger.error('Payment release failed', error as Error, { sessionId, agent, amount });

            return {
                success: false,
                executionId,
                amount,
                error: message
            };
        }
    }

    /**
     * Authorize additional agent for a session
     */
    async authorizeAgent(sessionId: number, agentAddress: string): Promise<{ txHash: string }> {
        if (this.isBlacklisted(agentAddress)) {
            throw new Error('Cannot authorize blacklisted agent');
        }

        const tx = await this.escrowContract.authorizeAgent(sessionId, agentAddress);
        const receipt = await tx.wait();

        await this.auditLog('AGENT_AUTHORIZED', sessionId, agentAddress, '0');
        logger.info('Agent authorized', { sessionId, agent: agentAddress });

        return { txHash: receipt.hash };
    }

    /**
     * Revoke agent authorization
     */
    async revokeAgent(sessionId: number, agentAddress: string): Promise<{ txHash: string }> {
        const tx = await this.escrowContract.revokeAgent(sessionId, agentAddress);
        const receipt = await tx.wait();

        await this.auditLog('AGENT_REVOKED', sessionId, agentAddress, '0');
        logger.info('Agent revoked', { sessionId, agent: agentAddress });

        return { txHash: receipt.hash };
    }

    /**
     * Get agent spend for a session
     */
    async getAgentSpend(sessionId: number, agentAddress: string): Promise<string> {
        const spend = await this.escrowContract.getAgentSpend(sessionId, agentAddress);
        return ethers.formatUnits(spend, 6);
    }

    /**
     * Refund remaining balance to owner
     */
    async refund(sessionId: number): Promise<{ txHash: string; amount: string }> {
        const state = await this.getSessionState(sessionId);

        const tx = await this.escrowContract.refund(sessionId);
        const receipt = await tx.wait();

        await this.auditLog('SESSION_REFUNDED', sessionId, null, state.remaining);
        logger.info('Session refunded', { sessionId, amount: state.remaining });

        return {
            txHash: receipt.hash,
            amount: state.remaining
        };
    }

    /**
     * Close session and refund remaining
     */
    async closeSession(sessionId: number): Promise<{ txHash: string; refunded: string }> {
        const state = await this.getSessionState(sessionId);

        const tx = await this.escrowContract.closeSession(sessionId);
        const receipt = await tx.wait();

        // Cleanup session-specific state
        this.sessionConfigs.delete(sessionId);
        this.rateLimitState.delete(sessionId);

        await this.updateSessionStatus(sessionId, 'closed');
        await this.auditLog('SESSION_CLOSED', sessionId, null, state.remaining);

        logger.info('Session closed', { sessionId, refunded: state.remaining });

        return {
            txHash: receipt.hash,
            refunded: state.remaining
        };
    }

    /**
     * Execute agent action with automatic payment handling
     */
    async executeWithPayment<T>(
        sessionId: number,
        agent: string,
        amount: string,
        action: () => Promise<T>
    ): Promise<{ result?: T; payment: ReleaseResult }> {
        const executionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        const check = await this.canExecute(sessionId, agent, amount);
        if (!check.allowed) {
            return {
                payment: {
                    success: false,
                    executionId,
                    amount,
                    error: check.reason
                }
            };
        }

        try {
            const result = await action();

            // Only release payment on successful execution
            const payment = await this.releasePayment(sessionId, agent, amount, executionId);

            return { result, payment };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Execution failed';
            logger.error('Execution failed, payment NOT released', error as Error);
            await this.auditLog('EXECUTION_FAILED', sessionId, agent, amount, executionId, message);

            return {
                payment: {
                    success: false,
                    executionId,
                    amount,
                    error: `Execution failed: ${message}`
                }
            };
        }
    }

    // ============================================
    // AUDIT LOGGING
    // ============================================

    private async auditLog(
        action: string,
        sessionId: number,
        agent: string | null,
        amount: string,
        executionId?: string,
        status?: string,
        txHash?: string
    ): Promise<void> {
        try {
            await supabase.from('escrow_audit_log').insert({
                action,
                session_id: sessionId,
                agent_address: agent,
                amount,
                execution_id: executionId || null,
                status: status || 'SUCCESS',
                tx_hash: txHash || null,
                created_at: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Failed to write audit log', error as Error);
        }
    }

    // ============================================
    // DATABASE HELPERS
    // ============================================

    private async recordSession(sessionId: number, config: SessionConfig): Promise<void> {
        try {
            await supabase.from('escrow_sessions').insert({
                session_id: sessionId,
                max_spend: config.maxSpend,
                duration_seconds: config.durationSeconds,
                authorized_agents: config.authorizedAgents,
                status: 'active',
                created_at: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Failed to record session', error as Error);
        }
    }

    private async recordPayment(
        sessionId: number,
        agent: string,
        amount: string,
        executionId: string,
        txHash: string
    ): Promise<void> {
        try {
            await supabase.from('escrow_payments').insert({
                session_id: sessionId,
                agent_address: agent,
                amount,
                execution_id: executionId,
                tx_hash: txHash,
                created_at: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Failed to record payment', error as Error);
        }
    }

    private async updateSessionStatus(sessionId: number, status: string): Promise<void> {
        try {
            await supabase.from('escrow_sessions')
                .update({ status, closed_at: new Date().toISOString() })
                .eq('session_id', sessionId);
        } catch (error) {
            logger.error('Failed to update session status', error as Error);
        }
    }

    // ============================================
    // STATISTICS
    // ============================================

    getStats(): {
        paused: boolean;
        blacklistedAgents: number;
        activeSessions: number;
        usedNonces: number;
    } {
        return {
            paused: this.securityConfig.paused,
            blacklistedAgents: this.securityConfig.blacklistedAgents.size,
            activeSessions: this.sessionConfigs.size,
            usedNonces: this.usedNonces.size
        };
    }

    /**
     * Get USDC balance for an address
     */
    async getUsdcBalance(address: string): Promise<string> {
        const balance = await this.usdcContract.balanceOf(address);
        return ethers.formatUnits(balance, 6);
    }

    /**
     * Check USDC allowance for escrow contract
     */
    async getUsdcAllowance(owner: string): Promise<string> {
        const escrowAddress = await this.escrowContract.getAddress();
        const allowance = await this.usdcContract.allowance(owner, escrowAddress);
        return ethers.formatUnits(allowance, 6);
    }
}

// Singleton instance
let escrowAgent: EscrowAgentService | null = null;

export function getEscrowAgent(): EscrowAgentService {
    if (!escrowAgent) {
        const rpcUrl = process.env.CRONOS_RPC_URL || 'https://evm-t3.cronos.org';
        const escrowAddress = process.env.ESCROW_CONTRACT_ADDRESS || '';
        const usdcAddress = process.env.USDC_TOKEN_ADDRESS || '0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0';
        const privateKey = process.env.ESCROW_AGENT_PRIVATE_KEY || process.env.WALLET_PRIVATE_KEY || '';

        if (!escrowAddress || !privateKey) {
            throw new Error('ESCROW_CONTRACT_ADDRESS and ESCROW_AGENT_PRIVATE_KEY required');
        }

        escrowAgent = new EscrowAgentService(rpcUrl, escrowAddress, usdcAddress, privateKey);
    }
    return escrowAgent;
}

export function resetEscrowAgent(): void {
    escrowAgent = null;
}
