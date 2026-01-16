/**
 * Crypto.com Market Data MCP Client
 * 
 * Connects to the remote Crypto.com MCP server for market data.
 * Available data: prices, volume, order books, price changes.
 */

export interface MarketData {
    symbol: string;
    price: number;
    volume24h: number;
    change24h: number;
    high24h: number;
    low24h: number;
    bid: number;
    ask: number;
    timestamp: number;
}

export interface OrderBook {
    symbol: string;
    bids: [number, number][];
    asks: [number, number][];
    timestamp: number;
}

const MCP_SERVER_URL = 'https://mcp.crypto.com/market-data/mcp';

/**
 * Crypto.com MCP Client for programmatic access to market data.
 */
export class CryptoComMCPClient {
    private serverUrl: string;

    constructor() {
        this.serverUrl = MCP_SERVER_URL;
    }

    /**
     * Call an MCP tool via HTTP
     * 
     * MCP uses JSON-RPC 2.0 over HTTP for remote servers
     */
    private async callTool(toolName: string, args: Record<string, any> = {}): Promise<any> {
        try {
            // MCP uses JSON-RPC 2.0 format
            const request = {
                jsonrpc: '2.0',
                id: Date.now(),
                method: 'tools/call',
                params: {
                    name: toolName,
                    arguments: args,
                },
            };

            const response = await fetch(this.serverUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request),
            });

            if (!response.ok) {
                throw new Error(`MCP request failed: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();

            if (result.error) {
                throw new Error(`MCP error: ${result.error.message}`);
            }

            return result.result;
        } catch (error) {
            console.error(`MCP tool call failed (${toolName}):`, error);
            throw error;
        }
    }

    /**
     * Get market data for a symbol
     * 
     * Example symbols: BTC_USDT, ETH_USDT, SOL_USDT
     */
    async getMarketData(symbol: string): Promise<MarketData> {
        try {
            const result = await this.callTool('get_ticker', {
                instrument_name: symbol,
            });

            // Parse the response based on MCP tool output format
            const data = typeof result === 'string' ? JSON.parse(result) : result;

            // Handle both direct response and content array format
            const ticker = data.content?.[0]?.text
                ? JSON.parse(data.content[0].text)
                : data;

            return {
                symbol,
                price: parseFloat(ticker.a || ticker.last_price || 0),
                volume24h: parseFloat(ticker.v || ticker.volume_24h || 0),
                change24h: parseFloat(ticker.c || ticker.price_change_24h || 0),
                high24h: parseFloat(ticker.h || ticker.high_24h || 0),
                low24h: parseFloat(ticker.l || ticker.low_24h || 0),
                bid: parseFloat(ticker.b || ticker.bid || 0),
                ask: parseFloat(ticker.k || ticker.ask || 0),
                timestamp: ticker.t || Date.now(),
            };
        } catch (error) {
            console.error(`Failed to get market data for ${symbol}:`, error);
            throw error;
        }
    }

    /**
     * Get order book for a symbol
     */
    async getOrderBook(symbol: string, depth: number = 10): Promise<OrderBook> {
        try {
            const result = await this.callTool('get_book', {
                instrument_name: symbol,
                depth,
            });

            const data = typeof result === 'string' ? JSON.parse(result) : result;
            const book = data.content?.[0]?.text
                ? JSON.parse(data.content[0].text)
                : data;

            return {
                symbol,
                bids: (book.bids || []).map((b: any) => [parseFloat(b[0]), parseFloat(b[1])]),
                asks: (book.asks || []).map((a: any) => [parseFloat(a[0]), parseFloat(a[1])]),
                timestamp: book.t || Date.now(),
            };
        } catch (error) {
            console.error(`Failed to get order book for ${symbol}:`, error);
            throw error;
        }
    }

    /**
     * Get available trading instruments
     */
    async getInstruments(): Promise<string[]> {
        try {
            const result = await this.callTool('get_instruments', {});

            const data = typeof result === 'string' ? JSON.parse(result) : result;
            const instruments = data.content?.[0]?.text
                ? JSON.parse(data.content[0].text)
                : data;

            if (Array.isArray(instruments)) {
                return instruments.map((i: any) => i.instrument_name || i);
            }

            return [];
        } catch (error) {
            console.error('Failed to get instruments:', error);
            throw error;
        }
    }

    /**
     * Get multiple market data at once
     */
    async getMultipleMarketData(symbols: string[]): Promise<MarketData[]> {
        return Promise.all(symbols.map((symbol) => this.getMarketData(symbol)));
    }

    /**
     * Health check - verify MCP server is reachable
     */
    async isConnected(): Promise<boolean> {
        try {
            // Try a simple request to check connectivity
            const response = await fetch(this.serverUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'initialize',
                    params: {
                        protocolVersion: '2024-11-05',
                        capabilities: {},
                        clientInfo: {
                            name: 'relay-core',
                            version: '1.0.0',
                        },
                    },
                }),
            });

            return response.ok;
        } catch {
            return false;
        }
    }
}

// Singleton instance
export const mcpClient = new CryptoComMCPClient();

/**
 * MCP Server Info
 * 
 * For reference - this is what Claude Desktop config looks like:
 * 
 * {
 *   "mcpServers": {
 *     "crypto-market-data": {
 *       "type": "http",
 *       "url": "https://mcp.crypto.com/market-data/mcp"
 *     }
 *   }
 * }
 * 
 * And for Claude Code CLI:
 * claude mcp add --transport http -s user crypto-market-data https://mcp.crypto.com/market-data/mcp
 */
