/**
 * Relay Core MCP Server
 * 
 * Unified Model Context Protocol server providing:
 * - Relay Core agents, services, and x402 payments
 * - Crypto.com MCP bridge (remote MCP server integration)
 * - Cronos blockchain native integration
 * - Multi-DEX price aggregation
 * 
 * Architecture: Supports both stdio (Claude Code) and HTTP (Claude Web) transport
 * for integration with Claude Code and other MCP-compatible clients.
 * 
 * @see https://modelcontextprotocol.io
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { EventSource } from "eventsource";
import { z } from "zod";
// Polyfill EventSource for Node.js
if (!global.EventSource) {
    global.EventSource = EventSource as any;
}
import { ethers } from "ethers";
import express from "express";
import cors from "cors";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env from the mcp-server directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

// Debug: Log environment variables on startup
console.error('[MCP Server] Environment check:', {
    ESCROW_CONTRACT_ADDRESS: process.env.ESCROW_CONTRACT_ADDRESS ? 'SET' : 'NOT SET',
    WALLET_PRIVATE_KEY: process.env.WALLET_PRIVATE_KEY ? 'SET' : 'NOT SET',
    CRONOS_RPC_URL: process.env.CRONOS_RPC_URL ? 'SET' : 'NOT SET'
});

// Official x402 Facilitator Client from Crypto.com
import { Facilitator, type PaymentRequirements, CronosNetwork } from '@crypto.com/facilitator-client';

// Cronos Developer Platform SDK Tools
import { registerCronosSDKTools } from './cronos-sdk.js';

// RWA State Machine Tools
import { registerRWATools } from './rwa-tools.js';

// CRYPTO.COM MCP BRIDGE
// Runtime bridge to Crypto.com MCP server using Standard MCP Client (SSE)

const CRYPTO_COM_MCP_SSE_URL = 'https://mcp.crypto.com/market-data/mcp/sse';
let mcpClient: Client | null = null;
let mcpTransport: SSEClientTransport | null = null;

async function getMcpClient(): Promise<Client> {
    if (mcpClient) return mcpClient;

    try {
        console.error(`[MCP Bridge] Connecting to ${CRYPTO_COM_MCP_SSE_URL}...`);

        mcpTransport = new SSEClientTransport(new URL(CRYPTO_COM_MCP_SSE_URL));
        mcpClient = new Client(
            { name: "relaycore-bridge", version: "1.0.0" },
            { capabilities: {} }
        );

        await mcpClient.connect(mcpTransport);
        console.error('[MCP Bridge] Connected successfully');

        // Handle closure
        mcpTransport.onclose = () => {
            console.error('[MCP Bridge] Connection closed');
            mcpClient = null;
            mcpTransport = null;
        };

        return mcpClient;

    } catch (error) {
        console.error('[MCP Bridge] Connection failed:', error);
        mcpClient = null;
        mcpTransport = null;
        throw error;
    }
}

async function callCryptoComTool(toolName: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const client = await getMcpClient();

    try {
        const result = await client.callTool({
            name: toolName,
            arguments: args
        });

        // result is CallToolResult { content: ... }
        if (result?.content && Array.isArray(result.content)) {
            const textContent = result.content.find(c => c.type === 'text');
            if (textContent?.text) {
                try {
                    return JSON.parse(textContent.text);
                } catch {
                    return textContent.text;
                }
            }
        }
        return result;

    } catch (error) {
        // If connection died, retry once
        if ((error as Error).message?.includes('Connection') || (error as Error).message?.includes('Transport')) {
            console.error('[MCP Bridge] Retrying call after connection error...');
            mcpClient = null;
            const newClient = await getMcpClient();
            return newClient.callTool({ name: toolName, arguments: args });
        }
        throw error;
    }
}

async function listCryptoComTools(): Promise<unknown> {
    const client = await getMcpClient();
    return await client.listTools();
}

// ============================================
// START SERVER
// ============================================

// ============================================
// CONFIGURATION
// ============================================

const config = {
    // Relay Core backend
    relayCoreApi: process.env.RELAY_CORE_API_URL || 'http://localhost:4000',

    // Crypto.com MCP (remote server)
    cryptoComMcp: 'https://mcp.crypto.com/market-data/mcp',

    // Crypto.com Exchange API (for direct calls)
    cryptoComExchange: 'https://api.crypto.com/exchange/v1',

    // Cronos RPC endpoints (all 4 networks)
    cronos: {
        mainnet: {
            rpc: 'https://evm.cronos.org',
            chainId: 25,
            explorer: 'https://cronoscan.com',
            explorerApi: 'https://api.cronoscan.com/api'
        },
        testnet: {
            rpc: process.env.CRONOS_RPC_URL || 'https://evm-t3.cronos.org',
            chainId: 338,
            explorer: 'https://explorer.cronos.org/testnet',
            explorerApi: 'https://explorer-api.cronos.org/testnet/api'
        },
        'zkevm-mainnet': {
            rpc: 'https://mainnet.zkevm.cronos.org',
            chainId: 388,
            explorer: 'https://explorer.zkevm.cronos.org',
            explorerApi: 'https://explorer-api.zkevm.cronos.org/api/v1'
        },
        'zkevm-testnet': {
            rpc: 'https://testnet.zkevm.cronos.org',
            chainId: 240,
            explorer: 'https://explorer.zkevm.cronos.org/testnet',
            explorerApi: 'https://explorer-api.zkevm.cronos.org/testnet/api/v1'
        }
    },

    // Pyth for price feeds
    pyth: process.env.PYTH_PRICE_SERVICE_URL || 'https://hermes.pyth.network',

    // Claude API for AI features
    claudeApiKey: process.env.CLAUDE_API_KEY,

    // Cronoscan API key (optional, for higher rate limits)
    cronoscanApiKey: process.env.CRONOSCAN_API_KEY,

    // x402 Payment Configuration
    x402: {
        walletPrivateKey: process.env.WALLET_PRIVATE_KEY,
        autoPay: process.env.X402_AUTO_PAY === 'true',
        usdcAddress: process.env.USDC_TOKEN_ADDRESS || '0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0',
        paymentRecipient: process.env.PAYMENT_RECIPIENT_ADDRESS
    },

    // HTTP Server Configuration
    http: {
        enabled: process.env.MCP_HTTP_MODE === 'true',
        port: parseInt(process.env.MCP_HTTP_PORT || '3002'),
        corsOrigins: process.env.MCP_CORS_ORIGINS || '*'
    }
};

// ============================================
// x402 PAYMENT WALLET
// ============================================

// ERC20 ABI for USDC transfers (includes EIP-3009 for Facilitator)
const ERC20_ABI = [
    "function transfer(address to, uint256 amount) returns (bool)",
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function name() view returns (string)",
    "function nonces(address owner) view returns (uint256)"
];

// Official x402 Facilitator client (from @crypto.com/facilitator-client)
let facilitator: Facilitator | null = null;

function initializeFacilitator() {
    try {
        facilitator = new Facilitator({ network: CronosNetwork.CronosTestnet });
        console.error(`[x402] Facilitator initialized on Cronos Testnet`);
        return true;
    } catch (error) {
        console.error('[x402] Failed to initialize Facilitator:', error);
        return false;
    }
}

// Initialize wallet if private key is provided
let wallet: ethers.Wallet | null = null;
let provider: ethers.JsonRpcProvider | null = null;

function initializeWallet() {
    if (config.x402.walletPrivateKey) {
        try {
            provider = new ethers.JsonRpcProvider(config.cronos.testnet.rpc);
            wallet = new ethers.Wallet(config.x402.walletPrivateKey, provider);
            console.error(`[x402] Wallet initialized: ${wallet.address}`);
            // Also initialize the Facilitator
            initializeFacilitator();
            return true;
        } catch (error) {
            console.error('[x402] Failed to initialize wallet:', error);
            return false;
        }
    }
    return false;
}

// Initialize wallet on module load
initializeWallet();

/**
 * Generate a payment header using the official Crypto.com Facilitator SDK
 * This creates a signed EIP-3009 TransferWithAuthorization that the Facilitator can settle
 * 
 * @param paymentRequirements - Payment requirements from 402 response
 * @returns Payment header string for the Facilitator
 */
async function generatePaymentHeader(
    paymentRequirements: PaymentRequirements
): Promise<string | null> {
    if (!wallet || !facilitator) {
        console.error('[x402] Wallet or Facilitator not initialized');
        return null;
    }

    try {
        const usdc = new ethers.Contract(config.x402.usdcAddress, ERC20_ABI, provider!);

        // Check balance first
        const balance = await usdc.balanceOf(wallet.address);
        const requiredAmount = BigInt(paymentRequirements.maxAmountRequired);

        if (balance < requiredAmount) {
            console.error(`[x402] Insufficient USDC balance. Have: ${balance}, Need: ${requiredAmount}`);
            return null;
        }

        console.error(`[x402] Generating payment header via Facilitator SDK...`);

        // Use official Facilitator SDK to generate payment header
        const paymentHeader = await facilitator.generatePaymentHeader({
            to: paymentRequirements.payTo,
            value: paymentRequirements.maxAmountRequired,
            asset: paymentRequirements.asset,
            signer: wallet,
            validAfter: Math.floor(Date.now() / 1000) - 60,
            validBefore: Math.floor(Date.now() / 1000) + (paymentRequirements.maxTimeoutSeconds || 300)
        });

        console.error(`[x402] Payment header generated successfully`);
        return paymentHeader;
    } catch (error) {
        console.error('[x402] Failed to generate payment header:', error);
        return null;
    }
}

/**
 * Get wallet status and USDC balance
 */
async function getWalletStatus(): Promise<{
    initialized: boolean;
    address: string | null;
    croBalance: string | null;
    usdcBalance: string | null;
    autoPayEnabled: boolean;
}> {
    if (!wallet || !provider) {
        return {
            initialized: false,
            address: null,
            croBalance: null,
            usdcBalance: null,
            autoPayEnabled: config.x402.autoPay
        };
    }

    try {
        const usdc = new ethers.Contract(config.x402.usdcAddress, ERC20_ABI, provider);
        const [croBalance, usdcBalance] = await Promise.all([
            provider.getBalance(wallet.address),
            usdc.balanceOf(wallet.address)
        ]);

        return {
            initialized: true,
            address: wallet.address,
            croBalance: ethers.formatEther(croBalance),
            usdcBalance: (Number(usdcBalance) / 1e6).toFixed(2), // USDC has 6 decimals
            autoPayEnabled: config.x402.autoPay
        };
    } catch (error) {
        return {
            initialized: true,
            address: wallet.address,
            croBalance: null,
            usdcBalance: null,
            autoPayEnabled: config.x402.autoPay
        };
    }
}

// ============================================
// INITIALIZE MCP SERVER
// ============================================

const server = new McpServer({
    name: "Relay Core",
    version: "1.0.0",
});

// ============================================
// HELPER FUNCTIONS
// ============================================

async function fetchJson(url: string, options?: RequestInit) {
    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
}

async function cronosRpc(
    method: string,
    params: unknown[] = [],
    network: 'mainnet' | 'testnet' | 'zkevm-mainnet' | 'zkevm-testnet' = 'testnet'
) {
    const networkConfig = config.cronos[network];
    if (!networkConfig) {
        throw new Error(`Unknown network: ${network}`);
    }
    const rpcUrl = networkConfig.rpc;
    const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method,
            params
        })
    });
    const json = await response.json();
    if (json.error) {
        throw new Error(json.error.message || 'RPC error');
    }
    return json.result;
}

function formatContent(data: unknown): { content: Array<{ type: "text"; text: string }> } {
    return {
        content: [{
            type: "text",
            text: JSON.stringify(data, null, 2)
        }]
    };
}

function errorContent(message: string): { content: Array<{ type: "text"; text: string }> } {
    return {
        content: [{
            type: "text",
            text: `Error: ${message}`
        }]
    };
}

// ============================================
// TASK ARTIFACT TRACKING
// ============================================

interface TaskArtifactInput {
    tool_name: string;
    inputs: Record<string, unknown>;
}

interface TaskArtifact {
    task_id: string;
    agent_id: string;
    service_id?: string;
    state: 'idle' | 'pending' | 'settled' | 'failed';
}

/**
 * Create a TaskArtifact for tracking tool execution
 */
async function createTaskArtifact(input: TaskArtifactInput): Promise<TaskArtifact | null> {
    try {
        const agentId = wallet?.address || 'mcp-anonymous';
        const response = await fetch(`${config.relayCoreApi}/api/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agent_id: agentId,
                service_id: `mcp:${input.tool_name}`,
                inputs: input.inputs,
            }),
        });

        if (!response.ok) {
            console.error('Failed to create task artifact:', await response.text());
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('Task artifact creation error:', error);
        return null;
    }
}

/**
 * Mark a TaskArtifact as settled (successful)
 */
async function settleTaskArtifact(taskId: string, outputs: Record<string, unknown>): Promise<void> {
    try {
        await fetch(`${config.relayCoreApi}/api/tasks/${taskId}/settle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ outputs }),
        });
    } catch (error) {
        console.error('Task artifact settle error:', error);
    }
}

/**
 * Mark a TaskArtifact as failed
 */
async function failTaskArtifact(taskId: string, error: { code: string; message: string }): Promise<void> {
    try {
        await fetch(`${config.relayCoreApi}/api/tasks/${taskId}/fail`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: { ...error, retryable: true } }),
        });
    } catch (err) {
        console.error('Task artifact fail error:', err);
    }
}

/**
 * Execute a tool with TaskArtifact tracking
 */
async function executeWithArtifact<T>(
    toolName: string,
    inputs: Record<string, unknown>,
    executor: () => Promise<T>
): Promise<T> {
    const task = await createTaskArtifact({ tool_name: toolName, inputs });

    try {
        const result = await executor();

        if (task) {
            await settleTaskArtifact(task.task_id, { result });
        }

        return result;
    } catch (error) {
        if (task) {
            await failTaskArtifact(task.task_id, {
                code: 'EXECUTION_FAILED',
                message: error instanceof Error ? error.message : String(error),
            });
        }
        throw error;
    }
}


// ============================================
// SECTION 0: x402 PAYMENT TOOLS
// ============================================

/**
 * Check x402 wallet status and balances
 */
server.tool(
    "x402_wallet_status",
    {},
    async () => {
        const status = await getWalletStatus();
        return formatContent({
            ...status,
            usdcTokenAddress: config.x402.usdcAddress,
            network: "cronos_testnet",
            chainId: 338,
            instructions: status.initialized
                ? "Wallet is ready for x402 payments"
                : "Set WALLET_PRIVATE_KEY in .env to enable x402 payments"
        });
    }
);

/**
 * Execute an x402 USDC payment via Facilitator (true x402 flow)
 * Uses official @crypto.com/facilitator-client SDK
 */
server.tool(
    "x402_pay",
    {
        recipient: z.string().describe("Payment recipient address (0x...)"),
        amountUsdc: z.number().describe("Amount in USDC (e.g., 0.01 for 1 cent)"),
        resourceUrl: z.string().optional().describe("Resource URL for entitlement (optional)")
    },
    async ({ recipient, amountUsdc, resourceUrl = "/manual-payment" }) => {
        return executeWithArtifact(
            'x402_pay',
            { recipient, amountUsdc, resourceUrl },
            async () => {
                if (!wallet || !facilitator) {
                    throw new Error("Wallet or Facilitator not initialized. Set WALLET_PRIVATE_KEY in .env");
                }

                // Convert to raw units (6 decimals)
                const amountRaw = Math.floor(amountUsdc * 1e6).toString();

                // Generate a payment ID
                const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(7)}`;

                // Build payment requirements using Facilitator SDK
                const paymentRequirements = facilitator.generatePaymentRequirements({
                    payTo: recipient,
                    maxAmountRequired: amountRaw,
                    resource: resourceUrl,
                    description: 'Manual x402 payment'
                });

                // Generate payment header using official SDK
                const paymentHeader = await generatePaymentHeader(paymentRequirements);

                if (!paymentHeader) {
                    throw new Error("Failed to generate payment header. Check USDC balance.");
                }

                // Settle via Facilitator
                const settleResponse = await fetch(`${config.relayCoreApi}/api/pay`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        paymentId,
                        paymentHeader,
                        paymentRequirements
                    })
                });

                const settleResult = await settleResponse.json();

                if (!settleResponse.ok || !settleResult.success) {
                    throw new Error(settleResult.error || settleResult.details || "Facilitator settlement failed");
                }

                return formatContent({
                    success: true,
                    method: "facilitator",
                    paymentId,
                    txHash: settleResult.txHash,
                    recipient,
                    amountUsdc,
                    amountRaw,
                    explorer: `https://explorer.cronos.org/testnet/tx/${settleResult.txHash}`
                });
            }
        );
    }
);

/**
 * Get a quote with automatic x402 payment if required
 * This is the main tool for paid services - it handles 402 responses automatically
 */
