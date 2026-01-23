/**
 * Cronos Developer Platform SDK Integration
 * 
 * Unified service for interacting with all Cronos networks (EVM + zkEVM)
 * using the official @crypto.com/developer-platform-client SDK.
 * 
 * Supports all 4 Cronos networks:
 * - Cronos EVM Mainnet (Chain ID: 25)
 * - Cronos EVM Testnet (Chain ID: 338)
 * - Cronos zkEVM Mainnet (Chain ID: 388)
 * - Cronos zkEVM Testnet (Chain ID: 240)
 */

import {
    Client,
    Wallet,
    Token,
    Transaction,
    Block,
    Contract,
    CronosId,
    Defi,
    Exchange,
    CronosEvm,
    CronosZkEvm,
    DefiProtocol
} from '@crypto.com/developer-platform-client';

export type CronosNetwork = 'cronos-evm-mainnet' | 'cronos-evm-testnet' | 'cronos-zkevm-mainnet' | 'cronos-zkevm-testnet';

export interface CronosConfig {
    apiKey: string;
    defaultNetwork?: CronosNetwork;
    provider?: string;
}

export interface ChainInfo {
    chainId: number;
    name: string;
    rpc: string;
    explorer: string;
    explorerApi: string;
}

const CHAIN_INFO: Record<CronosNetwork, ChainInfo> = {
    'cronos-evm-mainnet': {
        chainId: 25,
        name: 'Cronos EVM Mainnet',
        rpc: 'https://evm.cronos.org',
        explorer: 'https://cronoscan.com',
        explorerApi: 'https://api.cronoscan.com/api'
    },
    'cronos-evm-testnet': {
        chainId: 338,
        name: 'Cronos EVM Testnet',
        rpc: 'https://evm-t3.cronos.org',
        explorer: 'https://testnet.cronoscan.com',
        explorerApi: 'https://api-testnet.cronoscan.com/api'
    },
    'cronos-zkevm-mainnet': {
        chainId: 388,
        name: 'Cronos zkEVM Mainnet',
        rpc: 'https://mainnet.zkevm.cronos.org',
        explorer: 'https://explorer.zkevm.cronos.org',
        explorerApi: 'https://explorer-api.zkevm.cronos.org/api/v1'
    },
    'cronos-zkevm-testnet': {
        chainId: 240,
        name: 'Cronos zkEVM Testnet',
        rpc: 'https://testnet.zkevm.cronos.org',
        explorer: 'https://explorer.zkevm.cronos.org/testnet',
        explorerApi: 'https://explorer-api.zkevm.cronos.org/testnet/api/v1'
    }
};

function getChainConstant(network: CronosNetwork) {
    switch (network) {
        case 'cronos-evm-mainnet':
            return CronosEvm.Mainnet;
        case 'cronos-evm-testnet':
            return CronosEvm.Testnet;
        case 'cronos-zkevm-mainnet':
            return CronosZkEvm.Mainnet;
        case 'cronos-zkevm-testnet':
            return CronosZkEvm.Testnet;
        default:
            throw new Error(`Unknown network: ${network}`);
    }
}

export class CronosSDK {
    private initialized = false;
    private config: CronosConfig;
    private currentNetwork: CronosNetwork;

    constructor(config: CronosConfig) {
        this.config = config;
        this.currentNetwork = config.defaultNetwork || 'cronos-evm-testnet';
    }

    initialize(): void {
        if (this.initialized) return;

        Client.init({
            apiKey: this.config.apiKey,
            provider: this.config.provider
        });

        this.initialized = true;
    }

    private ensureInitialized(): void {
        if (!this.initialized) {
            this.initialize();
        }
    }

    setNetwork(network: CronosNetwork): void {
        this.currentNetwork = network;
    }

    getNetwork(): CronosNetwork {
        return this.currentNetwork;
    }

    getChainInfo(network?: CronosNetwork): ChainInfo {
        return CHAIN_INFO[network || this.currentNetwork];
    }

    getAllNetworks(): Record<CronosNetwork, ChainInfo> {
        return CHAIN_INFO;
    }

    // Wallet Module
    async createWallet(): Promise<{
        address: string;
        privateKey: string;
        mnemonic: string;
    }> {
        this.ensureInitialized();
        const result = await Wallet.create();
        return result.data;
    }

    async getWalletBalance(address: string): Promise<{ balance: string }> {
        this.ensureInitialized();
        const result = await Wallet.balance(address);
        return result.data;
    }

    // Token Module
    async getNativeBalance(address: string): Promise<{ balance: string }> {
        this.ensureInitialized();
        const result = await Token.getNativeTokenBalance(address);
        return result.data;
    }

    async getERC20Balance(
        walletAddress: string,
        contractAddress: string,
        blockHeight = 'latest'
    ): Promise<{ balance: string }> {
        this.ensureInitialized();
        const result = await Token.getERC20TokenBalance(walletAddress, contractAddress, blockHeight);
        return result.data;
    }

    async getERC721Balance(
        walletAddress: string,
        contractAddress: string
    ): Promise<{ balance: string }> {
        this.ensureInitialized();
        const result = await Token.getERC721TokenBalance(walletAddress, contractAddress);
        return result.data;
    }

    async getTokenOwner(
        contractAddress: string,
        tokenId: string
    ): Promise<string> {
        this.ensureInitialized();
        const result = await Token.getTokenOwner(contractAddress, tokenId);
        return result.data;
    }

    async getTokenURI(
        contractAddress: string,
        tokenId: string
    ): Promise<string> {
        this.ensureInitialized();
        const result = await Token.getTokenURI(contractAddress, tokenId);
        return result.data;
    }

