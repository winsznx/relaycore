/**
 * Wallet Connection Hook
 * 
 * Provides wallet connection functionality for the Playground
 * Supports MetaMask, WalletConnect, and other EVM wallets
 */

import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import logger from '@/lib/logger';

export interface WalletState {
    address: string | null;
    chainId: number | null;
    isConnected: boolean;
    isConnecting: boolean;
    error: string | null;
}

export interface WalletActions {
    connect: () => Promise<void>;
    disconnect: () => void;
    switchNetwork: (chainId: number) => Promise<void>;
    signMessage: (message: string) => Promise<string>;
    sendTransaction: (tx: ethers.TransactionRequest) => Promise<string>;
}

const CRONOS_TESTNET_CHAIN_ID = 338;
const CRONOS_MAINNET_CHAIN_ID = 25;

export function useWallet(): WalletState & WalletActions {
    const [state, setState] = useState<WalletState>({
        address: null,
        chainId: null,
        isConnected: false,
        isConnecting: false,
        error: null
    });

    const connect = useCallback(async () => {
        setState(prev => ({ ...prev, isConnecting: true, error: null }));

        try {
            if (typeof window === 'undefined' || !window.ethereum) {
                throw new Error('No wallet detected. Please install MetaMask or another Web3 wallet.');
            }

            const provider = new ethers.BrowserProvider(window.ethereum);

            const accounts = await provider.send('eth_requestAccounts', []);

            if (!accounts || accounts.length === 0) {
                throw new Error('No accounts found');
            }

            const network = await provider.getNetwork();
            const address = accounts[0];
            const chainId = Number(network.chainId);

            setState({
                address,
                chainId,
                isConnected: true,
                isConnecting: false,
                error: null
            });

            logger.info('Wallet connected', { address, chainId });

            if (chainId !== CRONOS_TESTNET_CHAIN_ID && chainId !== CRONOS_MAINNET_CHAIN_ID) {
                logger.warn('Not on Cronos network', { chainId });
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to connect wallet';
            setState({
                address: null,
                chainId: null,
                isConnected: false,
                isConnecting: false,
                error: errorMessage
            });
            logger.error('Wallet connection failed', error as Error);
        }
    }, []);

    const disconnect = useCallback(() => {
        setState({
            address: null,
            chainId: null,
            isConnected: false,
            isConnecting: false,
            error: null
        });
        logger.info('Wallet disconnected');
    }, []);

    const switchNetwork = useCallback(async (targetChainId: number) => {
        try {
            if (!window.ethereum) {
                throw new Error('No wallet detected');
            }

            const chainIdHex = `0x${targetChainId.toString(16)}`;

            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: chainIdHex }],
                });
            } catch (switchError: any) {
                if (switchError.code === 4902) {
                    const networkConfig = targetChainId === CRONOS_TESTNET_CHAIN_ID ? {
                        chainId: chainIdHex,
                        chainName: 'Cronos Testnet',
                        nativeCurrency: {
                            name: 'TCRO',
                            symbol: 'TCRO',
                            decimals: 18
                        },
                        rpcUrls: ['https://evm-t3.cronos.org'],
                        blockExplorerUrls: ['https://cronos.org/explorer/testnet3']
                    } : {
                        chainId: chainIdHex,
                        chainName: 'Cronos Mainnet',
                        nativeCurrency: {
                            name: 'CRO',
                            symbol: 'CRO',
                            decimals: 18
                        },
                        rpcUrls: ['https://evm.cronos.org'],
                        blockExplorerUrls: ['https://cronoscan.com']
                    };

                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [networkConfig],
                    });
                } else {
                    throw switchError;
                }
            }

            setState(prev => ({ ...prev, chainId: targetChainId }));
            logger.info('Network switched', { chainId: targetChainId });
        } catch (error) {
            logger.error('Network switch failed', error as Error);
            throw error;
        }
    }, []);

    const signMessage = useCallback(async (message: string): Promise<string> => {
        try {
            if (!window.ethereum || !state.address) {
                throw new Error('Wallet not connected');
            }

            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const signature = await signer.signMessage(message);

            logger.info('Message signed', { address: state.address });
            return signature;
        } catch (error) {
            logger.error('Message signing failed', error as Error);
            throw error;
        }
    }, [state.address]);

    const sendTransaction = useCallback(async (tx: ethers.TransactionRequest): Promise<string> => {
        try {
            if (!window.ethereum || !state.address) {
                throw new Error('Wallet not connected');
            }

            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const txResponse = await signer.sendTransaction(tx);

            logger.info('Transaction sent', { hash: txResponse.hash });
            return txResponse.hash;
        } catch (error) {
            logger.error('Transaction failed', error as Error);
            throw error;
        }
    }, [state.address]);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.ethereum) return;

        const handleAccountsChanged = (accounts: string[]) => {
            if (accounts.length === 0) {
                disconnect();
            } else {
                setState(prev => ({ ...prev, address: accounts[0] }));
            }
        };

        const handleChainChanged = (chainIdHex: string) => {
            const chainId = parseInt(chainIdHex, 16);
            setState(prev => ({ ...prev, chainId }));
        };

        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);

        return () => {
            window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
            window.ethereum?.removeListener('chainChanged', handleChainChanged);
        };
    }, [disconnect]);

    return {
        ...state,
        connect,
        disconnect,
        switchNetwork,
        signMessage,
        sendTransaction
    };
}