server.tool(
    "x402_get_quote_with_payment",
    {
        pair: z.string().describe("Trading pair: BTC-USD, ETH-USD, CRO-USD"),
        side: z.enum(["long", "short"]).describe("Trade direction"),
        leverage: z.number().min(1).max(50).describe("Leverage (1-50x)"),
        sizeUsd: z.number().min(100).describe("Position size in USD"),
        autoPay: z.boolean().optional().describe("Auto-pay if 402 (default: based on X402_AUTO_PAY env)")
    },
    async ({ pair, side, leverage, sizeUsd, autoPay }) => {
        const shouldAutoPay = autoPay ?? config.x402.autoPay;

        try {
            // First request - may return 402
            const response = await fetch(`${config.relayCoreApi}/api/perpai/quote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pair, side, leverage, sizeUsd })
            });

            if (response.status === 402) {
                const body = await response.json();
                // Backend returns: { paymentRequirements: { payTo, maxAmountRequired, ... } }
                const requirements = body.paymentRequirements || body;
                const payTo = requirements.payTo || requirements.recipient;
                const amount = requirements.maxAmountRequired || requirements.amount;

                // If auto-pay is disabled, return payment requirements
                if (!shouldAutoPay || !wallet) {
                    return formatContent({
                        status: "payment_required",
                        x402: {
                            amount: amount,
                            amountFormatted: amount ? `${(parseInt(amount) / 1e6).toFixed(2)} USDC` : 'unknown',
                            token: "USDC",
                            recipient: payTo,
                            network: requirements.network || "cronos-testnet",
                            chainId: 338,
                            resource: "/api/perpai/quote",
                            paymentId: body.paymentId
                        },
                        instruction: wallet
                            ? "Set autoPay: true to pay automatically, or use x402_pay tool"
                            : "Set WALLET_PRIVATE_KEY to enable auto-payment"
                    });
                }

                // ========================================
                // TRUE x402 FLOW via Official Facilitator SDK
                // ========================================
                // 1. Generate payment header using @crypto.com/facilitator-client
                // 2. Send paymentHeader to /api/pay for settlement
                // 3. Facilitator executes transfer on-chain
                // 4. Retry request with X-Payment-Id

                const paymentId = body.paymentId;

                // Generate payment header using official Facilitator SDK
                const paymentHeader = await generatePaymentHeader(requirements as PaymentRequirements);

                if (!paymentHeader) {
                    return errorContent("Failed to generate x402 payment header. Check USDC balance.");
                }

                console.error(`[x402] Sending payment to Facilitator for settlement...`);

                // Settle payment via Facilitator endpoint
                const settleResponse = await fetch(`${config.relayCoreApi}/api/pay`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        paymentId,
                        paymentHeader,
                        paymentRequirements: requirements
                    })
                });

                const settleResult = await settleResponse.json();

                if (!settleResponse.ok || !settleResult.success) {
                    console.error(`[x402] Facilitator settlement failed:`, settleResult);
                    return formatContent({
                        status: "payment_failed",
                        error: settleResult.error || settleResult.details || "Facilitator settlement failed",
                        paymentId,
                        debug: settleResult
                    });
                }

                console.error(`[x402] Payment settled via Facilitator: ${settleResult.txHash}`);

                // Retry request with payment entitlement
                const retryResponse = await fetch(`${config.relayCoreApi}/api/perpai/quote`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Payment-Id': paymentId
                    },
                    body: JSON.stringify({ pair, side, leverage, sizeUsd })
                });

                const quoteData = await retryResponse.json();

                return formatContent({
                    status: "quote_ready",
                    x402Payment: {
                        method: "facilitator",
                        paymentId,
                        txHash: settleResult.txHash,
                        amountUsdc: (parseInt(amount) / 1e6).toFixed(2),
                        explorer: `https://explorer.cronos.org/testnet/tx/${settleResult.txHash}`
                    },
                    quote: quoteData
                });
            }

            // No payment required
            const json = await response.json();
            return formatContent({
                status: "quote_ready",
                paymentRequired: false,
                quote: json
            });
        } catch (err) {
            return errorContent(err instanceof Error ? err.message : 'Failed to get quote');
        }
    }
);

// SECTION 1: CRYPTO.COM MCP BRIDGE
// Bridge to Crypto.com MCP server using HTTP JSON-RPC

/**
 * List all available tools from Crypto.com MCP
 */
server.tool(
    "crypto_com_list_tools",
    {},
    async () => {
        try {
            const result = await listCryptoComTools() as { tools?: Array<{ name: string; description?: string; inputSchema?: unknown }> };

            return formatContent({
                source: "crypto.com_mcp",
                description: "Available tools from Crypto.com MCP",
                toolCount: result?.tools?.length || 0,
                tools: result?.tools?.map(t => ({
                    name: t.name,
                    description: t.description,
                    inputSchema: t.inputSchema
                })) || []
            });
        } catch (err) {
            return errorContent(err instanceof Error ? err.message : 'Failed to list Crypto.com MCP tools');
        }
    }
);

/**
 * Call any tool from Crypto.com MCP dynamically
 */
server.tool(
    "crypto_com_call_tool",
    {
        toolName: z.string().describe("Name of the Crypto.com MCP tool to call"),
        arguments: z.record(z.unknown()).optional().describe("Arguments to pass to the tool")
    },
    async ({ toolName, arguments: args = {} }) => {
        try {
            const result = await callCryptoComTool(toolName, args);

            return formatContent({
                source: "crypto.com_mcp",
                tool: toolName,
                arguments: args,
                result
            });
        } catch (err) {
            return errorContent(err instanceof Error ? err.message : `Failed to call Crypto.com MCP tool: ${toolName}`);
        }
    }
);

// CRYPTO.COM CONVENIENCE WRAPPERS
// Typed wrappers for common tools with API fallback

/**
 * Get cryptocurrency ticker data
 */
server.tool(
    "crypto_com_get_ticker",
    {
        instrument: z.string().describe("Trading pair like 'BTC_USDT', 'ETH_USDT', 'CRO_USDT'"),
    },
    async ({ instrument }) => {
        try {
            const result = await callCryptoComTool('get_ticker', {
                instrument_name: instrument
            });

            return formatContent({
                source: "crypto.com_mcp",
                instrument,
                data: result
            });
        } catch (err) {
            // Fallback to direct API if MCP connection fails
            try {
                const response = await fetch(
                    `https://api.crypto.com/exchange/v1/public/get-ticker?instrument_name=${instrument}`
                );
                const json = await response.json();

                if (json.code !== 0) {
                    return errorContent(`Crypto.com API error: ${json.message || 'Unknown error'}`);
                }

                const data = json.result?.data || json.result;
                return formatContent({
                    source: "crypto.com_api_fallback",
                    instrument: data.i || instrument,
                    ticker: {
                        lastPrice: data.a,
                        bidPrice: data.b,
                        askPrice: data.k,
                        high24h: data.h,
                        low24h: data.l,
                        volume24h: data.v,
                        volumeUsd24h: data.vv,
                        priceChange24h: data.c,
                        priceChangePercent24h: data.cp,
                        timestamp: data.t ? new Date(data.t).toISOString() : new Date().toISOString()
                    }
                });
            } catch (fallbackErr) {
                return errorContent(err instanceof Error ? err.message : 'Failed to fetch ticker from MCP');
            }
        }
    }
);

/**
 * Get order book data
 */
server.tool(
    "crypto_com_get_orderbook",
    {
        instrument: z.string().describe("Trading pair like 'BTC_USDT'"),
        depth: z.number().optional().describe("Order book depth (default: 10)")
    },
    async ({ instrument, depth = 10 }) => {
        try {
            const result = await callCryptoComTool('get_book', {
                instrument_name: instrument,
                depth
            });

            return formatContent({
                source: "crypto.com_mcp",
                instrument,
                depth,
                data: result
            });
        } catch (err) {
            // Fallback to direct API
            try {
                const response = await fetch(
                    `https://api.crypto.com/exchange/v1/public/get-book?instrument_name=${instrument}&depth=${depth}`
                );
                const json = await response.json();

                if (json.code !== 0) {
                    return errorContent(`Crypto.com API error: ${json.message || 'Unknown error'}`);
                }

                const data = json.result?.data || json.result;
                return formatContent({
                    source: "crypto.com_api_fallback",
                    instrument,
                    orderbook: {
                        bids: data.bids?.slice(0, depth).map((b: any) => ({
                            price: b[0],
                            quantity: b[1],
                            total: b[2]
                        })),
                        asks: data.asks?.slice(0, depth).map((a: any) => ({
                            price: a[0],
                            quantity: a[1],
                            total: a[2]
                        })),
                        timestamp: data.t ? new Date(data.t).toISOString() : new Date().toISOString()
                    }
                });
            } catch (fallbackErr) {
                return errorContent(err instanceof Error ? err.message : 'Failed to fetch orderbook from MCP');
            }
        }
    }
);

/**
 * Get candlestick/OHLCV data from Crypto.com via MCP
 */
server.tool(
    "crypto_com_get_candlestick",
    {
        instrument: z.string().describe("Trading pair like 'BTC_USDT'"),
        timeframe: z.enum(["1m", "5m", "15m", "30m", "1h", "4h", "1D", "1W", "1M"]).describe("Candlestick timeframe"),
        count: z.number().optional().describe("Number of candles (default: 100)")
    },
    async ({ instrument, timeframe, count = 100 }) => {
        try {
            // Call Crypto.com MCP's get_candlestick tool
            const result = await callCryptoComTool('get_candlestick', {
                instrument_name: instrument,
                timeframe,
                count
            });

            return formatContent({
                source: "crypto.com_mcp",
                instrument,
                timeframe,
                data: result
            });
        } catch (err) {
            // Fallback to direct API
            try {
                const response = await fetch(
                    `https://api.crypto.com/exchange/v1/public/get-candlestick?instrument_name=${instrument}&timeframe=${timeframe}&count=${count}`
                );
                const json = await response.json();

                if (json.code !== 0) {
                    return errorContent(`Crypto.com API error: ${json.message || 'Unknown error'}`);
                }

                const data = json.result?.data || [];
                return formatContent({
                    source: "crypto.com_api_fallback",
                    instrument,
                    timeframe,
                    candles: data.map((c: any) => ({
                        timestamp: new Date(c.t).toISOString(),
                        open: c.o,
                        high: c.h,
                        low: c.l,
                        close: c.c,
                        volume: c.v
                    }))
                });
            } catch (fallbackErr) {
                return errorContent(err instanceof Error ? err.message : 'Failed to fetch candlestick from MCP');
            }
        }
    }
);

/**
 * Get all available instruments from Crypto.com via MCP
 */
server.tool(
    "crypto_com_get_instruments",
    {
        type: z.enum(["SPOT", "PERPETUAL"]).optional().describe("Filter by instrument type")
    },
    async ({ type }) => {
        try {
            // Call Crypto.com MCP's get_instruments tool
            const result = await callCryptoComTool('get_instruments', type ? { type } : {});

            return formatContent({
                source: "crypto.com_mcp",
                data: result
            });
        } catch (err) {
            // Fallback to direct API
            try {
                const response = await fetch(
                    'https://api.crypto.com/exchange/v1/public/get-instruments'
                );
                const json = await response.json();

                if (json.code !== 0) {
                    return errorContent(`Crypto.com API error: ${json.message || 'Unknown error'}`);
                }

                let instruments = json.result?.data || [];

                if (type) {
                    instruments = instruments.filter((i: any) => i.inst_type === type);
                }

                return formatContent({
                    source: "crypto.com_api_fallback",
                    count: instruments.length,
                    instruments: instruments.slice(0, 50).map((i: any) => ({
                        name: i.instrument_name,
                        type: i.inst_type,
                        baseCurrency: i.base_currency,
                        quoteCurrency: i.quote_currency,
                        priceDecimals: i.price_decimals,
                        quantityDecimals: i.quantity_decimals
                    }))
                });
            } catch (fallbackErr) {
                return errorContent(err instanceof Error ? err.message : 'Failed to fetch instruments from MCP');
            }
        }
    }
);

/**
 * Get recent trades from Crypto.com
 */
server.tool(
    "crypto_com_get_trades",
    {
        instrument: z.string().describe("Trading pair like 'BTC_USDT'"),
        count: z.number().optional().describe("Number of trades to return (default: 50, max: 150)")
    },
    async ({ instrument, count = 50 }) => {
        try {
            // Try MCP first
            const result = await callCryptoComTool('get_trades', {
                instrument_name: instrument,
                count: Math.min(count, 150)
            });

            return formatContent({
                source: "crypto.com_mcp",
                instrument,
                data: result
            });
        } catch (err) {
            // Fallback to direct API
            try {
                const response = await fetch(
                    `https://api.crypto.com/exchange/v1/public/get-trades?instrument_name=${instrument}&count=${Math.min(count, 150)}`
                );
                const json = await response.json();

                if (json.code !== 0) {
                    return errorContent(`Crypto.com API error: ${json.message || 'Unknown error'}`);
                }

                const trades = json.result?.data || [];
                return formatContent({
                    source: "crypto.com_api_fallback",
                    instrument,
                    count: trades.length,
                    trades: trades.map((t: any) => ({
                        tradeId: t.d,
                        price: t.p,
                        quantity: t.q,
                        side: t.s,
                        timestamp: t.t ? new Date(t.t).toISOString() : null
                    }))
                });
            } catch (fallbackErr) {
                return errorContent(err instanceof Error ? err.message : 'Failed to fetch trades');
            }
        }
    }
);

/**
 * Get all tickers from Crypto.com (market overview)
 */
server.tool(
    "crypto_com_get_all_tickers",
    {},
    async () => {
        try {
            // Try MCP first
            const result = await callCryptoComTool('get_all_tickers', {});

            return formatContent({
                source: "crypto.com_mcp",
                data: result
            });
        } catch (err) {
            // Fallback to direct API
            try {
                const response = await fetch(
                    'https://api.crypto.com/exchange/v1/public/get-tickers'
                );
                const json = await response.json();

                if (json.code !== 0) {
                    return errorContent(`Crypto.com API error: ${json.message || 'Unknown error'}`);
                }

                const tickers = json.result?.data || [];
                return formatContent({
                    source: "crypto.com_api_fallback",
                    count: tickers.length,
                    tickers: tickers.slice(0, 100).map((t: any) => ({
                        instrument: t.i,
                        lastPrice: t.a,
                        high24h: t.h,
                        low24h: t.l,
                        volume24h: t.v,
                        priceChange24h: t.c,
                        priceChangePercent24h: t.cp
                    }))
                });
            } catch (fallbackErr) {
                return errorContent(err instanceof Error ? err.message : 'Failed to fetch all tickers');
            }
        }
    }
);

/**
 * Get valuations (funding rates, mark price, index price) from Crypto.com
 */
server.tool(
    "crypto_com_get_valuations",
    {
        instrument: z.string().describe("Perpetual instrument like 'BTCUSD-PERP'"),
        valuationType: z.enum(["funding_rate", "funding_hist", "mark_price", "index_price"]).describe("Type of valuation data")
    },
    async ({ instrument, valuationType }) => {
        try {
            // Try MCP first
            const result = await callCryptoComTool('get_valuations', {
                instrument_name: instrument,
                valuation_type: valuationType
            });

            return formatContent({
                source: "crypto.com_mcp",
                instrument,
                valuationType,
                data: result
            });
        } catch (err) {
            // Fallback to direct API
            try {
                const response = await fetch(
                    `https://api.crypto.com/exchange/v1/public/get-valuations?instrument_name=${instrument}&valuation_type=${valuationType}`
                );
                const json = await response.json();

                if (json.code !== 0) {
                    return errorContent(`Crypto.com API error: ${json.message || 'Unknown error'}`);
                }

                return formatContent({
                    source: "crypto.com_api_fallback",
                    instrument,
                    valuationType,
                    data: json.result?.data || json.result
                });
            } catch (fallbackErr) {
                return errorContent(err instanceof Error ? err.message : 'Failed to fetch valuations');
            }
        }
    }
);

/**
 * Get insurance fund data from Crypto.com
 */
server.tool(
    "crypto_com_get_insurance",
    {
        currency: z.string().optional().describe("Currency like 'USD' (optional)")
    },
    async ({ currency }) => {
        try {
            const params = currency ? `?currency=${currency}` : '';
            const response = await fetch(
                `https://api.crypto.com/exchange/v1/public/get-insurance${params}`
            );
            const json = await response.json();

            if (json.code !== 0) {
                return errorContent(`Crypto.com API error: ${json.message || 'Unknown error'}`);
            }

            return formatContent({
                source: "crypto.com_api",
                currency,
                data: json.result?.data || json.result
            });
        } catch (err) {
            return errorContent(err instanceof Error ? err.message : 'Failed to fetch insurance data');
        }
    }
);

/**
 * Get expired settlement price from Crypto.com
 */
server.tool(
    "crypto_com_get_expired_settlement",
    {
        instrument: z.string().describe("Expired instrument name"),
        type: z.enum(["inverse", "vanilla"]).optional().describe("Contract type")
    },
    async ({ instrument, type }) => {
        try {
            let url = `https://api.crypto.com/exchange/v1/public/get-expired-settlement-price?instrument_name=${instrument}`;
            if (type) url += `&product_type=${type}`;

            const response = await fetch(url);
            const json = await response.json();

            if (json.code !== 0) {
                return errorContent(`Crypto.com API error: ${json.message || 'Unknown error'}`);
            }

            return formatContent({
                source: "crypto.com_api",
                instrument,
                data: json.result?.data || json.result
            });
        } catch (err) {
            return errorContent(err instanceof Error ? err.message : 'Failed to fetch settlement price');
        }
    }
);

// ============================================
// SECTION 2: CRONOS BLOCKCHAIN INTEGRATION
// ============================================
// Native Cronos chain integration using JSON-RPC

/**
 * Get current block number on Cronos
 */
server.tool(
    "cronos_block_number",
    {
        network: z.enum(["mainnet", "testnet", "zkevm-mainnet", "zkevm-testnet"]).optional().describe("Cronos network: mainnet, testnet, zkevm-mainnet, zkevm-testnet (default: testnet)")
    },
    async ({ network = "testnet" }) => {
        try {
            const blockHex = await cronosRpc("eth_blockNumber", [], network);
            const blockNumber = parseInt(blockHex, 16);

            return formatContent({
                network: `cronos_${network}`,
                chainId: config.cronos[network].chainId,
                blockNumber,
                rpcEndpoint: config.cronos[network].rpc
            });
        } catch (err) {
            return errorContent(err instanceof Error ? err.message : 'Failed to get block number');
        }
    }
);

/**
 * Get block details by number
 */
