/**
 * x402 Payment Service
 * 
 * Handles x402 payments on Cronos EVM via Facilitator contract.
 */

import { ethers } from 'ethers';
import { getProvider } from './provider';

// x402 Facilitator ABI (from SDK documentation)
const X402_FACILITATOR_ABI = [
    'event PaymentExecuted(address indexed payer, address indexed receiver, uint256 amount, bytes32 indexed serviceId, uint256 timestamp)',
    'event PaymentFailed(address indexed payer, bytes32 indexed serviceId, string reason)',
    'function executePayment(bytes32 serviceId, uint256 amount, address receiver) external payable returns (bool)',
    'function getPaymentDetails(bytes32 txHash) external view returns (address payer, address receiver, uint256 amount, bytes32 serviceId, uint256 timestamp, uint8 status)',
    'function getServicePayments(bytes32 serviceId, uint256 fromBlock, uint256 toBlock) external view returns (tuple(bytes32 txHash, address payer, uint256 amount, uint256 timestamp)[])'
];

// ERC20 ABI for USDC approvals
const ERC20_ABI = [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)',
    'function balanceOf(address account) external view returns (uint256)',
    'function transfer(address to, uint256 amount) external returns (bool)',
    'function decimals() external view returns (uint8)'
];

// Contract addresses (Cronos Testnet)
const CONTRACTS = {
    testnet: {
        facilitator: import.meta.env.VITE_X402_FACILITATOR_ADDRESS || '0x7C3A2B5e8e1C4A8F9D2B3E6C8D1A0B2C3D4E5F6A',
        usdc: '0xc21223249CA28397B4B6541dfFaEcC539BfF0c59', // Cronos Testnet USDC
    },
    mainnet: {
        facilitator: '0x...', // To be set for mainnet
        usdc: '0xc21223249CA28397B4B6541dfFaEcC539BfF0c59', // Cronos Mainnet USDC
    }
};

export interface PaymentParams {
    serviceId: string;
    amount: string; // In USDC (string to avoid precision loss)
    receiverAddress: string;
    signer: ethers.Signer;
}

export interface PaymentResult {
    txHash: string;
    blockNumber: number;
    gasUsed: string;
    status: 'success' | 'failed' | 'pending';
    serviceId: string;
    amount: string;
    timestamp: number;
}

export class X402PaymentService {
    private provider: ethers.JsonRpcProvider;
    private facilitatorAddress: string;
    private usdcAddress: string;
    private network: 'testnet' | 'mainnet';

    constructor() {
        this.network = (import.meta.env.VITE_CRONOS_NETWORK || 'testnet') as 'testnet' | 'mainnet';
        this.provider = getProvider();
        this.facilitatorAddress = CONTRACTS[this.network].facilitator;
        this.usdcAddress = CONTRACTS[this.network].usdc;
    }

    /**
     * Get the Facilitator contract instance
     */
    private getFacilitatorContract(signer?: ethers.Signer): ethers.Contract {
        return new ethers.Contract(
            this.facilitatorAddress,
            X402_FACILITATOR_ABI,
            signer || this.provider
        );
    }

    /**
     * Get USDC contract instance
     */
    private getUSDCContract(signer?: ethers.Signer): ethers.Contract {
        return new ethers.Contract(
            this.usdcAddress,
            ERC20_ABI,
            signer || this.provider
        );
    }

    /**
     * Check and approve USDC spending if needed
     */
    async ensureAllowance(params: {
        amount: string;
        ownerAddress: string;
        signer: ethers.Signer;
    }): Promise<boolean> {
        const usdc = this.getUSDCContract(params.signer);
        const amountWei = ethers.parseUnits(params.amount, 6); // USDC has 6 decimals

        const currentAllowance = await usdc.allowance(params.ownerAddress, this.facilitatorAddress);

        if (currentAllowance < amountWei) {
            console.log(`Approving ${params.amount} USDC for x402 Facilitator...`);
            const approveTx = await usdc.approve(this.facilitatorAddress, amountWei);
            await approveTx.wait();
            console.log('USDC approved');
        }

        return true;
    }

    /**
     * Execute a payment to a service via x402 Facilitator
     */
    async executePayment(params: PaymentParams): Promise<PaymentResult> {

        // Convert serviceId to bytes32
        const serviceIdBytes32 = ethers.encodeBytes32String(
            params.serviceId.length > 31 ? params.serviceId.slice(0, 31) : params.serviceId
        );

        // Parse amount to USDC decimals (6)
        const amountWei = ethers.parseUnits(params.amount, 6);

        // Get signer address
        const signerAddress = await params.signer.getAddress();

        // Ensure USDC allowance
        await this.ensureAllowance({
            amount: params.amount,
            ownerAddress: signerAddress,
            signer: params.signer
        });

        // Get contract with signer
        const facilitator = this.getFacilitatorContract(params.signer);

        console.log(`Executing x402 payment: ${params.amount} USDC to ${params.receiverAddress}`);

        try {
            const tx = await facilitator.executePayment(
                serviceIdBytes32,
                amountWei,
                params.receiverAddress
            );

            const receipt = await tx.wait();

            return {
                txHash: receipt.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString(),
                status: receipt.status === 1 ? 'success' : 'failed',
                serviceId: params.serviceId,
                amount: params.amount,
                timestamp: Date.now()
            };
        } catch (error: any) {
            console.error('x402 Payment failed:', error);
            throw new Error(`Payment failed: ${error.message}`);
        }
    }

    /**
     * Get payment status by transaction hash
     */
    async getPaymentStatus(txHash: string): Promise<{
        status: 'success' | 'failed' | 'pending';
        receipt?: ethers.TransactionReceipt;
    }> {
        const receipt = await this.provider.getTransactionReceipt(txHash);

        if (!receipt) {
            return { status: 'pending' };
        }

        return {
            status: receipt.status === 1 ? 'success' : 'failed',
            receipt
        };
    }

    /**
     * Query historical payments for a service
     */
    async getServicePayments(serviceId: string, fromBlock?: number, toBlock?: number): Promise<any[]> {
        const serviceIdBytes32 = ethers.encodeBytes32String(
            serviceId.length > 31 ? serviceId.slice(0, 31) : serviceId
        );

        const facilitator = this.getFacilitatorContract();

        const from = fromBlock || 0;
        const to = toBlock || await this.provider.getBlockNumber();

        // Query PaymentExecuted events
        const filter = facilitator.filters.PaymentExecuted(null, null, null, serviceIdBytes32);
        const events = await facilitator.queryFilter(filter, from, to);

        return events.map(event => {
            const e = event as any;
            return {
                txHash: event.transactionHash,
                blockNumber: event.blockNumber,
                payer: e.args?.payer,
                receiver: e.args?.receiver,
                amount: ethers.formatUnits(e.args?.amount || 0, 6),
                serviceId: ethers.decodeBytes32String(e.args?.serviceId || '0x'),
                timestamp: Number(e.args?.timestamp || 0)
            };
        });
    }

    /**
     * Get USDC balance for an address
     */
    async getUSDCBalance(address: string): Promise<string> {
        const usdc = this.getUSDCContract();
        const balance = await usdc.balanceOf(address);
        return ethers.formatUnits(balance, 6);
    }
}

// Export singleton instance
export const x402PaymentService = new X402PaymentService();
