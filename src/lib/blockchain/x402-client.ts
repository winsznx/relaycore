import { Facilitator, type PaymentRequirements, Contract, CronosNetwork } from '@crypto.com/facilitator-client';
import { ethers } from 'ethers';

export const X402_NETWORKS = {
    testnet: {
        network: CronosNetwork.CronosTestnet,
        chainId: 338,
        rpcUrl: 'https://evm-t3.cronos.org',
        usdce: {
            address: '0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0' as Contract,
            symbol: 'devUSDC.e',
            decimals: 6
        }
    },
    mainnet: {
        network: CronosNetwork.CronosMainnet,
        chainId: 25,
        rpcUrl: 'https://evm.cronos.org',
        usdce: {
            address: Contract.USDCe,
            symbol: 'USDC.e',
            decimals: 6
        }
    }
} as const;

export interface X402PaymentResult {
    success: boolean;
    txHash?: string;
    blockNumber?: number;
    timestamp?: number;
    error?: string;
}

export interface X402VerifyResult {
    isValid: boolean;
    invalidReason?: string;
}

export class X402FacilitatorClient {
    private client: Facilitator;
    private networkConfig: typeof X402_NETWORKS.testnet | typeof X402_NETWORKS.mainnet;

    constructor(network: 'testnet' | 'mainnet' = 'testnet') {
        this.networkConfig = X402_NETWORKS[network];
        this.client = new Facilitator({ network: this.networkConfig.network });
    }

    createPaymentRequirements(params: {
        payTo: string;
        amount: string;
        description?: string;
        mimeType?: string;
        maxTimeoutSeconds?: number;
    }): PaymentRequirements {
        const amountInSmallestUnit = ethers.parseUnits(params.amount, this.networkConfig.usdce.decimals).toString();

        return this.client.generatePaymentRequirements({
            payTo: params.payTo,
            asset: this.networkConfig.usdce.address,
            description: params.description || 'Service payment',
            mimeType: params.mimeType || 'application/json',
            maxAmountRequired: amountInSmallestUnit,
            maxTimeoutSeconds: params.maxTimeoutSeconds || 300
        });
    }

    async createPaymentHeader(signer: ethers.Signer, paymentRequirements: PaymentRequirements): Promise<string> {
        const paymentHeader = await this.client.generatePaymentHeader({
            to: paymentRequirements.payTo,
            value: paymentRequirements.maxAmountRequired,
            asset: paymentRequirements.asset,
            signer,
            validAfter: Math.floor(Date.now() / 1000) - 60,
            validBefore: Math.floor(Date.now() / 1000) + paymentRequirements.maxTimeoutSeconds
        });

        return paymentHeader;
    }

    async verifyPayment(paymentHeader: string, paymentRequirements: PaymentRequirements): Promise<X402VerifyResult> {
        try {
            const request = this.client.buildVerifyRequest(paymentHeader, paymentRequirements);
            const result = await this.client.verifyPayment(request);
            return { isValid: result.isValid, invalidReason: result.invalidReason || undefined };
        } catch (error: any) {
            return { isValid: false, invalidReason: error.message || 'Verification failed' };
        }
    }

    async settlePayment(paymentHeader: string, paymentRequirements: PaymentRequirements): Promise<X402PaymentResult> {
        try {
            const request = this.client.buildVerifyRequest(paymentHeader, paymentRequirements);
            const result = await this.client.settlePayment(request);

            if (result.event === 'payment.settled') {
                return {
                    success: true,
                    txHash: result.txHash,
                    blockNumber: result.blockNumber,
                    timestamp: result.timestamp ? Number(result.timestamp) : undefined
                };
            } else {
                return { success: false, error: result.error || 'Settlement failed' };
            }
        } catch (error: any) {
            return { success: false, error: error.message || 'Settlement failed' };
        }
    }

    async payForResource(params: { resourceUrl: string; signer: ethers.Signer; }): Promise<{
        success: boolean;
        data?: any;
        payment?: X402PaymentResult;
        error?: string;
    }> {
        try {
            const initialResponse = await fetch(params.resourceUrl);

            if (initialResponse.status !== 402) {
                return { success: true, data: await initialResponse.json() };
            }

            const responseBody = await initialResponse.json();
            const paymentRequirements = responseBody.paymentRequirements as PaymentRequirements;

            const paymentHeader = await this.createPaymentHeader(params.signer, paymentRequirements);

            const paidResponse = await fetch(params.resourceUrl, {
                headers: { 'X-PAYMENT': paymentHeader }
            });

            if (!paidResponse.ok) {
                return { success: false, error: `Payment failed: ${paidResponse.status}` };
            }

            const data = await paidResponse.json();
            return { success: true, data: data.data || data, payment: data.payment };
        } catch (error: any) {
            return { success: false, error: error.message || 'Payment flow failed' };
        }
    }

    async getSupportedKinds() {
        return await this.client.getSupported();
    }

    getNetworkConfig() {
        return this.networkConfig;
    }
}

export const x402ClientTestnet = new X402FacilitatorClient('testnet');
export const x402ClientMainnet = new X402FacilitatorClient('mainnet');
export const x402Client = new X402FacilitatorClient(
    (import.meta.env.VITE_CRONOS_NETWORK || 'testnet') as 'testnet' | 'mainnet'
);

export type { PaymentRequirements };