server.tool(
    "cronos_get_block",
    {
        blockNumber: z.number().optional().describe("Block number (latest if not specified)"),
        network: z.enum(["mainnet", "testnet", "zkevm-mainnet", "zkevm-testnet"]).optional().describe("Cronos network: mainnet, testnet, zkevm-mainnet, zkevm-testnet"),
        includeTransactions: z.boolean().optional().describe("Include full transaction details")
    },
    async ({ blockNumber, network = "testnet", includeTransactions = false }) => {
        try {
            const blockTag = blockNumber ? `0x${blockNumber.toString(16)}` : "latest";
            const block = await cronosRpc("eth_getBlockByNumber", [blockTag, includeTransactions], network);

            if (!block) {
                return errorContent(`Block not found`);
            }

            return formatContent({
                network: `cronos_${network}`,
                block: {
                    number: parseInt(block.number, 16),
                    hash: block.hash,
                    parentHash: block.parentHash,
                    timestamp: new Date(parseInt(block.timestamp, 16) * 1000).toISOString(),
                    gasUsed: parseInt(block.gasUsed, 16),
                    gasLimit: parseInt(block.gasLimit, 16),
                    transactionCount: block.transactions?.length || 0,
                    miner: block.miner,
                    ...(includeTransactions && { transactions: block.transactions })
                }
            });
        } catch (err) {
            return errorContent(err instanceof Error ? err.message : 'Failed to get block');
        }
    }
);

/**
 * Get CRO balance for an address
 */
server.tool(
    "cronos_get_balance",
    {
        address: z.string().describe("Wallet address (0x...)"),
        network: z.enum(["mainnet", "testnet", "zkevm-mainnet", "zkevm-testnet"]).optional().describe("Cronos network: mainnet, testnet, zkevm-mainnet, zkevm-testnet")
    },
    async ({ address, network = "testnet" }) => {
        try {
            const balanceHex = await cronosRpc("eth_getBalance", [address, "latest"], network);
            const balanceWei = BigInt(balanceHex);
            const balanceCRO = Number(balanceWei) / 1e18;

            return formatContent({
                network: `cronos_${network}`,
                address,
                balance: {
                    cro: balanceCRO.toFixed(6),
                    wei: balanceWei.toString()
                }
            });
        } catch (err) {
            return errorContent(err instanceof Error ? err.message : 'Failed to get balance');
        }
    }
);

/**
 * Get transaction by hash
 */
server.tool(
    "cronos_get_transaction",
    {
        txHash: z.string().describe("Transaction hash (0x...)"),
        network: z.enum(["mainnet", "testnet", "zkevm-mainnet", "zkevm-testnet"]).optional().describe("Cronos network: mainnet, testnet, zkevm-mainnet, zkevm-testnet")
    },
    async ({ txHash, network = "testnet" }) => {
        try {
            const [tx, receipt] = await Promise.all([
                cronosRpc("eth_getTransactionByHash", [txHash], network),
                cronosRpc("eth_getTransactionReceipt", [txHash], network).catch(() => null)
            ]);

            if (!tx) {
                return errorContent(`Transaction not found`);
            }

            return formatContent({
                network: `cronos_${network}`,
                transaction: {
                    hash: tx.hash,
                    from: tx.from,
                    to: tx.to,
                    value: (Number(BigInt(tx.value || '0x0')) / 1e18).toFixed(6) + ' CRO',
                    gasPrice: (parseInt(tx.gasPrice, 16) / 1e9).toFixed(2) + ' gwei',
                    gas: parseInt(tx.gas, 16),
                    nonce: parseInt(tx.nonce, 16),
                    blockNumber: tx.blockNumber ? parseInt(tx.blockNumber, 16) : null,
                    status: receipt ? (receipt.status === '0x1' ? 'success' : 'failed') : 'pending',
                    gasUsed: receipt ? parseInt(receipt.gasUsed, 16) : null
                }
            });
        } catch (err) {
            return errorContent(err instanceof Error ? err.message : 'Failed to get transaction');
        }
    }
);

/**
 * Get transaction count (nonce) for address
 */
server.tool(
    "cronos_get_nonce",
    {
        address: z.string().describe("Wallet address (0x...)"),
        network: z.enum(["mainnet", "testnet", "zkevm-mainnet", "zkevm-testnet"]).optional().describe("Cronos network: mainnet, testnet, zkevm-mainnet, zkevm-testnet")
    },
    async ({ address, network = "testnet" }) => {
        try {
            const nonceHex = await cronosRpc("eth_getTransactionCount", [address, "latest"], network);

            return formatContent({
                network: `cronos_${network}`,
                address,
                nonce: parseInt(nonceHex, 16)
            });
        } catch (err) {
            return errorContent(err instanceof Error ? err.message : 'Failed to get nonce');
        }
    }
);

/**
 * Get gas price on Cronos
 */
server.tool(
    "cronos_gas_price",
    {
        network: z.enum(["mainnet", "testnet", "zkevm-mainnet", "zkevm-testnet"]).optional().describe("Cronos network: mainnet, testnet, zkevm-mainnet, zkevm-testnet")
    },
    async ({ network = "testnet" }) => {
        try {
            const gasPriceHex = await cronosRpc("eth_gasPrice", [], network);
            const gasPriceWei = parseInt(gasPriceHex, 16);

            return formatContent({
                network: `cronos_${network}`,
                gasPrice: {
                    wei: gasPriceWei,
                    gwei: (gasPriceWei / 1e9).toFixed(4),
                    estimatedTxCost: {
                        simple: ((gasPriceWei * 21000) / 1e18).toFixed(8) + ' CRO',
                        erc20: ((gasPriceWei * 65000) / 1e18).toFixed(8) + ' CRO',
                        swap: ((gasPriceWei * 250000) / 1e18).toFixed(8) + ' CRO'
                    }
                }
            });
        } catch (err) {
            return errorContent(err instanceof Error ? err.message : 'Failed to get gas price');
        }
    }
);

/**
 * Read smart contract (call view function)
 */
server.tool(
    "cronos_call_contract",
    {
        contractAddress: z.string().describe("Contract address (0x...)"),
        data: z.string().describe("Encoded function call data (0x...)"),
        network: z.enum(["mainnet", "testnet", "zkevm-mainnet", "zkevm-testnet"]).optional().describe("Cronos network: mainnet, testnet, zkevm-mainnet, zkevm-testnet")
    },
    async ({ contractAddress, data, network = "testnet" }) => {
        try {
            const result = await cronosRpc("eth_call", [
                { to: contractAddress, data },
                "latest"
            ], network);

            return formatContent({
                network: `cronos_${network}`,
                contractAddress,
                result
            });
        } catch (err) {
            return errorContent(err instanceof Error ? err.message : 'Failed to call contract');
        }
    }
);

/**
 * Get ERC-20 token balance
 */
server.tool(
    "cronos_token_balance",
    {
        tokenAddress: z.string().describe("ERC-20 token contract address"),
        walletAddress: z.string().describe("Wallet address to check"),
        network: z.enum(["mainnet", "testnet", "zkevm-mainnet", "zkevm-testnet"]).optional().describe("Cronos network: mainnet, testnet, zkevm-mainnet, zkevm-testnet")
    },
    async ({ tokenAddress, walletAddress, network = "testnet" }) => {
        try {
            // ERC-20 balanceOf(address) function selector + padded address
            const data = `0x70a08231000000000000000000000000${walletAddress.slice(2).toLowerCase()}`;

            const result = await cronosRpc("eth_call", [
                { to: tokenAddress, data },
                "latest"
            ], network);

            const balance = BigInt(result);

            // Try to get decimals
            let decimals = 18;
            try {
                const decimalsData = '0x313ce567'; // decimals() selector
                const decimalsResult = await cronosRpc("eth_call", [
                    { to: tokenAddress, data: decimalsData },
                    "latest"
                ], network);
                decimals = parseInt(decimalsResult, 16);
            } catch {
                // Use default 18 decimals
            }

            return formatContent({
                network: `cronos_${network}`,
                tokenAddress,
                walletAddress,
                balance: {
                    raw: balance.toString(),
                    formatted: (Number(balance) / Math.pow(10, decimals)).toFixed(decimals > 6 ? 6 : decimals)
                },
                decimals
            });
        } catch (err) {
            return errorContent(err instanceof Error ? err.message : 'Failed to get token balance');
        }
    }
);

/**
 * Get contract logs/events
 */
server.tool(
    "cronos_get_logs",
    {
        contractAddress: z.string().describe("Contract address to filter logs"),
        fromBlock: z.number().optional().describe("Start block (default: latest - 1000)"),
        toBlock: z.number().optional().describe("End block (default: latest)"),
        topics: z.array(z.string()).optional().describe("Event topics to filter"),
        network: z.enum(["mainnet", "testnet", "zkevm-mainnet", "zkevm-testnet"]).optional().describe("Cronos network: mainnet, testnet, zkevm-mainnet, zkevm-testnet")
    },
    async ({ contractAddress, fromBlock, toBlock, topics, network = "testnet" }) => {
        try {
            // Get latest block if not specified
            if (!toBlock) {
                const latestHex = await cronosRpc("eth_blockNumber", [], network);
                toBlock = parseInt(latestHex, 16);
            }
            if (!fromBlock) {
                fromBlock = Math.max(0, toBlock - 1000);
            }

            const logs = await cronosRpc("eth_getLogs", [{
                address: contractAddress,
                fromBlock: `0x${fromBlock.toString(16)}`,
                toBlock: `0x${toBlock.toString(16)}`,
                ...(topics && { topics })
            }], network);

            return formatContent({
                network: `cronos_${network}`,
                contractAddress,
                blockRange: { from: fromBlock, to: toBlock },
                logCount: logs.length,
                logs: logs.slice(0, 20).map((log: any) => ({
                    blockNumber: parseInt(log.blockNumber, 16),
                    transactionHash: log.transactionHash,
                    topics: log.topics,
                    data: log.data.slice(0, 66) + (log.data.length > 66 ? '...' : '')
                }))
            });
        } catch (err) {
            return errorContent(err instanceof Error ? err.message : 'Failed to get logs');
        }
    }
);

// ============================================
// SECTION 3: RELAY CORE SERVICES
// ============================================

/**
 * Get aggregated crypto prices from Relay Core
 */
server.tool(
    "relay_get_prices",
    {
        symbols: z.array(z.string()).describe("Trading pairs like ['BTC/USD', 'ETH/USD', 'CRO/USD']")
    },
    async ({ symbols }) => {
        try {
            const response = await fetch(`${config.relayCoreApi}/graphql`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: `
            query GetPrices($symbols: [String!]!) {
              prices(symbols: $symbols) {
                symbol
                price
                bestSource
                sources {
                  name
                  price
                  latencyMs
                }
                timestamp
              }
            }
          `,
                    variables: { symbols }
                })
            });

            const json = await response.json();

            if (json.errors || !json.data) {
                // Fallback to Pyth
                const pythPrices = await fetchPythPrices(symbols);
                return formatContent({
                    source: "pyth_fallback",
                    prices: pythPrices
                });
            }

            return formatContent({
                source: "relay_core_aggregator",
                prices: json.data.prices
            });
        } catch (err) {
            return errorContent(err instanceof Error ? err.message : 'Failed to get prices');
        }
    }
);

/**
 * Discover services on Relay Core marketplace
 */
server.tool(
    "relay_discover_services",
    {
        category: z.string().optional().describe("Filter: oracle, kyc, data, compute, storage, dex"),
        minReputation: z.number().optional().describe("Minimum reputation score (0-100)"),
        limit: z.number().optional().describe("Max results (default: 20)")
    },
    async ({ category, minReputation, limit = 20 }) => {
        try {
            const params = new URLSearchParams();
            if (category) params.set('category', category);
            if (minReputation) params.set('min_reputation', minReputation.toString());
            params.set('limit', limit.toString());

            const response = await fetch(`${config.relayCoreApi}/api/services?${params}`);
            const json = await response.json();

            return formatContent({
                total: json.services?.length || 0,
                services: json.services?.map((s: any) => ({
                    id: s.id,
                    name: s.name,
                    category: s.category,
                    reputation: s.reputation_score,
                    description: s.description,
                    pricing: s.pricing,
                    isActive: s.is_active
                })) || []
            });
        } catch (err) {
            return errorContent(err instanceof Error ? err.message : 'Failed to discover services');
        }
    }
);

/**
 * Get trade quote from PerpAI (x402 enabled)
 */
server.tool(
    "relay_get_quote",
    {
        pair: z.string().describe("Trading pair: BTC-USD, ETH-USD, CRO-USD"),
        side: z.enum(["long", "short"]).describe("Trade direction"),
        leverage: z.number().min(1).max(50).describe("Leverage (1-50x)"),
        sizeUsd: z.number().min(100).describe("Position size in USD")
    },
    async ({ pair, side, leverage, sizeUsd }) => {
        try {
            const response = await fetch(`${config.relayCoreApi}/api/perpai/quote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pair, side, leverage, sizeUsd })
            });

            if (response.status === 402) {
                const requirements = await response.json();
                return formatContent({
                    status: "payment_required",
                    x402: {
                        amount: requirements.amount,
                        amountFormatted: `${(parseInt(requirements.amount) / 1e6).toFixed(2)} USDC`,
                        token: "USDC",
                        recipient: requirements.recipient,
                        network: "cronos_testnet",
                        chainId: 338,
                        resource: "/api/perpai/quote",
                        instruction: "Complete x402 payment to get trade quote"
                    }
                });
            }

            const json = await response.json();
            return formatContent({
                status: "quote_ready",
                quote: {
                    pair,
                    side,
                    leverage,
                    sizeUsd,
                    venue: json.quote?.bestVenue?.name,
                    venueReputation: json.quote?.bestVenue?.reputationScore,
                    entryPrice: json.quote?.expectedPrice,
                    liquidationPrice: json.quote?.liquidationPrice,
                    fees: json.quote?.totalFees,
                    slippage: json.quote?.expectedSlippage,
                    expiresIn: "60s"
                }
            });
        } catch (err) {
            return errorContent(err instanceof Error ? err.message : 'Failed to get quote');
        }
    }
);

/**
 * Get venue rankings
 */
server.tool(
    "relay_venue_rankings",
    {
        sortBy: z.enum(["reputation", "volume", "latency"]).optional().describe("Sort by metric"),
        limit: z.number().optional().describe("Number of venues to return")
    },
    async ({ sortBy = "reputation", limit = 10 }) => {
        try {
            const response = await fetch(`${config.relayCoreApi}/api/perpai/venues`);
            const json = await response.json();

            const venues = json.venues || [];

            venues.sort((a: any, b: any) => {
                switch (sortBy) {
                    case "reputation": return (b.reputation_score || 0) - (a.reputation_score || 0);
                    case "volume": return (b.total_volume || 0) - (a.total_volume || 0);
                    case "latency": return (a.avg_latency_ms || 999) - (b.avg_latency_ms || 999);
                    default: return 0;
                }
            });

            return formatContent({
                sortedBy: sortBy,
                venues: venues.slice(0, limit).map((v: any, i: number) => ({
                    rank: i + 1,
                    name: v.name,
                    chain: v.chain,
                    reputation: v.reputation_score,
                    successRate: v.success_rate,
                    maxLeverage: v.max_leverage,
                    tradingFeeBps: v.trading_fee_bps
                }))
            });
        } catch (err) {
            return errorContent(err instanceof Error ? err.message : 'Failed to get venues');
        }
    }
);

/**
 * Get funding rates across venues
 */
server.tool(
    "relay_funding_rates",
    {
        venue: z.string().optional().describe("Filter by venue name"),
        token: z.string().optional().describe("Filter by token symbol")
    },
    async ({ venue, token }) => {
        try {
            const params = new URLSearchParams();
            if (venue) params.set('venue', venue);
            if (token) params.set('token', token);

            const response = await fetch(`${config.relayCoreApi}/api/perpai/funding-rates?${params}`);
            const json = await response.json();

            return formatContent({
                fundingRates: json.fundingRates,
                timestamp: json.timestamp
            });
        } catch (err) {
            return errorContent(err instanceof Error ? err.message : 'Failed to get funding rates');
        }
    }
);

/**
 * Get reputation for entity
 */
server.tool(
    "relay_get_reputation",
    {
        entityType: z.enum(["service", "agent", "venue"]).describe("Entity type"),
        entityId: z.string().describe("Entity ID")
    },
    async ({ entityType, entityId }) => {
        try {
            const response = await fetch(`${config.relayCoreApi}/api/reputation/${entityType}/${entityId}`);
            const json = await response.json();

            return formatContent({
                entityType,
                entityId,
                reputation: {
                    score: json.reputation_score,
                    totalPayments: json.total_payments,
                    successfulPayments: json.successful_payments,
                    successRate: json.success_rate,
                    avgLatencyMs: json.avg_latency_ms,
                    lastUpdated: json.updated_at
                }
            });
        } catch (err) {
            return errorContent(err instanceof Error ? err.message : 'Failed to get reputation');
        }
    }
);

/**
 * Get x402 payment info for a resource
 */
server.tool(
    "relay_x402_info",
    {
        resource: z.string().describe("Resource path like /api/perpai/quote")
    },
    async ({ resource }) => {
        try {
            const response = await fetch(`${config.relayCoreApi}${resource}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });

            if (response.status !== 402) {
                return formatContent({
                    resource,
                    paymentRequired: false,
                    message: "This resource does not require payment or check completed"
                });
            }

            const requirements = await response.json();
            return formatContent({
                resource,
                paymentRequired: true,
                x402: {
                    amount: requirements.amount,
                    amountFormatted: requirements.amount ? `${(parseInt(requirements.amount) / 1e6).toFixed(2)} USDC` : 'unknown',
                    token: requirements.token || "USDC",
                    tokenAddress: requirements.tokenAddress,
                    recipient: requirements.recipient,
                    network: requirements.network || "cronos_testnet",
                    chainId: requirements.chainId || 338,
                    validUntil: requirements.validUntil
                }
            });
        } catch (err) {
            return errorContent(err instanceof Error ? err.message : 'Failed to get x402 info');
        }
    }
);

