export {
    requireX402,
    handleX402Settlement,
    generatePaymentId,
    isEntitled,
    getEntitlement,
    recordEntitlement,
    createPaymentRequirements,
} from './x402-middleware';

export type {
    X402Accepts,
    X402Response,
    X402PaidRecord,
    X402PayResult,
    X402ProtectionOptions,
    X402PayParams,
} from '../../types/x402.types';