    async getERC20Metadata(contractAddress: string) {
        this.ensureInitialized();
        const result = await Token.getERC20Metadata(contractAddress);
        return result.data;
    }

    async getERC721Metadata(contractAddress: string) {
        this.ensureInitialized();
        const result = await Token.getERC721Metadata(contractAddress);
        return result.data;
    }

    // Transaction Module
    async getTransactionByHash(txHash: string) {
        this.ensureInitialized();
        const result = await Transaction.getTransactionByHash(txHash);
        return result.data;
    }

    async getTransactionStatus(txHash: string) {
        this.ensureInitialized();
        const result = await Transaction.getTransactionStatus(txHash);
        return result.data;
    }

    async getTransactionCount(walletAddress: string): Promise<{ count: number }> {
        this.ensureInitialized();
        const result = await Transaction.getTransactionCount(walletAddress);
        return result.data;
    }

    async getGasPrice(): Promise<{ gasPrice: string }> {
        this.ensureInitialized();
        const result = await Transaction.getGasPrice();
        return result.data;
    }

    async getFeeData() {
        this.ensureInitialized();
        const result = await Transaction.getFeeData();
        return result.data;
    }

    async estimateGas(payload: {
        from: string;
        to: string;
        value?: string;
        gasLimit?: string;
        gasPrice?: string;
        data?: string;
    }) {
        this.ensureInitialized();
        const result = await Transaction.estimateGas(payload);
        return result.data;
    }

    // Block Module
    async getCurrentBlock(): Promise<{ blockNumber: number }> {
        this.ensureInitialized();
        const result = await Block.getCurrentBlock();
        return result.data;
    }

    async getBlockByTag(tag: string, txDetail = 'false') {
        this.ensureInitialized();
        const result = await Block.getBlockByTag(tag, txDetail);
        return result.data;
    }

    // Contract Module
    async getContractCode(contractAddress: string) {
        this.ensureInitialized();
        const result = await Contract.getContractCode(contractAddress);
        return result.data;
    }

    // CronosID Module (EVM only, not supported on zkEVM)
    async isCronosId(name: string): Promise<boolean> {
        return CronosId.isCronosId(name);
    }

    async resolveCronosId(name: string) {
        this.ensureInitialized();
        const result = await CronosId.forwardResolve(name);
        return result.data;
    }

    async reverseLookupAddress(address: string) {
        this.ensureInitialized();
        const result = await CronosId.reverseResolve(address);
        return result.data;
    }

    // DeFi Module
    async getWhitelistedTokens(protocol: 'H2' | 'VVS'): Promise<Array<{
        id: number;
        name: string;
        symbol: string;
        address: string;
        decimal: number;
        isSwappable: boolean;
        chain: string;
        chainId: number;
    }>> {
        this.ensureInitialized();
        const defiProtocol = protocol === 'H2' ? DefiProtocol.H2 : DefiProtocol.VVS;
        const result = await Defi.getWhitelistedTokens(defiProtocol);
        return result.data;
    }

    async getAllFarms(protocol: 'H2' | 'VVS'): Promise<Array<{
        id: number;
        lpSymbol: string;
        lpAddress: string;
        baseApr: number;
        baseApy: number;
        chain: string;
        chainId: number;
    }>> {
        this.ensureInitialized();
        const defiProtocol = protocol === 'H2' ? DefiProtocol.H2 : DefiProtocol.VVS;
        const result = await Defi.getAllFarms(defiProtocol);
        return result.data;
    }

    async getFarmBySymbol(protocol: 'H2' | 'VVS', symbol: string): Promise<{
        id: number;
        lpSymbol: string;
        lpAddress: string;
        baseApr: number;
        baseApy: number;
        lpApr: number;
        lpApy: number;
        chain: string;
        chainId: number;
    }> {
        this.ensureInitialized();
        const defiProtocol = protocol === 'H2' ? DefiProtocol.H2 : DefiProtocol.VVS;
        const result = await Defi.getFarmBySymbol(defiProtocol, symbol);
        return result.data;
    }

    // Exchange Module (chain agnostic)
    async getAllTickers(): Promise<Array<{
        instrumentName: string;
        high: number;
        low: number;
        lastPrice: number;
        volume: number;
        volumeValue: number;
        priceChange: number;
        bestBid: number;
        bestAsk: number;
        timestamp: number;
    }>> {
        this.ensureInitialized();
        const result = await Exchange.getAllTickers();
        return result.data;
    }

    async getTickerByInstrument(instrumentName: string): Promise<{
        instrumentName: string;
        high: number;
        low: number;
        lastPrice: number;
        volume: number;
        volumeValue: number;
        priceChange: number;
        bestBid: number;
        bestAsk: number;
        openInterest: number;
        timestamp: number;
    }> {
        this.ensureInitialized();
        const result = await Exchange.getTickerByInstrument(instrumentName);
        return result.data;
    }
}

// Singleton instance for shared usage
let sdkInstance: CronosSDK | null = null;

export function initializeCronosSDK(config: CronosConfig): CronosSDK {
    sdkInstance = new CronosSDK(config);
    sdkInstance.initialize();
    return sdkInstance;
}

export function getCronosSDK(): CronosSDK {
    if (!sdkInstance) {
        throw new Error('CronosSDK not initialized. Call initializeCronosSDK first.');
    }
    return sdkInstance;
}

export {
    CronosEvm,
    CronosZkEvm,
    DefiProtocol,
    CHAIN_INFO,
    getChainConstant
};
