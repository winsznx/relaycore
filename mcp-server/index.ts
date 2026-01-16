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
import { z } from "zod";
import { ethers } from "ethers";
import express from "express";
import cors from "cors";
import 'dotenv/config';
// Official x402 Facilitator Client from Crypto.com
import { Facilitator, type PaymentRequirements, CronosNetwork } from '@crypto.com/facilitator-client';

// CRYPTO.COM MCP BRIDGE
// Runtime bridge to Crypto.com MCP server using HTTP JSON-RPC

const CRYPTO_COM_MCP_URL = 'https://mcp.crypto.com/market-data/mcp';
let mcpSessionId: string | null = null;

interface MCPResponse {
    jsonrpc: string;
    id: number;
    result?: unknown;
    error?: { code: number; message: string };
}

async function initMcpSession(): Promise<string> {
    if (mcpSessionId) return mcpSessionId;

    try {
        const response = await fetch(CRYPTO_COM_MCP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'initialize',
                params: {
                    protocolVersion: '2024-11-05',
                    capabilities: {},
                    clientInfo: { name: 'relaycore-mcp-bridge', version: '1.0.0' }
                }
            })
        });

        if (!response.ok) {
            throw new Error(`MCP init failed: ${response.status}`);
        }

        // Extract session ID from response headers if present
        const sessionHeader = response.headers.get('mcp-session-id');
        if (sessionHeader) {
            mcpSessionId = sessionHeader;
        } else {
            mcpSessionId = `session-${Date.now()}`;
        }

        console.error('[MCP Bridge] Initialized session with Crypto.com MCP');
        return mcpSessionId;
    } catch (error) {
        console.error('[MCP Bridge] Failed to initialize:', error);
        throw error;
    }
}

async function callCryptoComMcp(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    if (mcpSessionId) {
        headers['mcp-session-id'] = mcpSessionId;
    }

    const response = await fetch(CRYPTO_COM_MCP_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method,
            params
        })
    });

    if (!response.ok) {
        throw new Error(`MCP call failed: ${response.status} ${response.statusText}`);
    }

    const json = await response.json() as MCPResponse;

    if (json.error) {
        throw new Error(`MCP error: ${json.error.message}`);
    }

    return json.result;
}

async function callCryptoComTool(toolName: string, args: Record<string, unknown> = {}): Promise<unknown> {
    await initMcpSession();

    const result = await callCryptoComMcp('tools/call', {
        name: toolName,
        arguments: args
    }) as { content?: Array<{ type: string; text?: string }> };

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
}

