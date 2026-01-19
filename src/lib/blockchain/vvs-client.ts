/**
 * VVS Finance Swap SDK - Production Implementation
 * 
 * Full integration with @vvs-finance/swap-sdk
 * Based on official SDK documentation and examples
 * 
 * Documentation: https://github.com/vvs-finance/swap-sdk
 */

import {
    fetchBestTrade,
    executeTrade,
    prepareTradeTxRequest,
    approveIfNeeded,
    prepareApprovalTxRequestIfNeeded,
    fetchTokenBalanceWei,
    fetchNativeTokenBalanceWei,
    fetchTradeInputTokenAllowanceWei,
    wrapNative,
    unwrapNative,
    BuiltInChainId,
    TradeType,
    PoolType,
    utils,
    abi,
    type Trade,
    type BestAMMTradeOpts,
    type ExecuteTradeOptions
} from '@vvs-finance/swap-sdk';
import { ethers, type Signer, type Provider, type TransactionResponse } from 'ethers';

// ============================================
// TYPES
// ============================================

export interface VVSTradeParams {
    inputToken: string; // Address or "NATIVE"
    outputToken: string; // Address or "NATIVE"
    amount: string; // Human-readable amount
    tradeType?: 'EXACT_INPUT' | 'EXACT_OUTPUT';
    slippageTolerance?: number; // Percentage (e.g., 0.5 for 0.5%)
    maxHops?: number; // 1-3
    maxSplits?: number; // 1-2
    poolTypes?: PoolType[];
}

export interface VVSTradeResult {
    trade: Trade;
    inputAmount: string;
    outputAmount: string;
    executionPrice: string;
    priceImpact: string;
    route: string[];
    minimumOutput?: string;
    maximumInput?: string;
}

export interface VVSExecuteResult {
    txHash: string;
    txResponse: TransactionResponse;
}

// ============================================
// VVS SWAP SERVICE (Production)
// ============================================

export class VVSSwapService {
    private chainId: BuiltInChainId;
    private network: 'mainnet' | 'testnet';
    private quoteApiClientId?: string;

    constructor(
        network: 'mainnet' | 'testnet' = 'testnet',
        quoteApiClientId?: string
    ) {
        this.network = network;
        this.chainId = network === 'mainnet'
            ? BuiltInChainId.CRONOS_MAINNET
            : BuiltInChainId.CRONOS_TESTNET;

        // Try to get client ID from environment if not provided
        this.quoteApiClientId = quoteApiClientId ||
            import.meta.env[`VITE_VVS_API_CLIENT_ID_${this.chainId}`] ||
            process.env[`SWAP_SDK_QUOTE_API_CLIENT_ID_${this.chainId}`];
    }

    /**
     * Fetch best trade route using VVS SDK
     * 
     * @param params Trade parameters
     * @returns Best trade with details
     */
    async getBestTrade(params: VVSTradeParams): Promise<VVSTradeResult> {
        const opts: Partial<BestAMMTradeOpts> = {
            tradeType: params.tradeType === 'EXACT_OUTPUT'
                ? TradeType.EXACT_OUTPUT
                : TradeType.EXACT_INPUT,
            maxHops: params.maxHops || 3,
            maxSplits: params.maxSplits || 2,
            poolTypes: params.poolTypes || [
                PoolType.V2,
                PoolType.V3_100,
                PoolType.V3_500,
                PoolType.V3_3000,
                PoolType.V3_10000
            ],
            slippageTolerance: params.slippageTolerance || 0.5,
            quoteApiClientId: this.quoteApiClientId
        };

        const trade = await fetchBestTrade(
            this.chainId,
            params.inputToken,
            params.outputToken,
            params.amount,
            opts
        );

        // Format trade details
        const formatted = utils.formatTrade(trade);

        return {
            trade,
            inputAmount: trade.inputAmount.toString(),
            outputAmount: trade.outputAmount.toString(),
            executionPrice: trade.executionPrice?.toString() || '0',
            priceImpact: trade.priceImpact?.toString() || '0',
            route: trade.route?.map((r: any) => r.address || r) || [],
            minimumOutput: trade.minimumAmountOut?.toString(),
            maximumInput: trade.maximumAmountIn?.toString()
        };
    }

    /**
     * Execute a trade on-chain
     * 
     * @param trade Trade object from getBestTrade
     * @param signer Ethers signer
     * @param options Execution options
     * @returns Transaction response
     */
    async executeTrade(
        trade: Trade,
        signer: Signer,
        options?: ExecuteTradeOptions
    ): Promise<VVSExecuteResult> {
        // First check if approval is needed
        const approvalTx = await approveIfNeeded(this.chainId, trade, signer);

        if (approvalTx) {
            console.log('Approval required, waiting for confirmation...');
            const receipt = await approvalTx.wait();
            console.log('Approval confirmed:', receipt?.hash);
        }

        // Execute the trade
        const txResponse = await executeTrade(this.chainId, trade, signer, options);

        return {
            txHash: txResponse.hash,
            txResponse
        };
    }