/**
 * Invoke agent (x402 enabled)
 */
server.tool(
    "relay_invoke_agent",
    {
        agentId: z.string().describe("Agent ID like 'relaycore.perp-ai'"),
        input: z.record(z.unknown()).describe("Agent input parameters"),
        sessionId: z.string().optional().describe("Session ID for session-based payment"),
        paymentId: z.string().optional().describe("Payment ID if x402 was completed")
    },
    async ({ agentId, input, sessionId, paymentId }) => {
        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (sessionId) headers['X-Session-Id'] = sessionId;
            if (paymentId) headers['X-Payment-Id'] = paymentId;

            const response = await fetch(`${config.relayCoreApi}/api/agents/${agentId}/invoke`, {
                method: 'POST',
                headers,
                body: JSON.stringify(input)
            });

            if (response.status === 402) {
                const requirements = await response.json();
                return formatContent({
                    status: "payment_required",
                    agentId,
                    x402: {
                        amount: requirements.amount,
                        token: "USDC",
                        recipient: requirements.recipient,
                        network: "cronos_testnet",
                        resource: `/api/agents/${agentId}/invoke`
                    }
                });
            }

            const json = await response.json();
            return formatContent({
                status: "success",
                agentId,
                result: json.result,
                executionTimeMs: json.executionTimeMs
            });
        } catch (err) {
            return errorContent(err instanceof Error ? err.message : 'Failed to invoke agent');
        }
    }
);

// ============================================
// SECTION 4: AI ANALYSIS (CLAUDE-POWERED)
// ============================================

/**
 * AI-powered analysis using Claude
 */
server.tool(
    "ai_analyze",
    {
        query: z.string().describe("Analysis question or request"),
        context: z.string().optional().describe("Additional context or data")
    },
    async ({ query, context }) => {
        if (!config.claudeApiKey) {
            return errorContent("Claude API key not configured. Set CLAUDE_API_KEY in .env");
        }

        try {
            // Gather context from Relay Core
            let marketContext = '';
            try {
                const pricesRes = await fetch(`${config.relayCoreApi}/graphql`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        query: `query { prices(symbols: ["BTC/USD", "ETH/USD", "CRO/USD"]) { symbol price } }`
                    })
                });
                const pricesData = await pricesRes.json();
                if (pricesData.data?.prices) {
                    marketContext = `Current prices: ${JSON.stringify(pricesData.data.prices)}`;
                }
            } catch {
                // Continue without market context
            }

            const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': config.claudeApiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-5-sonnet-20241022',
                    max_tokens: 1024,
                    messages: [{
                        role: 'user',
                        content: `You are a Relay Core DeFi assistant. Answer questions about:
- Crypto prices and market data
- Cronos blockchain
- Trading venues and reputation
- x402 payments

${marketContext}
${context ? `\nAdditional context: ${context}` : ''}

User query: ${query}

Provide a concise, accurate response. Suggest MCP tools if more data is needed.`
                    }]
                })
            });

            const claudeJson = await claudeResponse.json();

            return {
                content: [{
                    type: "text",
                    text: claudeJson.content?.[0]?.text || "Unable to generate analysis"
                }]
            };
        } catch (err) {
            return errorContent(err instanceof Error ? err.message : 'Failed to analyze');
        }
    }
);

// ============================================
// HELPER: Pyth Price Fallback
// ============================================

async function fetchPythPrices(symbols: string[]): Promise<any[]> {
    const priceIds: Record<string, string> = {
        'BTC/USD': 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
        'ETH/USD': 'ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
        'CRO/USD': '23199c2bcb1303f667e733b9934db9eca5991e765b45f5ed18bc4b231415f2fe'
    };

    const ids = symbols.filter(s => priceIds[s]).map(s => priceIds[s]);
    if (ids.length === 0) return [];

    try {
        const response = await fetch(`${config.pyth}/api/latest_price_feeds?ids[]=${ids.join('&ids[]=')}`);
        const json = await response.json();

        return json.map((feed: any) => {
            const symbol = Object.entries(priceIds).find(([, id]) => id === feed.id)?.[0] || 'UNKNOWN';
            const price = parseFloat(feed.price.price) * Math.pow(10, feed.price.expo);
            return { symbol, price, source: 'pyth' };
        });
    } catch {
        return [];
    }
}

// ============================================
// SECTION: ON-CHAIN REGISTRY TOOLS
// ============================================
// Direct integration with deployed ERC-8004 contracts

const CONTRACTS = {
    identityRegistry: process.env.IDENTITY_REGISTRY_ADDRESS || '0x4b697D8ABC0e3dA0086011222755d9029DBB9C43',
    reputationRegistry: process.env.REPUTATION_REGISTRY_ADDRESS || '0xdaFC2fA590C5Ba88155a009660dC3b14A3651a67',
    validationRegistry: process.env.VALIDATION_REGISTRY_ADDRESS || '0x0483d030a1B1dA819dA08e2b73b01eFD28c67322'
};

// ERC-721 token URI ABI fragment
const IDENTITY_ABI = [
    "function totalAgents() view returns (uint256)",
    "function isAgentActive(uint256 agentId) view returns (bool)",
    "function tokenURI(uint256 agentId) view returns (string)",
    "function agentWalletAddress(uint256 agentId) view returns (address)",
    "function ownerOf(uint256 agentId) view returns (address)"
];

const REPUTATION_ABI = [
    "function getAverageScore(uint256 agentId) view returns (uint8)",
    "function getTotalFeedbackCount(uint256 agentId) view returns (uint256)",
    "function getTagAverageScore(uint256 agentId, string tag) view returns (uint8)"
];

/**
 * Get agent details from IdentityRegistry
 */
server.tool(
    "relay_get_agent",
    {
        agentId: z.number().describe("Agent token ID from IdentityRegistry"),
        network: z.enum(["mainnet", "testnet", "zkevm-mainnet", "zkevm-testnet"]).optional().describe("Cronos network: mainnet, testnet, zkevm-mainnet, zkevm-testnet")
    },
    async ({ agentId, network = "testnet" }) => {
        try {
            const rpc = config.cronos[network].rpc;

            // Call contract methods via RPC
            const isActive = await cronosRpc(
                "eth_call",
                [{
                    to: CONTRACTS.identityRegistry,
                    data: `0x51a88f07${agentId.toString(16).padStart(64, '0')}` // isAgentActive(uint256)
                }, "latest"],
                network
            );

            const owner = await cronosRpc(
                "eth_call",
                [{
                    to: CONTRACTS.identityRegistry,
                    data: `0x6352211e${agentId.toString(16).padStart(64, '0')}` // ownerOf(uint256)
                }, "latest"],
                network
            );

            return formatContent({
                agentId,
                isActive: isActive !== '0x0000000000000000000000000000000000000000000000000000000000000000',
                owner: owner ? '0x' + owner.slice(-40) : null,
                contract: CONTRACTS.identityRegistry,
                network,
                chainId: config.cronos[network].chainId
            });
        } catch (err) {
            return errorContent(err instanceof Error ? err.message : 'Failed to get agent');
        }
    }
);

/**
 * Get agent reputation from ReputationRegistry
 */
server.tool(
    "relay_get_agent_reputation",
    {
        agentId: z.number().describe("Agent token ID from IdentityRegistry"),
        tag: z.string().optional().describe("Optional tag to filter reputation (e.g., 'trade', 'oracle')"),
        network: z.enum(["mainnet", "testnet", "zkevm-mainnet", "zkevm-testnet"]).optional().describe("Cronos network: mainnet, testnet, zkevm-mainnet, zkevm-testnet")
    },
    async ({ agentId, tag, network = "testnet" }) => {
        try {
            // Get average score
            const avgScore = await cronosRpc(
                "eth_call",
                [{
                    to: CONTRACTS.reputationRegistry,
                    data: `0x7b3c71d3${agentId.toString(16).padStart(64, '0')}` // getAverageScore(uint256)
                }, "latest"],
                network
            );

            // Get feedback count
            const feedbackCount = await cronosRpc(
                "eth_call",
                [{
                    to: CONTRACTS.reputationRegistry,
                    data: `0x4f3c9e1a${agentId.toString(16).padStart(64, '0')}` // getTotalFeedbackCount(uint256)
                }, "latest"],
                network
            );

            return formatContent({
                agentId,
                averageScore: parseInt(avgScore, 16),
                totalFeedback: parseInt(feedbackCount, 16),
                tag: tag || null,
                contract: CONTRACTS.reputationRegistry,
                network
            });
        } catch (err) {
            return errorContent(err instanceof Error ? err.message : 'Failed to get reputation');
        }
    }
);

/**
 * Get total registered agents count
 */
server.tool(
    "relay_total_agents",
    {
        network: z.enum(["mainnet", "testnet", "zkevm-mainnet", "zkevm-testnet"]).optional().describe("Cronos network: mainnet, testnet, zkevm-mainnet, zkevm-testnet")
    },
    async ({ network = "testnet" }) => {
        try {
            const total = await cronosRpc(
                "eth_call",
                [{
                    to: CONTRACTS.identityRegistry,
                    data: "0x39a0c6f9" // totalAgents()
                }, "latest"],
                network
            );

            return formatContent({
                totalAgents: parseInt(total, 16),
                contract: CONTRACTS.identityRegistry,
                network,
                chainId: config.cronos[network].chainId
            });
        } catch (err) {
            return errorContent(err instanceof Error ? err.message : 'Failed to get total agents');
        }
    }
);

/**
 * Get deployed contract addresses
 */
server.tool(
    "relay_contracts",
    {},
    async () => {
        return formatContent({
            identityRegistry: CONTRACTS.identityRegistry,
            reputationRegistry: CONTRACTS.reputationRegistry,
            validationRegistry: CONTRACTS.validationRegistry,
            network: "cronos_testnet",
            chainId: 338,
            explorer: "https://explorer.cronos.org/testnet"
        });
    }
);

// INDEXER DATA TOOLS
// Expose data from the indexer suite for agents and analytics

/**
 * Get payment statistics for an address
 */
server.tool(
    "relay_indexer_payment_stats",
    {
        address: z.string().describe("Wallet address to get payment stats for")
    },
    async ({ address }) => {
        try {
            const response = await fetch(`${config.relayCoreApi}/api/payments/stats?address=${address}`);
            if (!response.ok) {
                // Fallback to direct query pattern
                return formatContent({
                    address,
                    totalReceived: 0,
                    totalSent: 0,
                    successCount: 0,
                    failCount: 0,
                    note: "Real data available when indexer is running"
                });
            }
            const data = await response.json();
            return formatContent({
                address,
                ...data
            });
        } catch (err) {
            return errorContent(err instanceof Error ? err.message : 'Failed to get payment stats');
        }
    }
);

/**
 * Get indexed agents list
 */
server.tool(
    "relay_indexer_agents",
    {
        limit: z.number().optional().describe("Max number of agents to return (default: 20)"),
        activeOnly: z.boolean().optional().describe("Only return active agents (default: true)")
    },
    async ({ limit = 20, activeOnly = true }) => {
        try {
            const response = await fetch(
                `${config.relayCoreApi}/api/agents?limit=${limit}&active=${activeOnly}`
            );
            if (!response.ok) {
                return formatContent({
                    agents: [],
                    count: 0,
                    note: "Real data available when API is running"
                });
            }
            const data = await response.json();
            return formatContent({
                agents: data.agents || data,
                count: data.count || (data.agents?.length || 0)
            });
        } catch (err) {
            return errorContent(err instanceof Error ? err.message : 'Failed to list agents');
        }
    }
);

/**
 * Get agent reputation from indexed data
 */
server.tool(
    "relay_indexer_reputation",
    {
        address: z.string().describe("Agent wallet address")
    },
    async ({ address }) => {
        try {
            const response = await fetch(`${config.relayCoreApi}/api/reputation/${address}`);
            if (!response.ok) {
                return formatContent({
                    address,
                    score: 0,
                    successRate: 0,
                    transactionCount: 0,
                    lastCalculated: null,
                    note: "Real data available when indexer is running"
                });
            }
            const data = await response.json();
            return formatContent({
                address,
                score: data.reputation_score || data.score || 0,
                successRate: data.success_rate || 0,
                successfulTx: data.successful_transactions || 0,
                failedTx: data.failed_transactions || 0,
                feedbackCount: data.feedback_count || 0,
                lastCalculated: data.last_calculated
            });
        } catch (err) {
            return errorContent(err instanceof Error ? err.message : 'Failed to get reputation');
        }
    }
);

/**
 * Get indexer status and health
 */
server.tool(
    "relay_indexer_status",
    {},
    async () => {
        try {
            const response = await fetch(`${config.relayCoreApi}/api/indexer/status`);
            if (!response.ok) {
                return formatContent({
                    status: "unknown",
                    indexers: [
                        { name: "payment", schedule: "every 5 minutes", status: "scheduled" },
                        { name: "agent", schedule: "every 15 minutes", status: "scheduled" },
                        { name: "feedback", schedule: "every 15 minutes", status: "scheduled" },
                        { name: "reputation", schedule: "daily at 1:00 AM", status: "scheduled" }
                    ],
                    note: "Indexer status API not available"
                });
            }
            const data = await response.json();
            return formatContent(data);
        } catch (err) {
            return formatContent({
                status: "offline",
                indexers: [
                    { name: "payment", schedule: "every 5 minutes" },
                    { name: "agent", schedule: "every 15 minutes" },
                    { name: "feedback", schedule: "every 15 minutes" },
                    { name: "reputation", schedule: "daily at 1:00 AM" }
                ],
                note: "Start indexers with: pnpm dev:indexers"
            });
        }
    }
);

/**
 * Get recent payments from indexed data
 */
server.tool(
    "relay_indexer_payments",
    {
        limit: z.number().optional().describe("Number of recent payments (default: 10)"),
        address: z.string().optional().describe("Filter by payer or receiver address")
    },
    async ({ limit = 10, address }) => {
        try {
            let url = `${config.relayCoreApi}/api/payments?limit=${limit}`;
            if (address) {
                url += `&address=${address}`;
            }
            const response = await fetch(url);
            if (!response.ok) {
                return formatContent({
                    payments: [],
                    count: 0,
                    note: "Payment data available when API is running"
                });
            }
            const data = await response.json();
            return formatContent({
                payments: (data.payments || data).map((p: any) => ({
                    id: p.payment_id || p.id,
                    from: p.from_address,
                    to: p.to_address,
                    amount: p.amount,
                    status: p.status,
                    block: p.block_number,
                    timestamp: p.created_at
                })),
                count: data.count || (data.payments?.length || data.length || 0)
            });
        } catch (err) {
            return errorContent(err instanceof Error ? err.message : 'Failed to get payments');
        }
    }
);

/**
 * Get feedback events for an agent
 */
server.tool(
    "relay_indexer_feedback",
    {
        address: z.string().describe("Agent address to get feedback for"),
        limit: z.number().optional().describe("Max feedback events (default: 20)")
    },
    async ({ address, limit = 20 }) => {
        try {
            const response = await fetch(
                `${config.relayCoreApi}/api/feedback?address=${address}&limit=${limit}`
            );
            if (!response.ok) {
                return formatContent({
                    address,
                    feedback: [],
                    count: 0,
                    averageScore: 0,
                    note: "Feedback data available when API is running"
                });
            }
            const data = await response.json();
            const feedback = data.feedback || data;
            const avgScore = feedback.length > 0
                ? feedback.reduce((sum: number, f: any) => sum + (f.score || 0), 0) / feedback.length
                : 0;
            return formatContent({
                address,
                feedback: feedback.map((f: any) => ({
                    from: f.submitter_address,
                    tag: f.tag,
                    score: f.score,
                    comment: f.comment,
                    block: f.block_number,
                    timestamp: f.created_at
                })),
                count: feedback.length,
                averageScore: Math.round(avgScore * 10) / 10
            });
        } catch (err) {
            return errorContent(err instanceof Error ? err.message : 'Failed to get feedback');
        }
    }
);

// ACPS: AGENT-CONTROLLED PAYMENT SESSIONS
// Session-based x402 payment abstraction for autonomous agent execution

/**
 * Get Escrow Agent info and capabilities
 */
server.tool(
    "relay_escrow_agent",
    {},
    async () => {
        const escrowAddress = process.env.ESCROW_CONTRACT_ADDRESS;
        return formatContent({
            name: "Escrow Agent",
            serviceType: "escrow",
            description: "Agent-Controlled Payment Sessions for autonomous agent execution",
            capabilities: [
                "session_create",
                "session_deposit",
                "session_release",
                "session_refund",
                "session_close",
                "agent_authorization"
            ],
            contractAddress: escrowAddress || "not_deployed",
            network: "cronos_testnet",
            supportedAssets: ["USDC"],
            pricePerRequest: "0",
            status: escrowAddress ? "active" : "pending_deployment",
            tools: [
                "relay_session_create",
                "relay_session_status",
                "relay_session_can_execute",
                "relay_session_release",
                "relay_session_refund",
                "relay_session_close"
            ]
        });
    }
);

/**
 * Create a new payment session with x402 deposit
 * User pays Relay upfront, Relay manages budget and pays agents
 */