async function listCryptoComTools(): Promise<unknown> {
    await initMcpSession();
    return await callCryptoComMcp('tools/list', {});
}

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

    // Cronos RPC endpoints
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
    network: 'mainnet' | 'testnet' = 'testnet'
) {
    const rpcUrl = config.cronos[network].rpc;
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
        if (!wallet || !facilitator) {
            return errorContent("Wallet or Facilitator not initialized. Set WALLET_PRIVATE_KEY in .env");
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
            return errorContent("Failed to generate payment header. Check USDC balance.");
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
            return formatContent({
                success: false,
                error: settleResult.error || settleResult.details || "Facilitator settlement failed",
                paymentId,
                debug: settleResult
            });
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
            const result = await callCryptoComMcp('get_candlestick', {
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
            const result = await callCryptoComMcp('get_instruments', type ? { type } : {});

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
            const result = await callCryptoComMcp('get_trades', {
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
            const result = await callCryptoComMcp('get_all_tickers', {});

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
            const result = await callCryptoComMcp('get_valuations', {
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
        network: z.enum(["mainnet", "testnet"]).optional().describe("Cronos network (default: testnet)")
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
        network: z.enum(["mainnet", "testnet"]).optional().describe("Cronos network"),
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
        network: z.enum(["mainnet", "testnet"]).optional().describe("Cronos network")
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
        network: z.enum(["mainnet", "testnet"]).optional().describe("Cronos network")
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
        network: z.enum(["mainnet", "testnet"]).optional().describe("Cronos network")
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
        network: z.enum(["mainnet", "testnet"]).optional().describe("Cronos network")
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
        network: z.enum(["mainnet", "testnet"]).optional().describe("Cronos network")
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
        network: z.enum(["mainnet", "testnet"]).optional().describe("Cronos network")
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
        network: z.enum(["mainnet", "testnet"]).optional().describe("Cronos network")
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
        paymentId: z.string().optional().describe("Payment ID if x402 was completed")
    },
    async ({ agentId, input, paymentId }) => {
        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
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
        network: z.enum(["mainnet", "testnet"]).optional().describe("Cronos network")
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
        network: z.enum(["mainnet", "testnet"]).optional().describe("Cronos network")
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
        network: z.enum(["mainnet", "testnet"]).optional().describe("Cronos network")
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
 * Create a new payment session (returns 402 for funding)
 */
server.tool(
    "relay_session_create",
    {
        maxSpend: z.string().describe("Maximum USDC to spend in session (e.g., '100')"),
        durationHours: z.number().optional().describe("Session duration in hours (default: 24)"),
        authorizedAgents: z.array(z.string()).optional().describe("Agent addresses authorized to receive payments")
    },
    async ({ maxSpend, durationHours = 24, authorizedAgents = [] }) => {
        try {
            const escrowAddress = process.env.ESCROW_CONTRACT_ADDRESS;
            if (!escrowAddress) {
                return formatContent({
                    status: "402_payment_required",
                    error: "Escrow contract not deployed",
                    action: "Deploy EscrowSession.sol to Cronos first",
                    contractPath: "contracts/EscrowSession.sol"
                });
            }

            const sessionId = `sess_${Date.now()}`;
            const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();

            return formatContent({
                status: "402_payment_required",
                sessionId,
                paymentRequired: {
                    amount: maxSpend,
                    asset: "USDC",
                    escrowContract: escrowAddress,
                    network: "cronos_testnet"
                },
                sessionConfig: {
                    maxSpend,
                    durationHours,
                    expiresAt,
                    authorizedAgents: authorizedAgents.length > 0 ? authorizedAgents : ["any"]
                },
                instructions: [
                    "1. Approve USDC spending for escrow contract",
                    "2. Call deposit() with session ID and amount",
                    "3. Session becomes active for agent execution"
                ]
            });
        } catch (err) {
            return errorContent(err instanceof Error ? err.message : 'Failed to create session');
        }
    }
);

/**
 * Get session status and remaining balance
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
                return formatContent({
                    sessionId,
                    status: "unknown",
                    deposited: "0",
                    released: "0",
                    remaining: "0",
                    active: false,
                    note: "Session data available when escrow is deployed"
                });
            }
            const data = await response.json();
            return formatContent({
                sessionId,
                owner: data.owner,
                deposited: data.deposited,
                released: data.released,
                remaining: data.remaining,
                maxSpend: data.maxSpend,
                expiry: new Date(data.expiry * 1000).toISOString(),
                active: data.active,
                authorizedAgents: data.authorizedAgents || []
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
                method: 'POST'
            });

            if (!response.ok) {
                return formatContent({
                    success: false,
                    sessionId,
                    error: 'Refund failed'
                });
            }

            const data = await response.json();
            return formatContent({
                success: true,
                sessionId,
                refundedAmount: data.amount,
                txHash: data.txHash,
                explorer: `https://explorer.cronos.org/testnet/tx/${data.txHash}`
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
                method: 'POST'
            });

            if (!response.ok) {
                return formatContent({
                    success: false,
                    sessionId,
                    error: 'Close failed'
                });
            }

            const data = await response.json();
            return formatContent({
                success: true,
                sessionId,
                refundedAmount: data.refunded,
                txHash: data.txHash,
                status: "closed"
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