    /**
     * Prepare trade transaction for manual execution
     * Use this if you want to execute via your own web3 interface
     * 
     * @param trade Trade object
     * @param recipient Recipient address
     * @returns Transaction request object
     */
    prepareTradeTx(trade: Trade, recipient: string) {
        return prepareTradeTxRequest(this.chainId, trade, recipient);
    }

    /**
     * Check if approval is needed and prepare approval tx
     * 
     * @param trade Trade object
     * @param walletAddress Wallet address
     * @returns Approval transaction request or null
     */
    async prepareApprovalIfNeeded(trade: Trade, walletAddress: string) {
        return await prepareApprovalTxRequestIfNeeded(this.chainId, trade, walletAddress);
    }

    /**
     * Get token balance
     * 
     * @param tokenAddress Token contract address
     * @param walletAddress Wallet address
     * @param provider Optional provider
     * @returns Balance in wei
     */
    async getTokenBalance(
        tokenAddress: string,
        walletAddress: string,
        provider?: Provider
    ): Promise<bigint> {
        return await fetchTokenBalanceWei(
            this.chainId,
            tokenAddress,
            walletAddress,
            provider
        );
    }

    /**
     * Get native token (CRO) balance
     * 
     * @param walletAddress Wallet address
     * @param provider Optional provider
     * @returns Balance in wei
     */
    async getNativeBalance(
        walletAddress: string,
        provider?: Provider
    ): Promise<bigint> {
        return await fetchNativeTokenBalanceWei(
            this.chainId,
            walletAddress,
            provider
        );
    }

    /**
     * Get token allowance for trade
     * 
     * @param trade Trade object
     * @param walletAddress Wallet address
     * @returns Allowance in wei
     */
    async getTradeAllowance(trade: Trade, walletAddress: string): Promise<bigint> {
        return await fetchTradeInputTokenAllowanceWei(
            this.chainId,
            trade,
            walletAddress
        );
    }

    /**
     * Wrap native CRO to WCRO
     * 
     * @param amount Amount in wei
     * @param signer Ethers signer
     * @returns Transaction response
     */
    async wrapNative(amount: bigint, signer: Signer): Promise<TransactionResponse> {
        return await wrapNative(this.chainId, amount, signer);
    }

    /**
     * Unwrap WCRO to native CRO
     * 
     * @param amount Amount in wei
     * @param signer Ethers signer
     * @returns Transaction response
     */
    async unwrapNative(amount: bigint, signer: Signer): Promise<TransactionResponse> {
        return await unwrapNative(this.chainId, amount, signer);
    }

    /**
     * Get native token info
     */
    getNativeTokenInfo() {
        return utils.getNativeTokenInfo(this.chainId);
    }

    /**
     * Get wrapped native token info
     */
    getWrappedNativeTokenInfo() {
        return utils.getWrappedNativeTokenInfo(this.chainId);
    }

    /**
     * Check if two addresses are the same
     */
    isSameAddress(addr1: string, addr2: string): boolean {
        return utils.isSameAddr(addr1, addr2);
    }

    /**
     * Get SmartRouter ABI
     */
    getSmartRouterABI() {
        return abi.SmartRouter;
    }

    /**
     * Get ERC20 ABI
     */
    getERC20ABI() {
        return abi.ERC20;
    }

    /**
     * Get WCRO ABI
     */
    getWCROABI() {
        return abi.WCRO;
    }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Format trade for display
 */
export function formatTradeDisplay(trade: Trade): string {
    return utils.formatTrade(trade);
}

/**
 * Parse amount to wei
 */
export function parseAmount(amount: string, decimals: number = 18): bigint {
    return ethers.parseUnits(amount, decimals);
}

/**
 * Format wei to human-readable
 */
export function formatAmount(wei: bigint, decimals: number = 18): string {
    return ethers.formatUnits(wei, decimals);
}

// ============================================
// EXPORTS
// ============================================

// Export singleton instances
export const vvsSwapTestnet = new VVSSwapService('testnet');
export const vvsSwapMainnet = new VVSSwapService('mainnet');

// Default export based on environment
export const vvsSwap = new VVSSwapService(
    (import.meta.env.VITE_CRONOS_NETWORK || 'testnet') as 'mainnet' | 'testnet'
);

// Re-export SDK types and enums
export {
    BuiltInChainId,
    TradeType,
    PoolType,
    utils as vvsUtils,
    abi as vvsABI
};
export type { Trade, BestAMMTradeOpts, ExecuteTradeOptions };