server.tool(
    "relay_session_create",
    {
        maxSpend: z.string().describe("Maximum USDC budget for session (e.g., '10.00')"),
        durationHours: z.number().optional().describe("Session duration in hours (default: 24)")
    },
    async ({ maxSpend, durationHours = 24 }) => {
        return executeWithArtifact(
            'relay_session_create',
            { maxSpend, durationHours },
            async () => {
                if (!wallet) {
                    throw new Error("Wallet not configured. Set WALLET_PRIVATE_KEY in .env");
                }

                // Create session via API (off-chain, no gas)
                const response = await fetch(`${config.relayCoreApi}/api/sessions/create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ownerAddress: wallet.address,
                        maxSpend,
                        durationHours
                    })
                });

                if (!response.ok) {
                    const error = await response.text();
                    throw new Error(`Failed to create session: ${error}`);
                }

                const result = await response.json();
                const { session, paymentRequest } = result;

                return formatContent({
                    success: true,
                    sessionId: session.session_id,
                    status: session.status,
                    owner: session.owner_address,
                    maxSpend: session.max_spend,
                    durationHours,
                    expiresAt: session.expires_at,
                    paymentRequired: {
                        amount: paymentRequest.amount,
                        payTo: paymentRequest.payTo,
                        asset: paymentRequest.asset,
                        purpose: paymentRequest.purpose
                    },
                    nextSteps: [
                        `Session created but requires payment to activate`,
                        `Pay ${paymentRequest.amount} USDC to ${paymentRequest.payTo} via x402`,
                        `Use: x402_pay with amount ${paymentRequest.amount}`,
                        `Then activate with: relay_session_activate ${session.session_id} <txHash>`
                    ]
                })
            }
        );
    }
);

/**
 * Activate session after x402 payment
 */
server.tool(
    "relay_session_activate",
    {
        sessionId: z.number().describe("Session ID to activate"),
        txHash: z.string().describe("Transaction hash of x402 payment to Relay"),
        amount: z.string().describe("Amount paid (must match session maxSpend)")
    },
    async ({ sessionId, txHash, amount }) => {
        return executeWithArtifact(
            'relay_session_activate',
            { sessionId, txHash, amount },
            async () => {
                const response = await fetch(`${config.relayCoreApi}/api/sessions/${sessionId}/activate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ txHash, amount })
                });

                if (!response.ok) {
                    const error = await response.text();
                    throw new Error(`Failed to activate session: ${error}`);
                }

                const session = await response.json();

                return formatContent({
                    success: true,
                    sessionId: session.session_id,
                    status: session.status,
                    deposited: session.deposited,
                    maxSpend: session.max_spend,
                    spent: session.spent || '0',
                    remaining: (parseFloat(session.max_spend) - parseFloat(session.spent || '0')).toFixed(6),
                    expiresAt: session.expires_at,
                    depositTxHash: session.deposit_tx_hash,
                    message: `Session ${sessionId} activated! You can now hire agents.`
                });
            }
        );
    }
);

/**
 * Get session status and spending details
 */
server.tool(
    "relay_session_status",
    {
        sessionId: z.number().describe("Session ID to check")
    },
    async ({ sessionId }) => {
        try {
            const response = await fetch(`${config.relayCoreApi}/api/sessions/${sessionId}`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                return formatContent({
                    sessionId,
                    status: "not_found",
                    message: errorData.message || errorData.error || "Session not found"
                });
            }

            const data = await response.json();
            // API returns { session: {...} } wrapper
            const session = data.session || data;

            const deposited = parseFloat(session.deposited || '0');
            const released = parseFloat(session.released || '0');
            const maxSpend = parseFloat(session.maxSpend || session.max_spend || '0');
            const remaining = deposited - released;

            return formatContent({
                sessionId: session.session_id,
                status: session.isActive ? 'active' : 'inactive',
                owner: session.owner || session.owner_address,
                deposited: session.deposited || '0',
                maxSpend: session.maxSpend || session.max_spend || '0',
                spent: released.toFixed(6),
                remaining: remaining.toFixed(6),
                expiresAt: session.expiresAt || session.expiry,
                active: session.isActive,
                utilizationPercent: deposited > 0 ? ((released / deposited) * 100).toFixed(2) : '0'
            });
        } catch (err) {
            return errorContent(err instanceof Error ? err.message : 'Failed to get session status');
        }
    }
);

/**
 * Check if agent can execute with payment
 */
server.tool(
    "relay_session_can_execute",
    {
        sessionId: z.number().describe("Session ID"),
        agentAddress: z.string().describe("Agent address to check"),
        amount: z.string().describe("Amount to spend (USDC)")
    },
    async ({ sessionId, agentAddress, amount }) => {
        try {
            const response = await fetch(
                `${config.relayCoreApi}/api/sessions/${sessionId}/check?agent=${agentAddress}&amount=${amount}`
            );
            if (!response.ok) {
                return formatContent({
                    sessionId,
                    agentAddress,
                    amount,
                    canExecute: false,
                    reason: "Session check API not available"
                });
            }
            const data = await response.json();
            return formatContent({
                sessionId,
                agentAddress,
                amount,
                canExecute: data.allowed,
                reason: data.reason || null,
                remainingBalance: data.remaining
            });
        } catch (err) {
            return errorContent(err instanceof Error ? err.message : 'Failed to check execution');
        }
    }
);

/**
 * Release payment to agent (after successful execution)
 */
server.tool(
    "relay_session_release",
    {
        sessionId: z.number().describe("Session ID"),
        agentAddress: z.string().describe("Agent receiving payment"),
        amount: z.string().describe("Amount to release (USDC)"),
        executionId: z.string().describe("Unique execution ID for tracing")
    },
    async ({ sessionId, agentAddress, amount, executionId }) => {
        try {
            const response = await fetch(`${config.relayCoreApi}/api/sessions/${sessionId}/release`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agent: agentAddress, amount, executionId })
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                return formatContent({
                    success: false,
                    sessionId,
                    executionId,
                    error: error.message || 'Release failed'
                });
            }

            const data = await response.json();
            return formatContent({
                success: true,
                sessionId,
                executionId,
                amount,
                agentAddress,
                txHash: data.txHash,
                explorer: `https://explorer.cronos.org/testnet/tx/${data.txHash}`
            });
        } catch (err) {
            return errorContent(err instanceof Error ? err.message : 'Failed to release payment');
        }
    }
);

/**
 * Refund remaining session balance
 */
server.tool(
    "relay_session_refund",
    {
        sessionId: z.number().describe("Session ID to refund")
    },
    async ({ sessionId }) => {
        try {
            const response = await fetch(`${config.relayCoreApi}/api/sessions/${sessionId}/refund`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                return formatContent({
                    success: false,
                    sessionId,
                    error: errorData.message || errorData.error || 'Refund failed',
                    hint: 'Ensure the session exists and has remaining balance'
                });
            }

            const data = await response.json();
            return formatContent({
                success: true,
                sessionId,
                refundedAmount: data.refundAmount || data.amount,
                txHash: data.txHash,
                explorer: data.txHash ? `https://explorer.cronos.org/testnet/tx/${data.txHash}` : 'N/A'
            });
        } catch (err) {
            return errorContent(err instanceof Error ? err.message : 'Failed to refund session');
        }
    }
);

/**
 * Close session (refunds remaining and deactivates)
 */
server.tool(
    "relay_session_close",
    {
        sessionId: z.number().describe("Session ID to close")
    },
    async ({ sessionId }) => {
        try {
            const response = await fetch(`${config.relayCoreApi}/api/sessions/${sessionId}/close`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                return formatContent({
                    success: false,
                    sessionId,
                    error: errorData.message || errorData.error || 'Close failed',
                    hint: 'Ensure the session exists and is not already closed'
                });
            }

            const data = await response.json();
            return formatContent({
                success: true,
                sessionId: data.session_id || sessionId,
                refundedAmount: data.refunded || data.refundAmount,
                txHash: data.txHash,
                status: data.status || "closed",
                explorer: data.txHash ? `https://explorer.cronos.org/testnet/tx/${data.txHash}` : 'N/A'
            });
        } catch (err) {
            return errorContent(err instanceof Error ? err.message : 'Failed to close session');
        }
    }
);

// RWA SETTLEMENT: Real-world service verification and settlement

/**
 * List available RWA services
 */
server.tool(
    "relay_rwa_services",
    {
        serviceType: z.string().optional().describe("Filter by service type")
    },
    async ({ serviceType }) => {
        const rwaTypes = [
            "compliance_check", "market_report", "trade_confirmation",
            "settlement_reconciliation", "price_verification", "kyc_verification",
            "execution_proof", "data_attestation"
        ];

        return formatContent({
            description: "RWA Settlement: Real-world service verification with SLA-backed escrow",
            serviceTypes: rwaTypes,
            filter: serviceType || "all",
            note: "Use relay_rwa_register to add a new RWA service"
        });
    }
);

/**
 * Register an RWA service with SLA terms
 */
server.tool(
    "relay_rwa_register",
    {
        name: z.string().describe("Service name"),
        serviceType: z.string().describe("Type: compliance_check, market_report, etc"),
        provider: z.string().describe("Provider wallet address"),
        endpoint: z.string().describe("Service endpoint URL"),
        pricePerCall: z.string().describe("Price per call in USDC"),
        maxLatencyMs: z.number().describe("Maximum acceptable latency in ms")
    },
    async ({ name, serviceType, provider, endpoint, pricePerCall, maxLatencyMs }) => {
        const serviceId = `rwa_${serviceType}_${Date.now()}`;

        return formatContent({
            serviceId,
            name,
            serviceType,
            provider,
            endpoint,
            pricePerCall,
            sla: {
                maxLatencyMs,
                proofFormat: "signed",
                refundConditions: ["SLA not met", "Proof invalid", "Timeout"]
            },
            category: "rwa.settlement",
            status: "registered"
        });
    }
);

/**
 * Request RWA execution with escrow-backed payment
 */
server.tool(
    "relay_rwa_execute",
    {
        serviceId: z.string().describe("RWA service ID"),
        sessionId: z.number().describe("Escrow session ID for payment"),
        input: z.record(z.unknown()).optional().describe("Input parameters")
    },
    async ({ serviceId, sessionId, input }) => {
        const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        return formatContent({
            requestId,
            serviceId,
            sessionId,
            status: "pending",
            input: input || {},
            nextStep: "Provider submits proof, then call relay_rwa_settle"
        });
    }
);

/**
 * Settle RWA execution based on proof verification
 */
server.tool(
    "relay_rwa_settle",
    {
        requestId: z.string().describe("RWA execution request ID"),
        proofTimestamp: z.number().describe("Proof timestamp"),
        proofResult: z.record(z.unknown()).describe("Execution result"),
        providerAddress: z.string().describe("Provider wallet address")
    },
    async ({ requestId, proofTimestamp, proofResult, providerAddress }) => {
        const latencyMs = Date.now() - proofTimestamp;
        const valid = latencyMs < 5000;

        return formatContent({
            requestId,
            verification: {
                valid,
                latencyMs,
                reason: valid ? null : "SLA latency exceeded"
            },
            settlement: valid ? {
                status: "payment_released",
                provider: providerAddress,
                result: proofResult
            } : {
                status: "refunded",
                reason: "SLA not met"
            }
        });
    }
);

// ============================================================================
// META-AGENT TOOLS - Agent Discovery & Hiring
// ============================================================================

/**
 * Discover agents based on criteria
 */
server.tool(
    "meta_agent_discover",
    {
        capability: z.string().optional().describe("Required capability (e.g., 'perpetual_trading')"),
        category: z.string().optional().describe("Service category filter"),
        minReputation: z.number().optional().describe("Minimum reputation score (0-100)"),
        maxPricePerCall: z.string().optional().describe("Maximum price per call in USDC"),
        limit: z.number().optional().describe("Max number of results (default: 10)")
    },
    async ({ capability, category, minReputation, maxPricePerCall, limit }) => {
        try {
            const response = await fetch(`${config.relayCoreApi}/api/meta-agent/discover`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    capability,
                    category,
                    minReputation,
                    maxPricePerCall,
                    limit: limit || 10
                })
            });

            if (!response.ok) {
                return errorContent('Agent discovery failed');
            }

            const data = await response.json();

            return formatContent({
                success: true,
                count: data.count,
                agents: data.agents.map((a: any) => ({
                    agentId: a.agentId,
                    name: a.agentName,
                    url: a.agentUrl,
                    reputation: a.reputationScore,
                    pricePerCall: a.pricePerCall,
                    successRate: `${a.successRate.toFixed(1)}%`,
                    score: a.compositeScore,
                    hasCard: !!a.card
                }))
            });
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Discovery failed');
        }
    }
);

/**
 * Hire an agent to perform a task
 */
server.tool(
    "meta_agent_hire",
    {
        agentId: z.string().describe("Agent ID to hire"),
        resourceId: z.string().describe("Resource ID from agent card"),
        budget: z.string().describe("Maximum budget in USDC"),
        task: z.record(z.unknown()).describe("Task parameters")
    },
    async ({ agentId, resourceId, budget, task }) => {
        try {
            const agentAddress = wallet?.address || 'meta-agent-default';

            const response = await fetch(`${config.relayCoreApi}/api/meta-agent/hire`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Agent-Id': agentAddress
                },
                body: JSON.stringify({
                    agentId,
                    resourceId,
                    budget,
                    task
                })
            });

            if (!response.ok) {
                const error = await response.json();
                return errorContent(error.error || 'Hiring failed');
            }

            const result = await response.json();

            return formatContent({
                success: true,
                taskId: result.taskId,
                agentId: result.agentId,
                cost: result.cost,
                status: 'hired',
                nextStep: `Execute with: meta_agent_execute taskId=${result.taskId}`
            });
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Hiring failed');
        }
    }
);

/**
 * Execute a delegated task
 */
server.tool(
    "meta_agent_execute",
    {
        taskId: z.string().describe("Task ID from hiring")
    },
    async ({ taskId }) => {
        try {
            const response = await fetch(`${config.relayCoreApi}/api/meta-agent/execute/${taskId}`, {
                method: 'POST'
            });

            if (!response.ok) {
                return errorContent('Execution failed');
            }

            const data = await response.json();

            if (data.success) {
                return formatContent({
                    success: true,
                    taskId: data.outcome.taskId,
                    agentId: data.outcome.agentId,
                    state: data.outcome.state,
                    cost: data.outcome.cost,
                    outputs: data.outcome.outputs,
                    metrics: data.outcome.metrics
                });
            } else {
                return formatContent({
                    success: false,
                    taskId: data.outcome.taskId,
                    error: data.outcome.error
                });
            }
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Execution failed');
        }
    }
);

/**
 * Get delegation status
 */
server.tool(
    "meta_agent_status",
    {
        taskId: z.string().describe("Task ID to check")
    },
    async ({ taskId }) => {
        try {
            const response = await fetch(`${config.relayCoreApi}/api/meta-agent/status/${taskId}`);

            if (!response.ok) {
                return errorContent('Task not found');
            }

            const data = await response.json();

            return formatContent({
                success: true,
                ...data.outcome
            });
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Status check failed');
        }
    }
);

/**
 * Get agent card
 */
server.tool(
    "meta_agent_card",
    {
        agentId: z.string().describe("Agent ID")
    },
    async ({ agentId }) => {
        try {
            const response = await fetch(`${config.relayCoreApi}/api/meta-agent/agent-card/${agentId}`);

            if (!response.ok) {
                return errorContent('Agent card not found');
            }

            const data = await response.json();

            return formatContent({
                success: true,
                card: data.card
            });
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to fetch card');
        }
    }
);

/**
 * Fetch agent card directly from any URL (GAP: agent_fetch_card)
 * This enables discovery of any A2A-compliant agent regardless of registry
 */
server.tool(
    "agent_fetch_card",
    {
        url: z.string().describe("Base URL of agent (will try /.well-known/agent-card.json)"),
        fullUrl: z.boolean().optional().describe("If true, fetch from exact URL instead of well-known path")
    },
    async ({ url, fullUrl }) => {
        try {
            // Build URLs to try
            const urlsToTry = fullUrl
                ? [url]
                : [
                    `${url.replace(/\/$/, '')}/.well-known/agent-card.json`,
                    `${url.replace(/\/$/, '')}/.well-known/agent.json`,
                    `${url.replace(/\/$/, '')}/agent-card.json`
                ];

            for (const cardUrl of urlsToTry) {
                try {
                    const response = await fetch(cardUrl, {
                        headers: { 'Accept': 'application/json' },
                        signal: AbortSignal.timeout(10000)
                    });

                    if (response.ok) {
                        const card = await response.json();

                        return formatContent({
                            success: true,
                            fetchedFrom: cardUrl,
                            card: {
                                name: card.name,
                                description: card.description,
                                url: card.url,
                                version: card.version,
                                network: card.network,
                                capabilities: card.capabilities || [],
                                resources: (card.resources || []).map((r: any) => ({
                                    id: r.id,
                                    title: r.title,
                                    description: r.description,
                                    url: r.url,
                                    hasPaywall: !!r.paywall
                                })),
                                x402: card.x402 ? {
                                    enabled: true,
                                    payeeAddress: card.x402.payeeAddress,
                                    tokenAddress: card.x402.tokenAddress
                                } : null,
                                contracts: card.contracts
                            }
                        });
                    }
                } catch {
                    // Try next URL
                    continue;
                }
            }

            return errorContent(`No agent card found at ${url}. Tried: ${urlsToTry.join(', ')}`);
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to fetch agent card');
        }
    }
);

/**
 * List resources from an agent card (GAP: agent_list_resources)
 * Useful for discovering what capabilities an agent offers
 */
server.tool(
    "agent_list_resources",
    {
        url: z.string().describe("Agent base URL or agent card URL")
    },
    async ({ url }) => {
        try {
            // Try to fetch agent card
            const urlsToTry = [
                `${url.replace(/\/$/, '')}/.well-known/agent-card.json`,
                `${url.replace(/\/$/, '')}/.well-known/agent.json`,
                url // Try as-is
            ];

            for (const cardUrl of urlsToTry) {
                try {
                    const response = await fetch(cardUrl, {
                        headers: { 'Accept': 'application/json' },
                        signal: AbortSignal.timeout(10000)
                    });

                    if (response.ok) {
                        const card = await response.json();

                        const resources = (card.resources || []).map((r: any, index: number) => ({
                            index,
                            id: r.id,
                            title: r.title,
                            description: r.description || '',
                            url: r.url,
                            fullUrl: r.url.startsWith('http')
                                ? r.url
                                : `${card.url || url.replace(/\/$/, '')}${r.url}`,
                            paywall: r.paywall ? {
                                protocol: r.paywall.protocol || 'x402',
                                settlementEndpoint: r.paywall.settlement
                            } : null
                        }));

                        return formatContent({
                            success: true,
                            agentName: card.name,
                            agentUrl: card.url || url,
                            resourceCount: resources.length,
                            resources,
                            usage: "Use 'meta_agent_hire' with agentId and resourceId to hire this agent"
                        });
                    }
                } catch {
                    continue;
                }
            }

            return errorContent(`No agent card found at ${url}`);
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to list resources');
        }
    }
);

