/**
 * Handoff Signing Service
 * 
 * Production-grade transaction signing without storing private keys.
 * 
 * Flow:
 * 1. Agent calls MCP tool
 * 2. Tool calls signing service to prepare transaction
 * 3. Service returns signing URL
 * 4. User opens URL, connects wallet, signs
 * 5. Backend broadcasts, indexer records
 * 6. Agent polls for completion
 * 
 * SECURITY GUARANTEE:
 * - No private keys stored or transmitted at any layer
 * - All signing happens in user's browser wallet
 * - All transactions are auditable via indexer
 */

export {
    // Pending transaction store
    pendingTransactionStore,
    getSigningUrl,
    prepareTransactionForHandoff,
    type PendingTransaction,
    type TransactionStatus,
    type TransactionContext,
    type CreatePendingTransactionParams
} from './pending-transactions';

export {
    // Signing service
    signingService,
    SigningService,
    type SigningRequest,
    type SigningResult,
    type PrepareTransactionResult,

    // Contract helpers
    prepareERC20Approve,
    prepareERC20Transfer,
    prepareNativeTransfer,
    prepareEscrowSessionCreate,
    prepareEscrowDeposit,
    prepareEscrowRefund,
    prepareEscrowClose
} from './signing-service';
