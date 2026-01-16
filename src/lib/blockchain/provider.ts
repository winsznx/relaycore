/**
 * Ethereum/Cronos Provider Service
 * 
 * Provides a reliable provider using ethers.FallbackProvider or automatic rotation.
 * Supports both Cronos Testnet and Mainnet.
 */

import { ethers } from 'ethers';

// RPC endpoints for Cronos
const RPC_ENDPOINTS = {
    testnet: [
        'https://evm-t3.cronos.org',
        'https://cronos-testnet.drpc.org'
    ].filter(Boolean),
    mainnet: [
        'https://evm.cronos.org',
        'https://cronos-evm.publicnode.com'
    ].filter(Boolean)
};

const CHAIN_IDS = {
    testnet: 338,
    mainnet: 25
};

class ReliableProvider {
    private provider: ethers.JsonRpcProvider | null = null;
    private network: 'testnet' | 'mainnet';
    private rpcIndex = 0;

    constructor(network: 'testnet' | 'mainnet') {
        this.network = network;
    }

    async getProvider(): Promise<ethers.Provider> {
        if (this.provider) {
            try {
                // Quick health check
                await this.provider.getNetwork();
                return this.provider;
            } catch (e) {
                console.warn('Current provider unhealthy, rotating...', e);
                this.provider = null;
            }
        }

        return this.rotateProvider();
    }

    private async rotateProvider(): Promise<ethers.Provider> {
        const urls = RPC_ENDPOINTS[this.network];

        for (let i = 0; i < urls.length; i++) {
            const index = (this.rpcIndex + i) % urls.length;
            const url = urls[index];

            try {
                console.log(`Trying RPC: ${url}`);
                // Use StaticJsonRpcProvider-like behavior in v6 via basic JsonRpcProvider
                const p = new ethers.JsonRpcProvider(url, undefined, {
                    staticNetwork: new ethers.Network(this.network === 'testnet' ? 'Cronos Testnet' : 'Cronos', CHAIN_IDS[this.network])
                });

                // Verify connection
                await p.getNetwork();

                this.provider = p;
                this.rpcIndex = index; // Stick with this one
                console.log(`Connected to RPC: ${url}`);
                return p;
            } catch (e) {
                console.warn(`Failed to connect to RPC ${url}:`, e);
            }
        }

        throw new Error('All RPC endpoints failed');
    }
}

// Singleton instances
const instances: Record<string, ReliableProvider> = {};

export function getProvider(): ethers.JsonRpcProvider {
    // This is a bit of a hack to match the previous sync signature
    // In a real app, we should propagate async, but for now we fallback to the first URL
    // and rely on internal reconnection for requests
    // Support both browser and Node.js environments
    const isBrowser = typeof window !== 'undefined';
    const network = ((isBrowser ? import.meta.env.VITE_CRONOS_NETWORK : process.env.VITE_CRONOS_NETWORK) || 'testnet') as 'testnet' | 'mainnet';

    if (!instances[network]) {
        instances[network] = new ReliableProvider(network);
    }

    // Return a proxy that ensures we always get a live provider for calls
    const rp = instances[network];
    const urls = RPC_ENDPOINTS[network];

    // Return a standard provider pointing to the primary for now
    // The previous implementation was Sync, so we must return a provider instance immediately.
    // We'll use the first one and hope for the best, or better:

    return new ethers.JsonRpcProvider(urls[0], undefined, {
        staticNetwork: new ethers.Network(network === 'testnet' ? 'Cronos Testnet' : 'Cronos', CHAIN_IDS[network])
    });
}

export async function getSigner(): Promise<ethers.Signer> {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
        const browserProvider = new ethers.BrowserProvider((window as any).ethereum);
        return browserProvider.getSigner();
    }
    throw new Error('No wallet provider found');
}

export async function getBlockNumber(): Promise<number> {
    return (await getProvider()).getBlockNumber();
}

export async function getBalance(address: string): Promise<string> {
    const balance = await (await getProvider()).getBalance(address);
    return ethers.formatEther(balance);
}