/**
 * Validate if a URL hosts a valid A2A agent
 */
server.tool(
    "agent_validate",
    {
        url: z.string().describe("URL to validate as A2A agent")
    },
    async ({ url }) => {
        try {
            const cardUrl = `${url.replace(/\/$/, '')}/.well-known/agent-card.json`;

            const response = await fetch(cardUrl, {
                headers: { 'Accept': 'application/json' },
                signal: AbortSignal.timeout(10000)
            });

            if (!response.ok) {
                return formatContent({
                    valid: false,
                    url,
                    reason: `No agent card at ${cardUrl} (HTTP ${response.status})`,
                    suggestion: "Agent must serve /.well-known/agent-card.json"
                });
            }

            const card = await response.json();

            // Validate required fields
            const issues: string[] = [];
            if (!card.name) issues.push("Missing 'name' field");
            if (!card.url) issues.push("Missing 'url' field");
            if (!card.resources || !Array.isArray(card.resources)) {
                issues.push("Missing or invalid 'resources' array");
            }

            // Check x402 compliance
            const hasX402 = !!card.x402 || card.resources?.some((r: any) => r.paywall);

            return formatContent({
                valid: issues.length === 0,
                url,
                cardUrl,
                agentName: card.name || 'Unknown',
                resourceCount: (card.resources || []).length,
                x402Enabled: hasX402,
                issues: issues.length > 0 ? issues : undefined,
                capabilities: card.capabilities || []
            });
        } catch (error) {
            return formatContent({
                valid: false,
                url,
                reason: error instanceof Error ? error.message : 'Connection failed',
                suggestion: "Check if the URL is accessible and CORS is configured"
            });
        }
    }
);

// ============================================================================
// INDEXER TOOLS - Graph, Perp, Temporal Data
// ============================================================================


/**
 * Get service dependency graph
 */
server.tool(
    "indexer_service_graph",
    {},
    async () => {
        try {
            const response = await fetch(`${config.relayCoreApi}/graphql`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: `query { serviceGraph { nodes { id name type owner } edges { from to weight } } }`
                })
            });

            const data = await response.json();
            return formatContent(data.data.serviceGraph);
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to fetch service graph');
        }
    }
);

/**
 * Get service dependencies
 */
server.tool(
    "indexer_service_dependencies",
    {
        serviceId: z.string().describe("Service ID")
    },
    async ({ serviceId }) => {
        try {
            const response = await fetch(`${config.relayCoreApi}/graphql`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: `query { serviceDependencies(serviceId: "${serviceId}") }`
                })
            });

            const data = await response.json();
            return formatContent({ serviceId, dependencies: data.data.serviceDependencies });
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to fetch dependencies');
        }
    }
);

/**
 * Get open perp positions
 */
server.tool(
    "indexer_perp_positions",
    {
        trader: z.string().optional().describe("Trader address (optional)")
    },
    async ({ trader }) => {
        try {
            const query = trader
                ? `query { perpOpenPositions(trader: "${trader}") { id trader pair isLong size pnl } }`
                : `query { perpOpenPositions { id trader pair isLong size pnl } }`;

            const response = await fetch(`${config.relayCoreApi}/graphql`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });

            const data = await response.json();
            return formatContent({ positions: data.data.perpOpenPositions });
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to fetch positions');
        }
    }
);

/**
 * Get perp trader stats
 */
server.tool(
    "indexer_perp_trader_stats",
    {
        trader: z.string().describe("Trader address")
    },
    async ({ trader }) => {
        try {
            const response = await fetch(`${config.relayCoreApi}/graphql`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: `query { perpTraderStats(trader: "${trader}") { totalTrades totalVolume totalPnl winRate } }`
                })
            });

            const data = await response.json();
            return formatContent(data.data.perpTraderStats);
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to fetch trader stats');
        }
    }
);

/**
 * Get task artifacts
 */
server.tool(
    "indexer_tasks",
    {
        agentId: z.string().optional().describe("Filter by agent ID"),
        serviceId: z.string().optional().describe("Filter by service ID"),
        state: z.string().optional().describe("Filter by state (pending/settled/failed)"),
        limit: z.number().optional().describe("Max results (default: 50)")
    },
    async ({ agentId, serviceId, state, limit }) => {
        try {
            const args = [];
            if (agentId) args.push(`agentId: "${agentId}"`);
            if (serviceId) args.push(`serviceId: "${serviceId}"`);
            if (state) args.push(`state: "${state}"`);
            if (limit) args.push(`limit: ${limit}`);

            const argsStr = args.length > 0 ? `(${args.join(', ')})` : '';

            const response = await fetch(`${config.relayCoreApi}/graphql`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: `query { tasks${argsStr} { taskId agentId serviceId state createdAt } }`
                })
            });

            const data = await response.json();
            return formatContent({ tasks: data.data.tasks });
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to fetch tasks');
        }
    }
);

// ============================================================================
// COMPREHENSIVE CRONOS ZKEVM EXPLORER API - Full Integration
// ============================================================================

const CRONOS_ZKEVM_API = 'https://explorer-api.zkevm.cronos.org/api/v1';
const CRONOS_ZKEVM_API_KEY = process.env.CRONOS_ZKEVM_API_KEY || '';

/**
 * Get native token balance by address
 */
server.tool(
    "cronos_zkevm_balance",
    {
        address: z.string().describe("Cronos zkEVM address"),
        blockHeight: z.string().optional().describe("Block height (number or 'latest', 'earliest', 'pending')")
    },
    async ({ address, blockHeight }) => {
        try {
            const params = new URLSearchParams({ address });
            if (blockHeight) params.set('blockHeight', blockHeight);

            const response = await fetch(`${CRONOS_ZKEVM_API}/account/getBalance?${params}`);
            if (!response.ok) return errorContent('Failed to fetch balance');

            const data = await response.json();
            return formatContent(data);
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to fetch balance');
        }
    }
);

/**
 * Get transactions by address
 */
server.tool(
    "cronos_zkevm_account_txs",
    {
        address: z.string().describe("Cronos zkEVM address"),
        startBlock: z.string().optional().describe("Start block range"),
        endBlock: z.string().optional().describe("End block range"),
        session: z.string().optional().describe("Previous page session"),
        limit: z.number().optional().describe("Page size (default: 20, max: 100)")
    },
    async ({ address, startBlock, endBlock, session, limit }) => {
        try {
            const params = new URLSearchParams({ address });
            if (startBlock) params.set('startBlock', startBlock);
            if (endBlock) params.set('endBlock', endBlock);
            if (session) params.set('session', session);
            if (limit) params.set('limit', limit.toString());

            const response = await fetch(`${CRONOS_ZKEVM_API}/account/getTxsByAddress?${params}`);
            if (!response.ok) return errorContent('Failed to fetch transactions');

            const data = await response.json();
            return formatContent(data);
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to fetch transactions');
        }
    }
);

/**
 * Get internal transactions by address
 */
server.tool(
    "cronos_zkevm_internal_txs",
    {
        address: z.string().describe("Cronos zkEVM address"),
        startBlock: z.string().optional().describe("Start block range"),
        endBlock: z.string().optional().describe("End block range"),
        session: z.string().optional().describe("Previous page session"),
        limit: z.number().optional().describe("Page size (default: 20, max: 100)")
    },
    async ({ address, startBlock, endBlock, session, limit }) => {
        try {
            const params = new URLSearchParams({ address });
            if (startBlock) params.set('startBlock', startBlock);
            if (endBlock) params.set('endBlock', endBlock);
            if (session) params.set('session', session);
            if (limit) params.set('limit', limit.toString());

            const response = await fetch(`${CRONOS_ZKEVM_API}/account/getInternalTxsByAddress?${params}`);
            if (!response.ok) return errorContent('Failed to fetch internal transactions');

            const data = await response.json();
            return formatContent(data);
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to fetch internal transactions');
        }
    }
);

/**
 * Get ERC-20 token transfer events by address
 */
server.tool(
    "cronos_zkevm_token_transfers",
    {
        address: z.string().describe("Cronos zkEVM address"),
        startBlock: z.string().optional().describe("Start block range"),
        endBlock: z.string().optional().describe("End block range"),
        session: z.string().optional().describe("Previous page session"),
        limit: z.number().optional().describe("Page size (default: 20, max: 100)")
    },
    async ({ address, startBlock, endBlock, session, limit }) => {
        try {
            const params = new URLSearchParams({ address });
            if (startBlock) params.set('startBlock', startBlock);
            if (endBlock) params.set('endBlock', endBlock);
            if (session) params.set('session', session);
            if (limit) params.set('limit', limit.toString());

            const response = await fetch(`${CRONOS_ZKEVM_API}/account/getERC20TransferByAddress?${params}`);
            if (!response.ok) return errorContent('Failed to fetch token transfers');

            const data = await response.json();
            return formatContent(data);
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to fetch token transfers');
        }
    }
);

/**
 * Get block detail by height
 */
server.tool(
    "cronos_zkevm_block",
    {
        height: z.string().describe("Block height")
    },
    async ({ height }) => {
        try {
            const response = await fetch(`${CRONOS_ZKEVM_API}/block/getDetailByHeight?height=${height}`);
            if (!response.ok) return errorContent('Block not found');

            const data = await response.json();
            return formatContent(data);
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to fetch block');
        }
    }
);

/**
 * Get block height by time
 */
server.tool(
    "cronos_zkevm_block_by_time",
    {
        timestamp: z.number().describe("Unix timestamp")
    },
    async ({ timestamp }) => {
        try {
            const response = await fetch(`${CRONOS_ZKEVM_API}/block/getHeightByTime?timestamp=${timestamp}`);
            if (!response.ok) return errorContent('Failed to get block height');

            const data = await response.json();
            return formatContent(data);
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to get block height');
        }
    }
);

/**
 * Get contract ABI
 */
server.tool(
    "cronos_zkevm_contract_abi",
    {
        address: z.string().describe("Contract address")
    },
    async ({ address }) => {
        try {
            const response = await fetch(`${CRONOS_ZKEVM_API}/contract/getABI?address=${address}`);
            if (!response.ok) return errorContent('Contract ABI not found');

            const data = await response.json();
            return formatContent(data);
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to fetch ABI');
        }
    }
);

/**
 * Get contract source code
 */
server.tool(
    "cronos_zkevm_contract_source",
    {
        address: z.string().describe("Contract address")
    },
    async ({ address }) => {
        try {
            const response = await fetch(`${CRONOS_ZKEVM_API}/contract/getSourceCode?${address}`);
            if (!response.ok) return errorContent('Contract source not found');

            const data = await response.json();
            return formatContent(data);
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to fetch source code');
        }
    }
);

/**
 * Get contract verification status
 */
server.tool(
    "cronos_zkevm_contract_verification",
    {
        address: z.string().describe("Contract address")
    },
    async ({ address }) => {
        try {
            const response = await fetch(`${CRONOS_ZKEVM_API}/contract/getVerificationStatus?address=${address}`);
            if (!response.ok) return errorContent('Failed to get verification status');

            const data = await response.json();
            return formatContent(data);
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to get verification status');
        }
    }
);

/**
 * Submit contract verification
 */
server.tool(
    "cronos_zkevm_verify_contract",
    {
        address: z.string().describe("Contract address"),
        sourceCode: z.string().describe("Contract source code"),
        compilerVersion: z.string().describe("Solidity compiler version"),
        optimizationUsed: z.boolean().describe("Was optimization enabled"),
        runs: z.number().optional().describe("Optimization runs")
    },
    async ({ address, sourceCode, compilerVersion, optimizationUsed, runs }) => {
        try {
            const body = {
                address,
                sourceCode,
                compilerVersion,
                optimizationUsed,
                runs: runs || 200
            };

            const response = await fetch(`${CRONOS_ZKEVM_API}/contract/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) return errorContent('Verification failed');

            const data = await response.json();
            return formatContent(data);
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Verification failed');
        }
    }
);

/**
 * Get Solc compiler versions
 */
server.tool(
    "cronos_zkevm_solc_versions",
    {},
    async () => {
        try {
            const response = await fetch(`${CRONOS_ZKEVM_API}/contract/getSolcVersions`);
            if (!response.ok) return errorContent('Failed to fetch compiler versions');

            const data = await response.json();
            return formatContent(data);
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to fetch compiler versions');
        }
    }
);

/**
 * Get Vyper compiler versions
 */
server.tool(
    "cronos_zkevm_vyper_versions",
    {},
    async () => {
        try {
            const response = await fetch(`${CRONOS_ZKEVM_API}/contract/getVyperVersions`);
            if (!response.ok) return errorContent('Failed to fetch Vyper versions');

            const data = await response.json();
            return formatContent(data);
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to fetch Vyper versions');
        }
    }
);

/**
 * Get zkSync Solc compiler versions
 */
server.tool(
    "cronos_zkevm_zksync_versions",
    {},
    async () => {
        try {
            const response = await fetch(`${CRONOS_ZKEVM_API}/contract/getZkSyncSolcVersions`);
            if (!response.ok) return errorContent('Failed to fetch zkSync versions');

            const data = await response.json();
            return formatContent(data);
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to fetch zkSync versions');
        }
    }
);

/**
 * Get zkSync Vyper compiler versions
 */
server.tool(
    "cronos_zkevm_zksync_vyper_versions",
    {},
    async () => {
        try {
            const response = await fetch(`${CRONOS_ZKEVM_API}/contract/getZkSyncVyperVersions`);
            if (!response.ok) return errorContent('Failed to fetch zkSync Vyper versions');

            const data = await response.json();
            return formatContent(data);
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to fetch zkSync Vyper versions');
        }
    }
);

/**
 * Get logs
 */
server.tool(
    "cronos_zkevm_logs",
    {
        fromBlock: z.string().optional().describe("Start block"),
        toBlock: z.string().optional().describe("End block"),
        address: z.string().optional().describe("Contract address"),
        topics: z.array(z.string()).optional().describe("Event topics"),
        limit: z.number().optional().describe("Max results")
    },
    async ({ fromBlock, toBlock, address, topics, limit }) => {
        try {
            const params = new URLSearchParams();
            if (fromBlock) params.set('fromBlock', fromBlock);
            if (toBlock) params.set('toBlock', toBlock);
            if (address) params.set('address', address);
            if (topics) params.set('topics', JSON.stringify(topics));
            if (limit) params.set('limit', limit.toString());

            const response = await fetch(`${CRONOS_ZKEVM_API}/logs/getLogs?${params}`);
            if (!response.ok) return errorContent('Failed to fetch logs');

            const data = await response.json();
            return formatContent(data);
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to fetch logs');
        }
    }
);

/**
 * Get logs by block height
 */
server.tool(
    "cronos_zkevm_logs_by_block",
    {
        blockHeight: z.string().describe("Block height")
    },
    async ({ blockHeight }) => {
        try {
            const response = await fetch(`${CRONOS_ZKEVM_API}/logs/getLogsByBlockHeight?blockHeight=${blockHeight}`);
            if (!response.ok) return errorContent('Failed to fetch logs');

            const data = await response.json();
            return formatContent(data);
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to fetch logs');
        }
    }
);

/**
 * Get ERC-20 token total supply
 */
server.tool(
    "cronos_zkevm_token_supply",
    {
        contractAddress: z.string().describe("Token contract address")
    },
    async ({ contractAddress }) => {
        try {
            const response = await fetch(`${CRONOS_ZKEVM_API}/tokens/getERC20TokenTotalSupply?contractAddress=${contractAddress}`);
            if (!response.ok) return errorContent('Failed to fetch token supply');

            const data = await response.json();
            return formatContent(data);
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to fetch token supply');
        }
    }
);

/**
 * Get ERC-20 token account balance
 */
server.tool(
    "cronos_zkevm_token_balance",
    {
        contractAddress: z.string().describe("Token contract address"),
        address: z.string().describe("Account address")
    },
    async ({ contractAddress, address }) => {
        try {
            const response = await fetch(`${CRONOS_ZKEVM_API}/tokens/getERC20TokenAccountBalance?contractAddress=${contractAddress}&address=${address}`);
            if (!response.ok) return errorContent('Failed to fetch token balance');

            const data = await response.json();
            return formatContent(data);
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to fetch token balance');
        }
    }
);

/**
 * Get transaction status by hash
 */
server.tool(
    "cronos_zkevm_tx_status",
    {
        txHash: z.string().describe("Transaction hash")
    },
    async ({ txHash }) => {
        try {
            const response = await fetch(`${CRONOS_ZKEVM_API}/transactions/getTransactionStatus?txHash=${txHash}`);
            if (!response.ok) return errorContent('Transaction not found');

            const data = await response.json();
            return formatContent(data);
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to fetch transaction status');
        }
    }
);

/**
 * Get internal transactions by transaction hash
 */
server.tool(
    "cronos_zkevm_internal_txs_by_hash",
    {
        txHash: z.string().describe("Transaction hash")
    },
    async ({ txHash }) => {
        try {
            const response = await fetch(`${CRONOS_ZKEVM_API}/transactions/getInternalTransactions?txHash=${txHash}`);
            if (!response.ok) return errorContent('Failed to fetch internal transactions');

            const data = await response.json();
            return formatContent(data);
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to fetch internal transactions');
        }
    }
);

/**
 * Get internal transactions by block range
 */
server.tool(
    "cronos_zkevm_internal_txs_by_range",
    {
        startBlock: z.string().describe("Start block"),
        endBlock: z.string().describe("End block")
    },
    async ({ startBlock, endBlock }) => {
        try {
            const response = await fetch(`${CRONOS_ZKEVM_API}/transactions/getInternalTransactionsByBlockRange?startBlock=${startBlock}&endBlock=${endBlock}`);
            if (!response.ok) return errorContent('Failed to fetch internal transactions');

            const data = await response.json();
            return formatContent(data);
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to fetch internal transactions');
        }
    }
);

/**
 * Get ZKCRO price
 */
server.tool(
    "cronos_zkevm_price",
    {},
    async () => {
        try {
            const response = await fetch(`${CRONOS_ZKEVM_API}/zkcroprice/getZkcroPrice`);
            if (!response.ok) return errorContent('Failed to fetch ZKCRO price');

            const data = await response.json();
            return formatContent(data);
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to fetch ZKCRO price');
        }
    }
);

// Eth Proxy methods (JSON-RPC compatible)

/**
 * eth_blockNumber - Get current block number
 */
server.tool(
    "cronos_zkevm_eth_block_number",
    {},
    async () => {
        try {
            const response = await fetch(`${CRONOS_ZKEVM_API}/eth-proxy/eth_blockNumber`);
            if (!response.ok) return errorContent('Failed to fetch block number');

            const data = await response.json();
            return formatContent(data);
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to fetch block number');
        }
    }
);

/**
 * eth_getBlockByNumber - Get block by number
 */
server.tool(
    "cronos_zkevm_eth_get_block",
    {
        blockNumber: z.string().describe("Block number (hex) or 'latest'"),
        fullTx: z.boolean().optional().describe("Include full transaction objects")
    },
    async ({ blockNumber, fullTx }) => {
        try {
            const response = await fetch(`${CRONOS_ZKEVM_API}/eth-proxy/eth_getBlockByNumber?blockNumber=${blockNumber}&fullTx=${fullTx || false}`);
            if (!response.ok) return errorContent('Block not found');

            const data = await response.json();
            return formatContent(data);
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to fetch block');
        }
    }
);

/**
 * eth_getBlockTransactionCountByNumber - Get transaction count in block
 */
server.tool(
    "cronos_zkevm_eth_block_tx_count",
    {
        blockNumber: z.string().describe("Block number (hex) or 'latest'")
    },
    async ({ blockNumber }) => {
        try {
            const response = await fetch(`${CRONOS_ZKEVM_API}/eth-proxy/eth_getBlockTransactionCountByNumber?blockNumber=${blockNumber}`);
            if (!response.ok) return errorContent('Failed to fetch transaction count');

            const data = await response.json();
            return formatContent(data);
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to fetch transaction count');
        }
    }
);

/**
 * eth_getTransactionByHash - Get transaction by hash
 */
server.tool(
    "cronos_zkevm_eth_get_tx",
    {
        txHash: z.string().describe("Transaction hash")
    },
    async ({ txHash }) => {
        try {
            const response = await fetch(`${CRONOS_ZKEVM_API}/eth-proxy/eth_getTransactionByHash?txHash=${txHash}`);
            if (!response.ok) return errorContent('Transaction not found');

            const data = await response.json();
            return formatContent(data);
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to fetch transaction');
        }
    }
);

/**
 * eth_getTransactionByBlockNumberAndIndex - Get transaction by block and index
 */
server.tool(
    "cronos_zkevm_eth_get_tx_by_index",
    {
        blockNumber: z.string().describe("Block number (hex)"),
        index: z.string().describe("Transaction index (hex)")
    },
    async ({ blockNumber, index }) => {
        try {
            const response = await fetch(`${CRONOS_ZKEVM_API}/eth-proxy/eth_getTransactionByBlockNumberAndIndex?blockNumber=${blockNumber}&index=${index}`);
            if (!response.ok) return errorContent('Transaction not found');

            const data = await response.json();
            return formatContent(data);
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to fetch transaction');
        }
    }
);

/**
 * eth_getTransactionCount - Get transaction count for address
 */
server.tool(
    "cronos_zkevm_eth_tx_count",
    {
        address: z.string().describe("Address"),
        blockNumber: z.string().optional().describe("Block number (hex) or 'latest'")
    },
    async ({ address, blockNumber }) => {
        try {
            const block = blockNumber || 'latest';
            const response = await fetch(`${CRONOS_ZKEVM_API}/eth-proxy/eth_getTransactionCount?address=${address}&blockNumber=${block}`);
            if (!response.ok) return errorContent('Failed to fetch transaction count');

            const data = await response.json();
            return formatContent(data);
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to fetch transaction count');
        }
    }
);

/**
 * eth_sendRawTransaction - Send signed transaction
 */
server.tool(
    "cronos_zkevm_eth_send_raw_tx",
    {
        signedTx: z.string().describe("Signed transaction data (hex)")
    },
    async ({ signedTx }) => {
        try {
            const response = await fetch(`${CRONOS_ZKEVM_API}/eth-proxy/eth_sendRawTransaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ signedTx })
            });

            if (!response.ok) return errorContent('Failed to send transaction');

            const data = await response.json();
            return formatContent(data);
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to send transaction');
        }
    }
);

