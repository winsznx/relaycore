/**
 * Session Module - Off-Chain Session Management
 * 
 * Provides gasless session-based payments using x402,
 * replacing the need for on-chain escrow transactions.
 */

export { SessionManager } from './session-manager';
export { X402SessionService } from './x402-session-service';
export type {
    Session,
    SessionPayment,
    CreateSessionParams,
    SessionBudgetCheck,
    RecordPaymentParams,
    SessionStats,
    SessionSummary
} from './types';
export type { X402PaymentRequest, SessionCreationResult } from './x402-session-service';
