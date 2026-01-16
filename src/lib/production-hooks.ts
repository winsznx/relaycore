import { useState, useCallback } from 'react';
import { x402Client, vvsSwap, type VVSTradeParams, type VVSTradeResult, type PaymentRequirements } from './blockchain';
import { ethers } from 'ethers';

// ============================================
// x402 PAYMENT HOOKS
// ============================================

export function useX402Payment() {
    const [isExecuting, setIsExecuting] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const createPaymentRequirements = useCallback((params: {
        payTo: string;
        amount: string;
        description?: string;
    }) => {
        return x402Client.createPaymentRequirements(params);
    }, []);

    const payForResource = useCallback(async (params: {
        resourceUrl: string;
        signer: ethers.Signer;
    }) => {
        setIsExecuting(true);
        setError(null);

        try {
            const result = await x402Client.payForResource(params);
            return result;
        } catch (err: any) {
            setError(err);
            throw err;
        } finally {
            setIsExecuting(false);
        }
    }, []);

    const verifyPayment = useCallback(async (
        paymentHeader: string,
        requirements: PaymentRequirements
    ) => {
        return await x402Client.verifyPayment(paymentHeader, requirements);
    }, []);

    const settlePayment = useCallback(async (
        paymentHeader: string,
        requirements: PaymentRequirements
    ) => {
        return await x402Client.settlePayment(paymentHeader, requirements);
    }, []);

    return {
        isExecuting,
        error,
        createPaymentRequirements,
        payForResource,
        verifyPayment,
        settlePayment
    };
}

// ============================================
// VVS SWAP HOOKS
// ============================================

export function useVVSSwap() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const getBestTrade = useCallback(async (params: VVSTradeParams): Promise<VVSTradeResult | null> => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await vvsSwap.getBestTrade(params);
            return result;
        } catch (err: any) {
            setError(err);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const executeTrade = useCallback(async (
        trade: any,
        signer: ethers.Signer
    ) => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await vvsSwap.executeTrade(trade, signer);
            return result;
        } catch (err: any) {
            setError(err);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const getTokenBalance = useCallback(async (
        tokenAddress: string,
        walletAddress: string
    ) => {
        try {
            return await vvsSwap.getTokenBalance(tokenAddress, walletAddress);
        } catch (err: any) {
            console.error('Failed to get token balance:', err);
            return 0n;
        }
    }, []);

    const getNativeBalance = useCallback(async (walletAddress: string) => {
        try {
            return await vvsSwap.getNativeBalance(walletAddress);
        } catch (err: any) {
            console.error('Failed to get native balance:', err);
            return 0n;
        }
    }, []);

    return {
        isLoading,
        error,
        getBestTrade,
        executeTrade,
        getTokenBalance,
        getNativeBalance
    };
}

// ============================================
// COMBINED TRADING HOOK
// ============================================

export function useTradingServices() {
    const x402 = useX402Payment();
    const vvs = useVVSSwap();

    return {
        x402,
        vvs
    };
}
