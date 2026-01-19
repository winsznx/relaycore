import { createAppKit } from '@reown/appkit/react'
import { WagmiProvider, http } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { mainnet, arbitrum, defineChain } from '@reown/appkit/networks'
import React, { Component } from 'react'
import type { ReactNode } from 'react'

// Define Cronos Mainnet using official Reown defineChain
const cronos = defineChain({
    id: 25,
    caipNetworkId: 'eip155:25',
    chainNamespace: 'eip155',
    name: 'Cronos',
    nativeCurrency: {
        decimals: 18,
        name: 'Cronos',
        symbol: 'CRO',
    },
    rpcUrls: {
        default: {
            http: ['https://evm.cronos.org'],
        },
    },
    blockExplorers: {
        default: { name: 'Cronoscan', url: 'https://cronoscan.com' },
    },
})

// Define Cronos Testnet using official Reown defineChain
const cronosTestnet = defineChain({
    id: 338,
    caipNetworkId: 'eip155:338',
    chainNamespace: 'eip155',
    name: 'Cronos Testnet',
    nativeCurrency: {
        decimals: 18,
        name: 'Test CRO',
        symbol: 'TCRO',
    },
    rpcUrls: {
        default: {
            http: ['https://evm-t3.cronos.org'],
        },
    },
    blockExplorers: {
        default: { name: 'Cronos Explorer', url: 'https://explorer.cronos.org/testnet' },
    },
})

// 1. Get projectId from https://dashboard.reown.com
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'f4b974e1d40d765b6451e7c3bf09c3d8'

// 2. Create metadata object
const metadata = {
    name: 'Relay Core',
    description: 'Decentralized Service Payments with Reputation',
    url: typeof window !== 'undefined' ? window.location.origin : 'https://relaycore.xyz',
    icons: ['https://relaycore.xyz/icon.png']
}

// 3. Set the networks - Cronos first as default
const networks = [cronos, cronosTestnet, mainnet, arbitrum] as const

// 4. Create Wagmi Adapter with explicit transports
const wagmiAdapter = new WagmiAdapter({
    networks: networks as any,
    projectId,
    ssr: true,
    transports: {
        [cronos.id]: http('https://evm.cronos.org'),
        [cronosTestnet.id]: http('https://evm-t3.cronos.org'),
        [mainnet.id]: http(),
        [arbitrum.id]: http()
    }
})

// 5. Create AppKit modal
createAppKit({
    adapters: [wagmiAdapter],
    networks: networks as any,
    defaultNetwork: cronos,
    projectId,
    metadata,
    features: {
        analytics: true,
        email: false,
        socials: false
    },
    chainImages: {
        25: 'https://cryptologos.cc/logos/cronos-cro-logo.png',
        338: 'https://cryptologos.cc/logos/cronos-cro-logo.png'
    }
})

// Query client for React Query
export const queryClient = new QueryClient()

// Error boundary for graceful failure handling
class Web3ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; errorMessage: string }> {
    constructor(props: { children: ReactNode }) {
        super(props)
        this.state = { hasError: false, errorMessage: '' }
    }

    static getDerivedStateFromError(error: Error) {
        const isWeb3Error =
            error.message?.toLowerCase().includes('web3') ||
            error.message?.toLowerCase().includes('wagmi') ||
            error.message?.toLowerCase().includes('wallet') ||
            error.message?.toLowerCase().includes('connector') ||
            error.message?.toLowerCase().includes('chain') ||
            error.message?.toLowerCase().includes('rpc') ||
            error.message?.toLowerCase().includes('provider') ||
            error.message?.toLowerCase().includes('ethereum')

        if (isWeb3Error) {
            return { hasError: true, errorMessage: error.message }
        }
        throw error
    }

    componentDidCatch(error: Error) {
        console.error('Web3Provider error:', error)
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans">
                    <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
                        <div className="mx-auto h-12 w-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2">Web3 Connection Error</h2>
                        <p className="text-gray-500 mb-6">
                            We couldn't connect to the blockchain network. This usually happens when the RPC endpoint is unreachable or blocked.
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-[#111111] text-white px-6 py-2.5 rounded-lg font-medium hover:bg-black transition-colors w-full"
                        >
                            Retry Connection
                        </button>
                    </div>
                </div>
            )
        }
        return this.props.children
    }
}

// Main Web3 Provider component
// Using type assertion to work around React types version mismatch
const WagmiProviderTyped = WagmiProvider as React.ComponentType<{ config: typeof wagmiAdapter.wagmiConfig; children: ReactNode }>

export function Web3Provider({ children }: { children: ReactNode }) {
    return (
        <Web3ErrorBoundary>
            <QueryClientProvider client={queryClient}>
                <WagmiProviderTyped config={wagmiAdapter.wagmiConfig}>
                    {children}
                </WagmiProviderTyped>
            </QueryClientProvider>
        </Web3ErrorBoundary>
    )
}

// Re-export all Reown AppKit hooks for use in components
export {
    useAppKit,
    useAppKitAccount,
    useAppKitState,
    useAppKitBalance,
    useAppKitNetwork,
    useAppKitTheme,
    useAppKitProvider
} from '@reown/appkit/react'

// Export network definitions for use elsewhere
export { cronos, cronosTestnet }
