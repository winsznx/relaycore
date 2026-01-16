import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Terminal, Cpu, Globe, Zap, Database, Bot, Copy, CheckCircle } from 'lucide-react';

/**
 * MCP Server Documentation Page
 * 
 * Guide for using Relay Core's Model Context Protocol server
 */
export function MCPGuide() {
    const [copied, setCopied] = React.useState<string | null>(null);

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
    };

    const CodeBlock = ({ code, id }: { code: string; id: string }) => (
        <div className="relative group">
            <div className="absolute right-3 top-3">
                <button
                    onClick={() => copyToClipboard(code, id)}
                    className="p-2 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
                >
                    {copied === id ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                        <Copy className="w-4 h-4 text-gray-500" />
                    )}
                </button>
            </div>
            <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                <code className="text-sm text-gray-800">{code}</code>
            </pre>
        </div>
    );

    return (
        <div className="space-y-8">
            {/* Back Link */}
            <Link
                to="/docs"
                className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6"
            >
                <ArrowLeft className="w-4 h-4" />
                Back to Docs
            </Link>

            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-4">MCP Server</h1>
                <p className="text-gray-600 text-lg">
                    Model Context Protocol server for AI agents to interact with Relay Core,
                    Cronos blockchain, and Crypto.com exchange data.
                </p>
            </div>

            {/* Tool Categories */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-12">
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg text-center">
                    <Globe className="w-6 h-6 text-orange-600 mx-auto mb-2" />
                    <div className="font-semibold text-gray-900">10</div>
                    <div className="text-xs text-gray-500">Crypto.com</div>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
                    <Database className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                    <div className="font-semibold text-gray-900">9</div>
                    <div className="text-xs text-gray-500">Cronos</div>
                </div>
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg text-center">
                    <Zap className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                    <div className="font-semibold text-gray-900">11</div>
                    <div className="text-xs text-gray-500">Relay Core</div>
                </div>
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                    <Bot className="w-6 h-6 text-green-600 mx-auto mb-2" />
                    <div className="font-semibold text-gray-900">4</div>
                    <div className="text-xs text-gray-500">PerpAI</div>
                </div>
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-center">
                    <Cpu className="w-6 h-6 text-amber-600 mx-auto mb-2" />
                    <div className="font-semibold text-gray-900">7</div>
                    <div className="text-xs text-gray-500">ACPS</div>
                </div>
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
                    <Zap className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
                    <div className="font-semibold text-gray-900">4</div>
                    <div className="text-xs text-gray-500">RWA</div>
                </div>
            </div>

            {/* Installation */}
            <section className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Setup for Claude Code</h2>
                <p className="text-gray-600 mb-4">
                    Add to your MCP configuration file:
                </p>
                <CodeBlock
                    id="mcp-config"
                    code={`{
  "mcpServers": {
    "relay-core": {
      "command": "npx",
      "args": ["tsx", "/path/to/relaycore/mcp-server/index.ts"],
      "env": {
        "RELAY_CORE_API_URL": "http://localhost:4000",
        "CLAUDE_API_KEY": "sk-ant-..."
      }
    }
  }
}`}
                />
                <p className="text-sm text-gray-500 mt-2">
                    <strong>macOS:</strong> ~/Library/Application Support/Claude/claude_desktop_config.json
                </p>
            </section>

            {/* Crypto.com Tools */}
            <section className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    <Globe className="w-6 h-6 inline mr-2 text-orange-600" />
                    Crypto.com Exchange Tools
                </h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="text-left p-3 font-semibold text-gray-900">Tool</th>
                                <th className="text-left p-3 font-semibold text-gray-900">Description</th>
                                <th className="text-left p-3 font-semibold text-gray-900">Parameters</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            <tr>
                                <td className="p-3 font-mono text-orange-600">crypto_com_get_ticker</td>
                                <td className="p-3 text-gray-600">Get price ticker</td>
                                <td className="p-3 text-gray-500">instrument: "BTC_USDT"</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-orange-600">crypto_com_get_orderbook</td>
                                <td className="p-3 text-gray-600">Get order book</td>
                                <td className="p-3 text-gray-500">instrument, depth?</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-orange-600">crypto_com_get_candlestick</td>
                                <td className="p-3 text-gray-600">Get OHLCV data</td>
                                <td className="p-3 text-gray-500">instrument, timeframe?</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-orange-600">crypto_com_get_instruments</td>
                                <td className="p-3 text-gray-600">List trading pairs</td>
                                <td className="p-3 text-gray-500">type?: SPOT | PERPETUAL</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Cronos Tools */}
            <section className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    <Database className="w-6 h-6 inline mr-2 text-blue-600" />
                    Cronos Blockchain Tools
                </h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="text-left p-3 font-semibold text-gray-900">Tool</th>
                                <th className="text-left p-3 font-semibold text-gray-900">Description</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            <tr>
                                <td className="p-3 font-mono text-blue-600">cronos_block_number</td>
                                <td className="p-3 text-gray-600">Get latest block number</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-blue-600">cronos_get_block</td>
                                <td className="p-3 text-gray-600">Get block details</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-blue-600">cronos_get_balance</td>
                                <td className="p-3 text-gray-600">Get CRO balance for address</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-blue-600">cronos_get_transaction</td>
                                <td className="p-3 text-gray-600">Get transaction details</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-blue-600">cronos_get_nonce</td>
                                <td className="p-3 text-gray-600">Get nonce for address</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-blue-600">cronos_gas_price</td>
                                <td className="p-3 text-gray-600">Get current gas price</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-blue-600">cronos_call_contract</td>
                                <td className="p-3 text-gray-600">Read smart contract</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-blue-600">cronos_token_balance</td>
                                <td className="p-3 text-gray-600">Get ERC-20 token balance</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-blue-600">cronos_get_logs</td>
                                <td className="p-3 text-gray-600">Get contract events/logs</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Relay Core Tools */}
            <section className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    <Zap className="w-6 h-6 inline mr-2 text-purple-600" />
                    Relay Core Service Tools
                </h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="text-left p-3 font-semibold text-gray-900">Tool</th>
                                <th className="text-left p-3 font-semibold text-gray-900">Description</th>
                                <th className="text-left p-3 font-semibold text-gray-900">x402?</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            <tr>
                                <td className="p-3 font-mono text-purple-600">relay_get_prices</td>
                                <td className="p-3 text-gray-600">Multi-source price aggregation</td>
                                <td className="p-3 text-gray-500">No</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-purple-600">relay_discover_services</td>
                                <td className="p-3 text-gray-600">Find services in marketplace</td>
                                <td className="p-3 text-gray-500">No</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-purple-600">relay_get_reputation</td>
                                <td className="p-3 text-gray-600">Get entity reputation</td>
                                <td className="p-3 text-gray-500">No</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-purple-600">relay_invoke_agent</td>
                                <td className="p-3 text-gray-600">Call an agent</td>
                                <td className="p-3 text-green-600 font-semibold">Yes</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-purple-600">relay_x402_info</td>
                                <td className="p-3 text-gray-600">Get payment requirements</td>
                                <td className="p-3 text-gray-500">No</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            {/* PerpAI Tools */}
            <section className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    <Bot className="w-6 h-6 inline mr-2 text-green-600" />
                    PerpAI Trading Tools
                </h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="text-left p-3 font-semibold text-gray-900">Tool</th>
                                <th className="text-left p-3 font-semibold text-gray-900">Description</th>
                                <th className="text-left p-3 font-semibold text-gray-900">Cost</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            <tr>
                                <td className="p-3 font-mono text-green-600">relay_get_quote</td>
                                <td className="p-3 text-gray-600">Get trade quote with venue selection</td>
                                <td className="p-3 text-gray-500">$0.005</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-green-600">relay_venue_rankings</td>
                                <td className="p-3 text-gray-600">Rank trading venues</td>
                                <td className="p-3 text-gray-500">Free</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-green-600">relay_funding_rates</td>
                                <td className="p-3 text-gray-600">Get funding rates across venues</td>
                                <td className="p-3 text-gray-500">Free</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-green-600">ai_analyze</td>
                                <td className="p-3 text-gray-600">Claude-powered market analysis</td>
                                <td className="p-3 text-gray-500">Free*</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                    *Requires CLAUDE_API_KEY environment variable
                </p>
            </section>

            {/* On-Chain Registry Tools */}
            <section className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    <Database className="w-6 h-6 inline mr-2 text-indigo-600" />
                    On-Chain Registry Tools (ERC-8004)
                </h2>
                <p className="text-gray-600 mb-4">
                    Direct read access to deployed smart contracts on Cronos Testnet.
                </p>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="text-left p-3 font-semibold text-gray-900">Tool</th>
                                <th className="text-left p-3 font-semibold text-gray-900">Description</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            <tr>
                                <td className="p-3 font-mono text-indigo-600">relay_contracts</td>
                                <td className="p-3 text-gray-600">Get deployed contract addresses</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-indigo-600">relay_total_agents</td>
                                <td className="p-3 text-gray-600">Get total registered agents count</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-indigo-600">relay_get_agent</td>
                                <td className="p-3 text-gray-600">Get agent details by token ID</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-indigo-600">relay_get_agent_reputation</td>
                                <td className="p-3 text-gray-600">Get on-chain reputation score</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div className="mt-4 bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                    <p className="text-sm text-indigo-800">
                        <strong>Deployed Contracts:</strong><br />
                        IdentityRegistry: <code className="bg-white px-2 py-0.5 rounded text-xs">0x4b697D8ABC0e3dA0086011222755d9029DBB9C43</code><br />
                        ReputationRegistry: <code className="bg-white px-2 py-0.5 rounded text-xs">0xdaFC2fA590C5Ba88155a009660dC3b14A3651a67</code><br />
                        ValidationRegistry: <code className="bg-white px-2 py-0.5 rounded text-xs">0x0483d030a1B1dA819dA08e2b73b01eFD28c67322</code>
                    </p>
                </div>
            </section>

            {/* ACPS Tools */}
            <section className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    <Cpu className="w-6 h-6 inline mr-2 text-amber-600" />
                    ACPS: Agent Payment Sessions
                </h2>
                <p className="text-gray-600 mb-4">
                    Session-based x402 payment abstraction. Fund once, execute many agent actions without wallet popups.
                </p>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="text-left p-3 font-semibold text-gray-900">Tool</th>
                                <th className="text-left p-3 font-semibold text-gray-900">Description</th>
                                <th className="text-left p-3 font-semibold text-gray-900">x402</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            <tr>
                                <td className="p-3 font-mono text-amber-600">relay_escrow_agent</td>
                                <td className="p-3 text-gray-600">Get Escrow Agent info and capabilities</td>
                                <td className="p-3 text-gray-500">No</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-amber-600">relay_session_create</td>
                                <td className="p-3 text-gray-600">Create payment session (returns 402)</td>
                                <td className="p-3 text-green-600 font-semibold">Yes</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-amber-600">relay_session_status</td>
                                <td className="p-3 text-gray-600">Get session balance and state</td>
                                <td className="p-3 text-gray-500">No</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-amber-600">relay_session_can_execute</td>
                                <td className="p-3 text-gray-600">Check if agent can execute</td>
                                <td className="p-3 text-gray-500">No</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-amber-600">relay_session_release</td>
                                <td className="p-3 text-gray-600">Release payment after execution</td>
                                <td className="p-3 text-gray-500">No</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-amber-600">relay_session_refund</td>
                                <td className="p-3 text-gray-600">Refund remaining balance</td>
                                <td className="p-3 text-gray-500">No</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-amber-600">relay_session_close</td>
                                <td className="p-3 text-gray-600">Close session and auto-refund</td>
                                <td className="p-3 text-gray-500">No</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-sm text-amber-800">
                        <strong>Session Flow:</strong> Create session (402) → Deposit USDC → Agents execute autonomously → Payment released on success → Refund unused balance
                    </p>
                </div>
            </section>

            {/* RWA Settlement Tools */}
            <section className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">RWA Settlement Tools</h2>
                <p className="text-gray-600 mb-4">
                    Real-world service verification with SLA-backed escrow payments.
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">4 tools</span>
                </p>
                <div className="overflow-x-auto">
                    <table className="w-full border border-gray-200 rounded-lg overflow-hidden">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="p-3 text-left text-sm font-semibold text-gray-900">Tool</th>
                                <th className="p-3 text-left text-sm font-semibold text-gray-900">Description</th>
                                <th className="p-3 text-left text-sm font-semibold text-gray-900">x402</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            <tr>
                                <td className="p-3 font-mono text-emerald-600">relay_rwa_services</td>
                                <td className="p-3 text-gray-600">List available RWA service types</td>
                                <td className="p-3 text-gray-500">No</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-emerald-600">relay_rwa_register</td>
                                <td className="p-3 text-gray-600">Register service with SLA terms</td>
                                <td className="p-3 text-gray-500">No</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-emerald-600">relay_rwa_execute</td>
                                <td className="p-3 text-gray-600">Request off-chain execution</td>
                                <td className="p-3 text-gray-500">No</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-emerald-600">relay_rwa_settle</td>
                                <td className="p-3 text-gray-600">Settle with proof verification</td>
                                <td className="p-3 text-gray-500">No</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                    <p className="text-sm text-emerald-800">
                        <strong>RWA Flow:</strong> Register service with SLA → Request execution → Provider submits proof → Verify SLA compliance → Payment released or refunded
                    </p>
                </div>
            </section>

            {/* Example Usage */}
            <section className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Example Conversation</h2>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
                    <div className="flex gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm flex-shrink-0">U</div>
                        <div className="flex-1 bg-white border border-gray-200 rounded-lg p-3">
                            What's my wallet balance on Cronos testnet?
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold text-sm flex-shrink-0">C</div>
                        <div className="flex-1">
                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-2 text-sm font-mono text-purple-800">
                                [Uses cronos_get_balance with address: "0x..."]
                            </div>
                            <div className="bg-white border border-gray-200 rounded-lg p-3">
                                Your Cronos testnet balance:
                                <ul className="list-disc ml-4 mt-2 text-gray-600">
                                    <li><strong>CRO:</strong> 145.230000</li>
                                    <li><strong>Network:</strong> cronos_testnet (Chain ID: 338)</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* x402 Payment Flow */}
            <section className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">x402 Payment Flow</h2>
                <p className="text-gray-600 mb-4">
                    When a tool requires payment, it returns payment requirements:
                </p>
                <CodeBlock
                    id="payment-response"
                    code={`{
  "status": "payment_required",
  "x402": {
    "amount": "50000",
    "amountFormatted": "0.05 USDC",
    "token": "USDC",
    "recipient": "0x6985...",
    "network": "cronos_testnet",
    "chainId": 338,
    "resource": "/api/perpai/quote"
  }
}`}
                />
                <p className="text-gray-600 mt-4 mb-2">
                    After payment, retry with <code className="bg-gray-100 px-2 py-1 rounded text-sm">paymentId</code>:
                </p>
                <CodeBlock
                    id="payment-retry"
                    code={`relay_invoke_agent({
  agentId: "relaycore.perp-ai-quote",
  input: { pair: "BTC-USD", side: "long" },
  paymentId: "payment_abc123"
})`}
                />
            </section>

            {/* Environment Variables */}
            <section className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Environment Variables</h2>
                <CodeBlock
                    id="env-vars"
                    code={`# Required
RELAY_CORE_API_URL=http://localhost:4000

# Optional - for AI analysis
CLAUDE_API_KEY=sk-ant-...

# Optional - custom Cronos RPC
CRONOS_RPC_URL=https://evm-t3.cronos.org`}
                />
            </section>

            {/* Next Steps */}
            <section className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Related Documentation</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Link
                        to="/docs/guides/claude"
                        className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
                    >
                        <Terminal className="w-8 h-8 text-purple-600" />
                        <div>
                            <div className="font-semibold text-gray-900">Claude Integration</div>
                            <div className="text-sm text-gray-500">Full Claude setup guide</div>
                        </div>
                    </Link>
                    <Link
                        to="/docs/api/sdk"
                        className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
                    >
                        <Cpu className="w-8 h-8 text-blue-600" />
                        <div>
                            <div className="font-semibold text-gray-900">SDK Documentation</div>
                            <div className="text-sm text-gray-500">Build with JavaScript</div>
                        </div>
                    </Link>
                </div>
            </section>
        </div>
    );
}

export default MCPGuide;
