/**
 * Cronos Developer Platform SDK Integration for MCP Server
 * 
 * Provides MCP tools that leverage the official @crypto.com/developer-platform-client SDK
 * for all Cronos blockchain operations.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
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

interface ChainInfo {
    chainId: number;
    name: string;
    rpc: string;
    explorer: string;
}

const CHAIN_INFO: Record<CronosNetwork, ChainInfo> = {
    'cronos-evm-mainnet': {
        chainId: 25,
        name: 'Cronos EVM Mainnet',
        rpc: 'https://evm.cronos.org',
        explorer: 'https://cronoscan.com'
    },
    'cronos-evm-testnet': {
        chainId: 338,
        name: 'Cronos EVM Testnet',
        rpc: 'https://evm-t3.cronos.org',
        explorer: 'https://testnet.cronoscan.com'
    },
    'cronos-zkevm-mainnet': {
        chainId: 388,
        name: 'Cronos zkEVM Mainnet',
        rpc: 'https://mainnet.zkevm.cronos.org',
        explorer: 'https://explorer.zkevm.cronos.org'
    },
    'cronos-zkevm-testnet': {
        chainId: 240,
        name: 'Cronos zkEVM Testnet',
        rpc: 'https://testnet.zkevm.cronos.org',
        explorer: 'https://explorer.zkevm.cronos.org/testnet'
    }
};

let sdkInitialized = false;

function initializeSDK(): boolean {
    if (sdkInitialized) return true;

    const apiKey = process.env.DEVELOPER_PLATFORM_API_KEY;
    if (!apiKey) {
        console.error('[Cronos SDK] DEVELOPER_PLATFORM_API_KEY not set');
        return false;
    }

    try {
        Client.init({
            apiKey,
            provider: process.env.CRONOS_RPC_URL
        });
        sdkInitialized = true;
        console.error('[Cronos SDK] Initialized successfully');
        return true;
    } catch (error) {
        console.error('[Cronos SDK] Initialization failed:', error);
        return false;
    }
}

function formatContent(data: unknown): { content: Array<{ type: 'text'; text: string }> } {
    return {
        content: [{
            type: 'text' as const,
            text: JSON.stringify(data, null, 2)
        }]
    };
}

function errorContent(message: string): { content: Array<{ type: 'text'; text: string }> } {
    return {
        content: [{
            type: 'text' as const,
            text: JSON.stringify({ error: message }, null, 2)
        }]
    };
}

export function registerCronosSDKTools(server: McpServer): void {
    // Initialize SDK on first tool registration
    initializeSDK();

    // Network Information
    server.tool(
        "cronos_sdk_networks",
        {},
        async () => {
            return formatContent({
                initialized: sdkInitialized,
                defaultNetwork: process.env.CRONOS_DEFAULT_NETWORK || 'cronos-evm-testnet',
                networks: CHAIN_INFO
            });
        }
    );

    // Wallet Module
    server.tool(
        "cronos_sdk_create_wallet",
        {},
        async () => {
            if (!sdkInitialized) return errorContent('SDK not initialized. Set DEVELOPER_PLATFORM_API_KEY.');
            try {
                const result = await Wallet.create();
                return formatContent(result.data);
            } catch (error) {
                return errorContent(error instanceof Error ? error.message : 'Failed to create wallet');
            }
        }
    );

    server.tool(
        "cronos_sdk_wallet_balance",
        { address: z.string().describe("Wallet address or CronosId (e.g., xyz.cro)") },
        async ({ address }) => {
            if (!sdkInitialized) return errorContent('SDK not initialized. Set DEVELOPER_PLATFORM_API_KEY.');
            try {
                const result = await Wallet.balance(address);
                return formatContent(result.data);
            } catch (error) {
                return errorContent(error instanceof Error ? error.message : 'Failed to get balance');
            }
        }
    );

    // Token Module
    server.tool(
        "cronos_sdk_native_balance",
        { address: z.string().describe("Wallet address or CronosId") },
        async ({ address }) => {
            if (!sdkInitialized) return errorContent('SDK not initialized. Set DEVELOPER_PLATFORM_API_KEY.');
            try {
                const result = await Token.getNativeTokenBalance(address);
                return formatContent(result.data);
            } catch (error) {
                return errorContent(error instanceof Error ? error.message : 'Failed to get native balance');
            }
        }
    );

    server.tool(
        "cronos_sdk_erc20_balance",
        {
            walletAddress: z.string().describe("Wallet address"),
            contractAddress: z.string().describe("ERC20 contract address"),
            blockHeight: z.string().optional().describe("Block height (default: latest)")
        },
        async ({ walletAddress, contractAddress, blockHeight }) => {
            if (!sdkInitialized) return errorContent('SDK not initialized. Set DEVELOPER_PLATFORM_API_KEY.');
            try {
                const result = await Token.getERC20TokenBalance(walletAddress, contractAddress, blockHeight || 'latest');
                return formatContent(result.data);
            } catch (error) {
                return errorContent(error instanceof Error ? error.message : 'Failed to get ERC20 balance');
            }
        }
    );

    server.tool(
        "cronos_sdk_erc721_balance",
        {
            walletAddress: z.string().describe("Wallet address"),
            contractAddress: z.string().describe("ERC721 contract address")
        },
        async ({ walletAddress, contractAddress }) => {
            if (!sdkInitialized) return errorContent('SDK not initialized. Set DEVELOPER_PLATFORM_API_KEY.');
            try {
                const result = await Token.getERC721TokenBalance(walletAddress, contractAddress);
                return formatContent(result.data);
            } catch (error) {
                return errorContent(error instanceof Error ? error.message : 'Failed to get ERC721 balance');
            }
        }
    );

    server.tool(
        "cronos_sdk_token_metadata",
        {
            contractAddress: z.string().describe("Token contract address"),
            tokenType: z.enum(['erc20', 'erc721']).describe("Token type")
        },
        async ({ contractAddress, tokenType }) => {
            if (!sdkInitialized) return errorContent('SDK not initialized. Set DEVELOPER_PLATFORM_API_KEY.');
            try {
                const result = tokenType === 'erc20'
                    ? await Token.getERC20Metadata(contractAddress)
                    : await Token.getERC721Metadata(contractAddress);
                return formatContent(result.data);
            } catch (error) {
                return errorContent(error instanceof Error ? error.message : 'Failed to get token metadata');
            }
        }
    );

    // Transaction Module
    server.tool(
        "cronos_sdk_transaction",
        { txHash: z.string().describe("Transaction hash") },
        async ({ txHash }) => {
            if (!sdkInitialized) return errorContent('SDK not initialized. Set DEVELOPER_PLATFORM_API_KEY.');
            try {
                const result = await Transaction.getTransactionByHash(txHash);
                return formatContent(result.data);
            } catch (error) {
                return errorContent(error instanceof Error ? error.message : 'Failed to get transaction');
            }
        }
    );

    server.tool(
        "cronos_sdk_transaction_status",
        { txHash: z.string().describe("Transaction hash") },
        async ({ txHash }) => {
            if (!sdkInitialized) return errorContent('SDK not initialized. Set DEVELOPER_PLATFORM_API_KEY.');
            try {
                const result = await Transaction.getTransactionStatus(txHash);
                return formatContent(result.data);
            } catch (error) {
                return errorContent(error instanceof Error ? error.message : 'Failed to get transaction status');
            }
        }
    );

    server.tool(
        "cronos_sdk_gas_price",
        {},
        async () => {
            if (!sdkInitialized) return errorContent('SDK not initialized. Set DEVELOPER_PLATFORM_API_KEY.');
            try {
                const result = await Transaction.getGasPrice();
                return formatContent(result.data);
            } catch (error) {
                return errorContent(error instanceof Error ? error.message : 'Failed to get gas price');
            }
        }
    );

    server.tool(
        "cronos_sdk_fee_data",
        {},
        async () => {
            if (!sdkInitialized) return errorContent('SDK not initialized. Set DEVELOPER_PLATFORM_API_KEY.');
            try {
                const result = await Transaction.getFeeData();
                return formatContent(result.data);
            } catch (error) {
                return errorContent(error instanceof Error ? error.message : 'Failed to get fee data');
            }
        }
    );

    // Block Module
    server.tool(
        "cronos_sdk_current_block",
        {},
        async () => {
            if (!sdkInitialized) return errorContent('SDK not initialized. Set DEVELOPER_PLATFORM_API_KEY.');
            try {
                const result = await Block.getCurrentBlock();
                return formatContent(result.data);
            } catch (error) {
                return errorContent(error instanceof Error ? error.message : 'Failed to get current block');
            }
        }
    );

    server.tool(
        "cronos_sdk_block_by_tag",
        {
            tag: z.string().describe("Block tag: 'latest', 'pending', or hex block number"),
            txDetail: z.enum(['true', 'false']).optional().describe("Include full transaction objects")
        },
        async ({ tag, txDetail }) => {
            if (!sdkInitialized) return errorContent('SDK not initialized. Set DEVELOPER_PLATFORM_API_KEY.');
            try {
                const result = await Block.getBlockByTag(tag, txDetail || 'false');
                return formatContent(result.data);
            } catch (error) {
                return errorContent(error instanceof Error ? error.message : 'Failed to get block');
            }
        }
    );

    // Contract Module
    server.tool(
        "cronos_sdk_contract_code",
        { contractAddress: z.string().describe("Contract address") },
        async ({ contractAddress }) => {
            if (!sdkInitialized) return errorContent('SDK not initialized. Set DEVELOPER_PLATFORM_API_KEY.');
            try {
                const result = await Contract.getContractCode(contractAddress);
                return formatContent(result.data);
            } catch (error) {
                return errorContent(error instanceof Error ? error.message : 'Failed to get contract code');
            }
        }
    );

    // CronosID Module
    server.tool(
        "cronos_sdk_resolve_cronosid",
        { name: z.string().describe("CronosId name (e.g., xyz.cro)") },
        async ({ name }) => {
            if (!sdkInitialized) return errorContent('SDK not initialized. Set DEVELOPER_PLATFORM_API_KEY.');
            try {
                const isCronosId = CronosId.isCronosId(name);
                if (!isCronosId) {
                    return errorContent('Invalid CronosId format. Must end with .cro');
                }
                const result = await CronosId.forwardResolve(name);
                return formatContent({ name, address: result.data });
            } catch (error) {
                return errorContent(error instanceof Error ? error.message : 'Failed to resolve CronosId');
            }
        }
    );

    server.tool(
        "cronos_sdk_reverse_lookup",
        { address: z.string().describe("Wallet address") },
        async ({ address }) => {
            if (!sdkInitialized) return errorContent('SDK not initialized. Set DEVELOPER_PLATFORM_API_KEY.');
            try {
                const result = await CronosId.reverseResolve(address);
                return formatContent({ address, cronosId: result.data });
            } catch (error) {
                return errorContent(error instanceof Error ? error.message : 'Failed to reverse lookup');
            }
        }
    );

    // DeFi Module
    server.tool(
        "cronos_sdk_defi_tokens",
        { protocol: z.enum(['H2', 'VVS']).describe("DeFi protocol") },
        async ({ protocol }) => {
            if (!sdkInitialized) return errorContent('SDK not initialized. Set DEVELOPER_PLATFORM_API_KEY.');
            try {
                const defiProtocol = protocol === 'H2' ? DefiProtocol.H2 : DefiProtocol.VVS;
                const result = await Defi.getWhitelistedTokens(defiProtocol);
                return formatContent(result.data);
            } catch (error) {
                return errorContent(error instanceof Error ? error.message : 'Failed to get whitelisted tokens');
            }
        }
    );

    server.tool(
        "cronos_sdk_defi_farms",
        { protocol: z.enum(['H2', 'VVS']).describe("DeFi protocol") },
        async ({ protocol }) => {
            if (!sdkInitialized) return errorContent('SDK not initialized. Set DEVELOPER_PLATFORM_API_KEY.');
            try {
                const defiProtocol = protocol === 'H2' ? DefiProtocol.H2 : DefiProtocol.VVS;
                const result = await Defi.getAllFarms(defiProtocol);
                return formatContent(result.data);
            } catch (error) {
                return errorContent(error instanceof Error ? error.message : 'Failed to get farms');
            }
        }
    );

    server.tool(
        "cronos_sdk_defi_farm_by_symbol",
        {
            protocol: z.enum(['H2', 'VVS']).describe("DeFi protocol"),
            symbol: z.string().describe("Farm symbol (e.g., zkCRO-MOON)")
        },
        async ({ protocol, symbol }) => {
            if (!sdkInitialized) return errorContent('SDK not initialized. Set DEVELOPER_PLATFORM_API_KEY.');
            try {
                const defiProtocol = protocol === 'H2' ? DefiProtocol.H2 : DefiProtocol.VVS;
                const result = await Defi.getFarmBySymbol(defiProtocol, symbol);
                return formatContent(result.data);
            } catch (error) {
                return errorContent(error instanceof Error ? error.message : 'Failed to get farm');
            }
        }
    );

    // Exchange Module
    server.tool(
        "cronos_sdk_exchange_tickers",
        {},
        async () => {
            if (!sdkInitialized) return errorContent('SDK not initialized. Set DEVELOPER_PLATFORM_API_KEY.');
            try {
                const result = await Exchange.getAllTickers();
                return formatContent(result.data);
            } catch (error) {
                return errorContent(error instanceof Error ? error.message : 'Failed to get tickers');
            }
        }
    );

    server.tool(
        "cronos_sdk_exchange_ticker",
        { instrument: z.string().describe("Trading instrument (e.g., BTC_USDT)") },
        async ({ instrument }) => {
            if (!sdkInitialized) return errorContent('SDK not initialized. Set DEVELOPER_PLATFORM_API_KEY.');
            try {
                const result = await Exchange.getTickerByInstrument(instrument);
                return formatContent(result.data);
            } catch (error) {
                return errorContent(error instanceof Error ? error.message : 'Failed to get ticker');
            }
        }
    );

    console.error('[Cronos SDK] Registered all SDK tools');
}