/**
 * eth_getTransactionReceipt - Get transaction receipt
 */
server.tool(
    "cronos_zkevm_eth_tx_receipt",
    {
        txHash: z.string().describe("Transaction hash")
    },
    async ({ txHash }) => {
        try {
            const response = await fetch(`${CRONOS_ZKEVM_API}/eth-proxy/eth_getTransactionReceipt?txHash=${txHash}`);
            if (!response.ok) return errorContent('Receipt not found');

            const data = await response.json();
            return formatContent(data);
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to fetch receipt');
        }
    }
);

/**
 * eth_call - Execute contract call
 */
server.tool(
    "cronos_zkevm_eth_call",
    {
        to: z.string().describe("Contract address"),
        data: z.string().describe("Call data (hex)"),
        blockNumber: z.string().optional().describe("Block number (hex) or 'latest'")
    },
    async ({ to, data, blockNumber }) => {
        try {
            const block = blockNumber || 'latest';
            const response = await fetch(`${CRONOS_ZKEVM_API}/eth-proxy/eth_call?to=${to}&data=${data}&blockNumber=${block}`);
            if (!response.ok) return errorContent('Call failed');

            const result = await response.json();
            return formatContent(result);
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Call failed');
        }
    }
);

/**
 * eth_getCode - Get contract code
 */
server.tool(
    "cronos_zkevm_eth_get_code",
    {
        address: z.string().describe("Contract address"),
        blockNumber: z.string().optional().describe("Block number (hex) or 'latest'")
    },
    async ({ address, blockNumber }) => {
        try {
            const block = blockNumber || 'latest';
            const response = await fetch(`${CRONOS_ZKEVM_API}/eth-proxy/eth_getCode?address=${address}&blockNumber=${block}`);
            if (!response.ok) return errorContent('Failed to fetch code');

            const data = await response.json();
            return formatContent(data);
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to fetch code');
        }
    }
);

/**
 * eth_getStorageAt - Get storage value at position
 */
server.tool(
    "cronos_zkevm_eth_storage",
    {
        address: z.string().describe("Contract address"),
        position: z.string().describe("Storage position (hex)"),
        blockNumber: z.string().optional().describe("Block number (hex) or 'latest'")
    },
    async ({ address, position, blockNumber }) => {
        try {
            const block = blockNumber || 'latest';
            const response = await fetch(`${CRONOS_ZKEVM_API}/eth-proxy/eth_getStorageAt?address=${address}&position=${position}&blockNumber=${block}`);
            if (!response.ok) return errorContent('Failed to fetch storage');

            const data = await response.json();
            return formatContent(data);
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to fetch storage');
        }
    }
);

/**
 * eth_estimateGas - Estimate gas for transaction
 */
server.tool(
    "cronos_zkevm_eth_estimate_gas",
    {
        from: z.string().optional().describe("Sender address"),
        to: z.string().describe("Recipient address"),
        value: z.string().optional().describe("Value to send (hex)"),
        data: z.string().optional().describe("Transaction data (hex)")
    },
    async ({ from, to, value, data }) => {
        try {
            const params = new URLSearchParams({ to });
            if (from) params.set('from', from);
            if (value) params.set('value', value);
            if (data) params.set('data', data);

            const response = await fetch(`${CRONOS_ZKEVM_API}/eth-proxy/eth_estimateGas?${params}`);
            if (!response.ok) return errorContent('Failed to estimate gas');

            const result = await response.json();
            return formatContent(result);
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to estimate gas');
        }
    }
);

/**
 * eth_gasPrice - Get current gas price
 */
server.tool(
    "cronos_zkevm_eth_gas_price",
    {},
    async () => {
        try {
            const response = await fetch(`${CRONOS_ZKEVM_API}/eth-proxy/eth_gasPrice`);
            if (!response.ok) return errorContent('Failed to fetch gas price');

            const data = await response.json();
            return formatContent(data);
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to fetch gas price');
        }
    }
);

// ============================================
// SECTION: HANDOFF SIGNING TOOLS
// ============================================

/**
 * Pending transactions store (in-memory for MCP server)
 * Production should use shared Redis/database
 */
const pendingTransactions = new Map<string, {
    id: string;
    createdAt: Date;
    expiresAt: Date;
    status: 'pending' | 'signed' | 'broadcast' | 'confirmed' | 'failed' | 'expired';
    chainId: number;
    to: string;
    data: string;
    value: string;
    context: {
        tool: string;
        description?: string;
        params: Record<string, unknown>;
    };
    txHash?: string;
    blockNumber?: number;
    errorMessage?: string;
}>();

function generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Prepare a transaction for handoff signing
 * Returns a signing URL instead of executing directly
 */
server.tool(
    "handoff_prepare_transaction",
    {
        chainId: z.number().describe("Chain ID (25=mainnet, 338=testnet, 388=zkevm-mainnet, 240=zkevm-testnet)"),
        to: z.string().describe("Recipient/contract address"),
        data: z.string().describe("Transaction data (hex)"),
        value: z.string().optional().describe("Value in wei (default: 0)"),
        description: z.string().optional().describe("Human-readable description of this transaction")
    },
    async ({ chainId, to, data, value = "0", description }) => {
        const id = generateTransactionId();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes

        const pending = {
            id,
            createdAt: now,
            expiresAt,
            status: 'pending' as const,
            chainId,
            to,
            data,
            value,
            context: {
                tool: 'handoff_prepare_transaction',
                description,
                params: { chainId, to, data, value }
            }
        };

        pendingTransactions.set(id, pending);

        const signingUrl = `${config.relayCoreApi}/sign/${id}`;

        return formatContent({
            success: true,
            transactionId: id,
            signingUrl,
            expiresAt: expiresAt.toISOString(),
            chainId,
            description,
            instructions: [
                "1. Share the signing URL with the user",
                "2. User opens URL and connects wallet",
                "3. User signs the transaction",
                "4. Use handoff_check_status to poll for completion"
            ],
            note: "Agent NEVER signs - user signs via their wallet"
        });
    }
);

/**
 * Check status of a pending handoff transaction
 */
server.tool(
    "handoff_check_status",
    {
        transactionId: z.string().describe("Transaction ID from handoff_prepare_transaction")
    },
    async ({ transactionId }) => {
        const tx = pendingTransactions.get(transactionId);

        if (!tx) {
            return formatContent({
                found: false,
                error: "Transaction not found"
            });
        }

        // Check if expired
        if (tx.status === 'pending' && new Date() > tx.expiresAt) {
            tx.status = 'expired';
        }

        return formatContent({
            found: true,
            transactionId: tx.id,
            status: tx.status,
            chainId: tx.chainId,
            to: tx.to,
            value: tx.value,
            createdAt: tx.createdAt.toISOString(),
            expiresAt: tx.expiresAt.toISOString(),
            description: tx.context.description,
            txHash: tx.txHash,
            blockNumber: tx.blockNumber,
            errorMessage: tx.errorMessage
        });
    }
);

/**
 * Prepare ERC20 token transfer for handoff signing
 */
server.tool(
    "handoff_prepare_erc20_transfer",
    {
        chainId: z.number().describe("Chain ID"),
        tokenAddress: z.string().describe("ERC20 token contract address"),
        recipient: z.string().describe("Recipient address"),
        amount: z.string().describe("Amount in wei (use 1e18 for 18 decimal tokens)")
    },
    async ({ chainId, tokenAddress, recipient, amount }) => {
        const iface = new ethers.Interface([
            "function transfer(address to, uint256 amount) returns (bool)"
        ]);
        const data = iface.encodeFunctionData("transfer", [recipient, amount]);

        const id = generateTransactionId();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);

        const pending = {
            id,
            createdAt: now,
            expiresAt,
            status: 'pending' as const,
            chainId,
            to: tokenAddress,
            data,
            value: "0",
            context: {
                tool: 'handoff_prepare_erc20_transfer',
                description: `Transfer tokens to ${recipient.slice(0, 10)}...`,
                params: { chainId, tokenAddress, recipient, amount }
            }
        };

        pendingTransactions.set(id, pending);

        const signingUrl = `${config.relayCoreApi}/sign/${id}`;

        return formatContent({
            success: true,
            transactionId: id,
            signingUrl,
            expiresAt: expiresAt.toISOString(),
            tokenAddress,
            recipient,
            amount,
            instructions: "Open signing URL to complete the transfer"
        });
    }
);

/**
 * Prepare escrow session creation for handoff signing
 */
server.tool(
    "handoff_prepare_escrow_create",
    {
        escrowAgent: z.string().describe("Escrow agent address (authorized to release funds)"),
        maxSpend: z.string().describe("Maximum spend amount in USDC raw units (6 decimals)"),
        durationSeconds: z.number().describe("Session duration in seconds"),
        authorizedAgents: z.array(z.string()).describe("List of agent addresses authorized to receive payments")
    },
    async ({ escrowAgent, maxSpend, durationSeconds, authorizedAgents }) => {
        const escrowContract = process.env.ESCROW_CONTRACT_ADDRESS;
        if (!escrowContract) {
            return errorContent("ESCROW_CONTRACT_ADDRESS not configured");
        }

        const iface = new ethers.Interface([
            "function createSession(address escrowAgent, uint256 maxSpend, uint256 duration, address[] agents) returns (uint256)"
        ]);
        const data = iface.encodeFunctionData("createSession", [
            escrowAgent,
            maxSpend,
            durationSeconds,
            authorizedAgents
        ]);

        const id = generateTransactionId();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);

        const pending = {
            id,
            createdAt: now,
            expiresAt,
            status: 'pending' as const,
            chainId: config.cronos.testnet.chainId,
            to: escrowContract,
            data,
            value: "0",
            context: {
                tool: 'handoff_prepare_escrow_create',
                description: `Create escrow session (max: ${Number(maxSpend) / 1e6} USDC, ${authorizedAgents.length} agents)`,
                params: { escrowAgent, maxSpend, durationSeconds, authorizedAgents }
            }
        };

        pendingTransactions.set(id, pending);

        const signingUrl = `${config.relayCoreApi}/sign/${id}`;

        return formatContent({
            success: true,
            transactionId: id,
            signingUrl,
            expiresAt: expiresAt.toISOString(),
            escrowContract,
            escrowAgent,
            maxSpend,
            durationSeconds,
            authorizedAgents,
            instructions: "Open signing URL to create the session"
        });
    }
);

/**
 * Prepare escrow deposit for handoff signing
 */
server.tool(
    "handoff_prepare_escrow_deposit",
    {
        sessionId: z.string().describe("Session ID to deposit into"),
        amount: z.string().describe("Amount in USDC raw units (6 decimals)")
    },
    async ({ sessionId, amount }) => {
        const escrowContract = process.env.ESCROW_CONTRACT_ADDRESS;
        if (!escrowContract) {
            return errorContent("ESCROW_CONTRACT_ADDRESS not configured");
        }

        const iface = new ethers.Interface([
            "function deposit(uint256 sessionId, uint256 amount)"
        ]);
        const data = iface.encodeFunctionData("deposit", [sessionId, amount]);

        const id = generateTransactionId();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);

        const pending = {
            id,
            createdAt: now,
            expiresAt,
            status: 'pending' as const,
            chainId: config.cronos.testnet.chainId,
            to: escrowContract,
            data,
            value: "0",
            context: {
                tool: 'handoff_prepare_escrow_deposit',
                description: `Deposit ${Number(amount) / 1e6} USDC to session ${sessionId}`,
                params: { sessionId, amount }
            }
        };

        pendingTransactions.set(id, pending);

        const signingUrl = `${config.relayCoreApi}/sign/${id}`;

        return formatContent({
            success: true,
            transactionId: id,
            signingUrl,
            expiresAt: expiresAt.toISOString(),
            sessionId,
            amount,
            amountUsdc: Number(amount) / 1e6,
            instructions: "Open signing URL to deposit funds. Ensure token approval first."
        });
    }
);

/**
 * Prepare escrow refund for handoff signing
 */
server.tool(
    "handoff_prepare_escrow_refund",
    {
        sessionId: z.string().describe("Session ID to refund from")
    },
    async ({ sessionId }) => {
        const escrowContract = process.env.ESCROW_CONTRACT_ADDRESS;
        if (!escrowContract) {
            return errorContent("ESCROW_CONTRACT_ADDRESS not configured");
        }

        const iface = new ethers.Interface([
            "function refund(uint256 sessionId)"
        ]);
        const data = iface.encodeFunctionData("refund", [sessionId]);

        const id = generateTransactionId();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);

        const pending = {
            id,
            createdAt: now,
            expiresAt,
            status: 'pending' as const,
            chainId: config.cronos.testnet.chainId,
            to: escrowContract,
            data,
            value: "0",
            context: {
                tool: 'handoff_prepare_escrow_refund',
                description: `Refund remaining balance from session ${sessionId}`,
                params: { sessionId }
            }
        };

        pendingTransactions.set(id, pending);

        const signingUrl = `${config.relayCoreApi}/sign/${id}`;

        return formatContent({
            success: true,
            transactionId: id,
            signingUrl,
            expiresAt: expiresAt.toISOString(),
            sessionId,
            instructions: "Open signing URL to refund remaining balance"
        });
    }
);

// ============================================
// SECTION: NETWORK & FEEMARKET TOOLS
// ============================================

/**
 * Get network information
 */
server.tool(
    "network_info",
    {
        network: z.enum(['mainnet', 'testnet', 'zkevm-mainnet', 'zkevm-testnet']).default('testnet')
    },
    async ({ network }) => {
        try {
            const networkConfig = config.cronos[network];
            const [blockNumber, chainId, gasPrice] = await Promise.all([
                cronosRpc('eth_blockNumber', [], network),
                cronosRpc('eth_chainId', [], network),
                cronosRpc('eth_gasPrice', [], network)
            ]);

            return formatContent({
                network,
                chainId: parseInt(chainId, 16),
                currentBlock: parseInt(blockNumber, 16),
                gasPrice: {
                    wei: parseInt(gasPrice, 16),
                    gwei: parseInt(gasPrice, 16) / 1e9
                },
                rpcUrl: networkConfig.rpc,
                explorer: networkConfig.explorer
            });
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to fetch network info');
        }
    }
);

/**
 * Get fee history (EIP-1559)
 */
server.tool(
    "feemarket_get_fee_history",
    {
        network: z.enum(['mainnet', 'testnet', 'zkevm-mainnet', 'zkevm-testnet']).default('testnet'),
        blockCount: z.number().default(4).describe("Number of blocks to fetch (max 10)"),
        rewardPercentiles: z.array(z.number()).default([25, 50, 75]).describe("Reward percentiles")
    },
    async ({ network, blockCount, rewardPercentiles }) => {
        try {
            const result = await cronosRpc('eth_feeHistory', [
                `0x${Math.min(blockCount, 10).toString(16)}`,
                'latest',
                rewardPercentiles
            ], network);

            return formatContent({
                network,
                baseFeePerGas: result.baseFeePerGas?.map((fee: string) => ({
                    hex: fee,
                    wei: parseInt(fee, 16),
                    gwei: parseInt(fee, 16) / 1e9
                })),
                gasUsedRatio: result.gasUsedRatio,
                oldestBlock: parseInt(result.oldestBlock, 16),
                reward: result.reward
            });
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to fetch fee history');
        }
    }
);

/**
 * Get transaction count (nonce)
 */
server.tool(
    "tx_get_count",
    {
        address: z.string().describe("Wallet address"),
        network: z.enum(['mainnet', 'testnet', 'zkevm-mainnet', 'zkevm-testnet']).default('testnet')
    },
    async ({ address, network }) => {
        try {
            const result = await cronosRpc('eth_getTransactionCount', [address, 'latest'], network);
            return formatContent({
                address,
                network,
                nonce: parseInt(result, 16),
                nonceHex: result
            });
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to fetch transaction count');
        }
    }
);

/**
 * Get event logs
 */
server.tool(
    "event_get_logs",
    {
        network: z.enum(['mainnet', 'testnet', 'zkevm-mainnet', 'zkevm-testnet']).default('testnet'),
        address: z.string().optional().describe("Contract address to filter"),
        topics: z.array(z.string().nullable()).optional().describe("Topic filters"),
        fromBlock: z.string().optional().default('latest').describe("From block (hex or 'latest')"),
        toBlock: z.string().optional().default('latest').describe("To block (hex or 'latest')")
    },
    async ({ network, address, topics, fromBlock, toBlock }) => {
        try {
            const params: Record<string, unknown> = {};
            if (address) params.address = address;
            if (topics) params.topics = topics;
            params.fromBlock = fromBlock;
            params.toBlock = toBlock;

            const result = await cronosRpc('eth_getLogs', [params], network);

            return formatContent({
                network,
                logsCount: result.length,
                logs: result.slice(0, 50).map((log: any) => ({
                    address: log.address,
                    topics: log.topics,
                    data: log.data,
                    blockNumber: parseInt(log.blockNumber, 16),
                    transactionHash: log.transactionHash,
                    logIndex: parseInt(log.logIndex, 16)
                })),
                truncated: result.length > 50
            });
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to fetch logs');
        }
    }
);

// ============================================
// SECTION: VVS SWAP TOOLS
// ============================================

/**
 * Get VVS swap quote (read-only, no signing required)
 */
server.tool(
    "vvs_get_quote",
    {
        inputToken: z.string().describe("Input token address or 'NATIVE' for CRO"),
        outputToken: z.string().describe("Output token address or 'NATIVE' for CRO"),
        amount: z.string().describe("Amount to swap (human-readable, e.g., '1.5')"),
        network: z.enum(['mainnet', 'testnet']).default('testnet')
    },
    async ({ inputToken, outputToken, amount, network }) => {
        try {
            // This would use the VVS SDK - for now return informative response
            const chainId = network === 'mainnet' ? 25 : 338;

            return formatContent({
                status: "quote_request",
                inputToken,
                outputToken,
                amount,
                chainId,
                vvsRouterAddress: "0x145863Eb42Cf62847A6Ca784e6416C1682b1b2Ae",
                vvsFactoryAddress: "0x3b44b2a187a7b3824131f8db5a74194d0a42fc15",
                wcroAddress: "0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23",
                note: "Full VVS SDK integration available via @vvs-finance/swap-sdk",
                instructions: [
                    "1. Install: npm install @vvs-finance/swap-sdk",
                    "2. Use fetchBestTrade() to get optimal route",
                    "3. Use handoff_prepare_transaction to create signing URL"
                ]
            });
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to get VVS quote');
        }
    }
);

// ============================================
// SECTION: ESCROW SESSION QUERY TOOLS (READ-ONLY)
// ============================================

/**
 * Get escrow session status from database/contract
 */
server.tool(
    "escrow_get_session",
    {
        sessionId: z.string().describe("Session ID (uint256 as string)"),
        network: z.enum(['mainnet', 'testnet']).default('testnet')
    },
    async ({ sessionId, network }) => {
        try {
            const chainId = network === 'mainnet' ? 25 : 338;
            const networkConfig = network === 'mainnet'
                ? config.cronos.mainnet
                : config.cronos.testnet;

            // Call contract for live data
            const escrowAddress = process.env.ESCROW_CONTRACT_ADDRESS;
            if (!escrowAddress) {
                return errorContent('ESCROW_CONTRACT_ADDRESS not configured');
            }

            const data = '0x' +
                'c6def076' + // getSession(uint256) selector - keccak256("getSession(uint256)")[:8]
                sessionId.padStart(64, '0');

            const result = await cronosRpc('eth_call', [{
                to: escrowAddress,
                data
            }, 'latest'], network);

            // Parse result (owner, escrowAgent, deposited, released, remaining, maxSpend, expiry, active)
            if (result && result !== '0x') {
                // Basic decode - in production use ethers.AbiCoder
                return formatContent({
                    sessionId,
                    chainId,
                    contractAddress: escrowAddress,
                    rawData: result,
                    note: "Use ethers.AbiCoder to decode: (address,address,uint256,uint256,uint256,uint256,uint256,bool)"
                });
            }

            return formatContent({
                sessionId,
                chainId,
                status: "not_found",
                contractAddress: escrowAddress
            });
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to get session');
        }
    }
);

/**
 * Check if agent is authorized for session
 */
server.tool(
    "escrow_check_authorization",
    {
        sessionId: z.string().describe("Session ID (uint256 as string)"),
        agentAddress: z.string().describe("Agent wallet address"),
        network: z.enum(['mainnet', 'testnet']).default('testnet')
    },
    async ({ sessionId, agentAddress, network }) => {
        try {
            const escrowAddress = process.env.ESCROW_CONTRACT_ADDRESS;
            if (!escrowAddress) {
                return errorContent('ESCROW_CONTRACT_ADDRESS not configured');
            }

            // isAgentAuthorized(uint256,address) selector
            const selector = '0x' + '7b04a2d0'; // keccak256("isAgentAuthorized(uint256,address)")[:8]
            const data = selector +
                sessionId.padStart(64, '0') +
                agentAddress.toLowerCase().replace('0x', '').padStart(64, '0');

            const result = await cronosRpc('eth_call', [{
                to: escrowAddress,
                data
            }, 'latest'], network);

            const isAuthorized = result && result !== '0x' && parseInt(result, 16) === 1;

            return formatContent({
                sessionId,
                agentAddress,
                isAuthorized,
                contractAddress: escrowAddress,
                network
            });
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to check authorization');
        }
    }
);

/**
 * Get remaining balance in escrow session
 */
server.tool(
    "escrow_get_balance",
    {
        sessionId: z.string().describe("Session ID (uint256 as string)"),
        network: z.enum(['mainnet', 'testnet']).default('testnet')
    },
    async ({ sessionId, network }) => {
        try {
            const escrowAddress = process.env.ESCROW_CONTRACT_ADDRESS;
            if (!escrowAddress) {
                return errorContent('ESCROW_CONTRACT_ADDRESS not configured');
            }

            // remainingBalance(uint256) selector
            const selector = '0x' + '3c8b4e48'; // keccak256("remainingBalance(uint256)")[:8]
            const data = selector + sessionId.padStart(64, '0');

            const result = await cronosRpc('eth_call', [{
                to: escrowAddress,
                data
            }, 'latest'], network);

            const balance = result ? BigInt(result) : BigInt(0);

            return formatContent({
                sessionId,
                remainingBalance: {
                    raw: balance.toString(),
                    usdc: (Number(balance) / 1e6).toFixed(6)
                },
                contractAddress: escrowAddress,
                network
            });
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to get balance');
        }
    }
);

/**
 * Get agent spend in session
 */
server.tool(
    "escrow_get_agent_spend",
    {
        sessionId: z.string().describe("Session ID (uint256 as string)"),
        agentAddress: z.string().describe("Agent wallet address"),
        network: z.enum(['mainnet', 'testnet']).default('testnet')
    },
    async ({ sessionId, agentAddress, network }) => {
        try {
            const escrowAddress = process.env.ESCROW_CONTRACT_ADDRESS;
            if (!escrowAddress) {
                return errorContent('ESCROW_CONTRACT_ADDRESS not configured');
            }

            // getAgentSpend(uint256,address) selector
            const selector = '0x' + '9e8f0543'; // keccak256("getAgentSpend(uint256,address)")[:8]
            const data = selector +
                sessionId.padStart(64, '0') +
                agentAddress.toLowerCase().replace('0x', '').padStart(64, '0');

            const result = await cronosRpc('eth_call', [{
                to: escrowAddress,
                data
            }, 'latest'], network);

            const spent = result ? BigInt(result) : BigInt(0);

            return formatContent({
                sessionId,
                agentAddress,
                amountSpent: {
                    raw: spent.toString(),
                    usdc: (Number(spent) / 1e6).toFixed(6)
                },
                contractAddress: escrowAddress,
                network
            });
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to get agent spend');
        }
    }
);

/**
 * Get total session count from contract
 */
server.tool(
    "escrow_get_session_count",
    {
        network: z.enum(['mainnet', 'testnet']).default('testnet')
    },
    async ({ network }) => {
        try {
            const escrowAddress = process.env.ESCROW_CONTRACT_ADDRESS;
            if (!escrowAddress) {
                return errorContent('ESCROW_CONTRACT_ADDRESS not configured');
            }

            // sessionCounter() selector
            const selector = '0x' + '6c8b703f'; // keccak256("sessionCounter()")[:8]

            const result = await cronosRpc('eth_call', [{
                to: escrowAddress,
                data: selector
            }, 'latest'], network);

            const count = result ? Number(BigInt(result)) : 0;

            return formatContent({
                totalSessions: count,
                contractAddress: escrowAddress,
                network
            });
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to get session count');
        }
    }
);

// ============================================
// SECTION: GENERIC CONTRACT INTERACTION
// ============================================

/**
 * Call any contract view function
 */
server.tool(
    "contract_call",
    {
        contractAddress: z.string().describe("Contract address"),
        data: z.string().describe("Encoded function call data (hex)"),
        network: z.enum(['mainnet', 'testnet', 'zkevm-mainnet', 'zkevm-testnet']).default('testnet')
    },
    async ({ contractAddress, data, network }) => {
        try {
            const result = await cronosRpc('eth_call', [{
                to: contractAddress,
                data
            }, 'latest'], network);

            return formatContent({
                contractAddress,
                network,
                result,
                resultDecimal: result && result !== '0x' ? BigInt(result).toString() : '0'
            });
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Contract call failed');
        }
    }
);

/**
 * Get contract bytecode to verify it exists
 */
server.tool(
    "contract_get_code",
    {
        contractAddress: z.string().describe("Contract address"),
        network: z.enum(['mainnet', 'testnet', 'zkevm-mainnet', 'zkevm-testnet']).default('testnet')
    },
    async ({ contractAddress, network }) => {
        try {
            const result = await cronosRpc('eth_getCode', [contractAddress, 'latest'], network);

            const hasCode = result && result !== '0x' && result.length > 2;

            return formatContent({
                contractAddress,
                network,
                isContract: hasCode,
                bytecodeLength: hasCode ? (result.length - 2) / 2 : 0,
                bytecodePrefix: hasCode ? result.substring(0, 66) + '...' : null
            });
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to get contract code');
        }
    }
);

/**
 * Get storage at specific slot
 */
server.tool(
    "contract_get_storage",
    {
        contractAddress: z.string().describe("Contract address"),
        slot: z.string().describe("Storage slot (hex)"),
        network: z.enum(['mainnet', 'testnet', 'zkevm-mainnet', 'zkevm-testnet']).default('testnet')
    },
    async ({ contractAddress, slot, network }) => {
        try {
            const result = await cronosRpc('eth_getStorageAt', [contractAddress, slot, 'latest'], network);

            return formatContent({
                contractAddress,
                slot,
                network,
                value: result,
                valueDecimal: result && result !== '0x' ? BigInt(result).toString() : '0'
            });
        } catch (error) {
            return errorContent(error instanceof Error ? error.message : 'Failed to get storage');
        }
    }
);

// START SERVER


async function startServer() {
    console.error("Relay Core MCP Server starting...");
    console.error(`   Mode: ${config.http.enabled ? 'HTTP' : 'stdio'}`);
    console.error(`   Cronos Testnet: ${config.cronos.testnet.rpc}`);
    console.error(`   Cronos Mainnet: ${config.cronos.mainnet.rpc}`);
    console.error(`   Crypto.com Exchange API: ${config.cryptoComExchange}`);
    console.error(`   Relay Core API: ${config.relayCoreApi}`);
    console.error(`   IdentityRegistry: ${CONTRACTS.identityRegistry}`);
    console.error(`   ReputationRegistry: ${CONTRACTS.reputationRegistry}`);

    if (wallet) {
        console.error(`   x402 Wallet: ${wallet.address}`);
        console.error(`   x402 Auto-Pay: ${config.x402.autoPay}`);
    } else {
        console.error(`   x402 Wallet: Not configured`);
    }

    // Register Cronos Developer Platform SDK tools
    registerCronosSDKTools(server);
    console.error(`   Developer Platform API: ${process.env.DEVELOPER_PLATFORM_API_KEY ? 'Configured' : 'Not configured'}`);

    // Register RWA State Machine tools
    registerRWATools(server);
    console.error(`   RWA Tools: Registered (API: ${process.env.RELAY_CORE_API || 'http://localhost:3001'})`);

    if (config.http.enabled) {
        // HTTP Mode - for Claude Web and API access
        const app = express();

        app.use(cors({
            origin: config.http.corsOrigins === '*' ? '*' : config.http.corsOrigins.split(','),
            methods: ['GET', 'POST', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Accept', 'Mcp-Session-Id']
        }));

        app.use(express.json());

        // Store transports for each session
        const transports = new Map<string, StreamableHTTPServerTransport>();

        // Health check endpoint
        app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                server: 'Relay Core MCP',
                version: '1.0.0',
                mode: 'http',
                walletConfigured: !!wallet,
                x402AutoPay: config.x402.autoPay
            });
        });

        // MCP endpoint - handles POST requests
        app.post('/mcp', async (req, res) => {
            const sessionId = req.headers['mcp-session-id'] as string || 'default';

            let transport = transports.get(sessionId);

            if (!transport) {
                transport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: () => sessionId,
                    onsessioninitialized: (id) => {
                        console.error(`[HTTP] Session initialized: ${id}`);
                    }
                });

                transports.set(sessionId, transport);
                await server.connect(transport);
            }

            await transport.handleRequest(req, res, req.body);
        });

        // SSE endpoint for server-initiated messages
        app.get('/mcp', async (req, res) => {
            const sessionId = req.headers['mcp-session-id'] as string || 'default';
            const transport = transports.get(sessionId);

            if (transport) {
                await transport.handleRequest(req, res);
            } else {
                res.status(400).json({ error: 'No session found. POST to /mcp first.' });
            }
        });

        // DELETE for session cleanup
        app.delete('/mcp', async (req, res) => {
            const sessionId = req.headers['mcp-session-id'] as string || 'default';
            const transport = transports.get(sessionId);

            if (transport) {
                await transport.handleRequest(req, res);
                transports.delete(sessionId);
            } else {
                res.status(404).json({ error: 'Session not found' });
            }
        });

        app.listen(config.http.port, () => {
            console.error(`\nRelay Core MCP Server (HTTP) listening on port ${config.http.port}`);
            console.error(`   MCP Endpoint: http://localhost:${config.http.port}/mcp`);
            console.error(`   Health Check: http://localhost:${config.http.port}/health`);
            console.error(`\nAdd to Claude Web settings:`);
            console.error(`   URL: http://localhost:${config.http.port}/mcp`);
        });
    } else {
        // Stdio Mode - for Claude Code
        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.error("\nRelay Core MCP Server started (stdio mode)");
    }
}

startServer().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
});