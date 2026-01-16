import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Wallet, Zap, Shield, RefreshCw, CheckCircle, Copy, Bot } from 'lucide-react';

/**
 * ACPS Guide Page
 * 
 * Agent-Controlled Payment Sessions documentation
 */
export function ACPSGuide() {
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
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-amber-100 rounded-xl">
                        <Wallet className="w-8 h-8 text-amber-600" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Agent Payment Sessions</h1>
                        <p className="text-amber-600 font-medium">ACPS</p>
                    </div>
                </div>
                <p className="text-gray-600 text-lg">
                    Session-based x402 payment abstraction for autonomous agent execution.
                    Fund once, execute many agent actions without wallet popups.
                </p>
            </div>

            {/* Key Benefits */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
                <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl">
                    <Wallet className="w-6 h-6 text-amber-600 mb-2" />
                    <div className="font-semibold text-gray-900">One Funding</div>
                    <div className="text-sm text-gray-500">Single wallet approval</div>
                </div>
                <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl">
                    <Zap className="w-6 h-6 text-green-600 mb-2" />
                    <div className="font-semibold text-gray-900">Many Actions</div>
                    <div className="text-sm text-gray-500">Autonomous execution</div>
                </div>
                <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
                    <Shield className="w-6 h-6 text-blue-600 mb-2" />
                    <div className="font-semibold text-gray-900">Safe Escrow</div>
                    <div className="text-sm text-gray-500">Funds protected</div>
                </div>
                <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-xl">
                    <RefreshCw className="w-6 h-6 text-purple-600 mb-2" />
                    <div className="font-semibold text-gray-900">Auto Refund</div>
                    <div className="text-sm text-gray-500">Unused balance returned</div>
                </div>
            </div>

            {/* How It Works */}
            <section className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">How It Works</h2>
                <div className="relative">
                    <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-amber-200"></div>
                    <div className="space-y-6">
                        {/* Step 1 */}
                        <div className="relative flex gap-4">
                            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 font-bold z-10">1</div>
                            <div className="flex-1 bg-white border border-gray-200 rounded-lg p-4">
                                <h3 className="font-semibold text-gray-900 mb-2">Create Session</h3>
                                <p className="text-gray-600 text-sm mb-3">
                                    Agent or user requests a session with max spend and duration.
                                    Returns 402 Payment Required.
                                </p>
                                <CodeBlock
                                    id="step1"
                                    code={`relay_session_create({
  maxSpend: "100",
  durationHours: 24,
  authorizedAgents: ["0x...perpai", "0x...aggregator"]
})`}
                                />
                            </div>
                        </div>

                        {/* Step 2 */}
                        <div className="relative flex gap-4">
                            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 font-bold z-10">2</div>
                            <div className="flex-1 bg-white border border-gray-200 rounded-lg p-4">
                                <h3 className="font-semibold text-gray-900 mb-2">Deposit USDC</h3>
                                <p className="text-gray-600 text-sm">
                                    User approves USDC and deposits to escrow contract.
                                    This is the only wallet interaction needed.
                                </p>
                            </div>
                        </div>

                        {/* Step 3 */}
                        <div className="relative flex gap-4">
                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold z-10">3</div>
                            <div className="flex-1 bg-white border border-gray-200 rounded-lg p-4">
                                <h3 className="font-semibold text-gray-900 mb-2">Agents Execute</h3>
                                <p className="text-gray-600 text-sm mb-3">
                                    Authorized agents execute actions. Escrow Agent validates each request
                                    and releases payment only on success.
                                </p>
                                <div className="flex items-center gap-2 text-sm">
                                    <Bot className="w-4 h-4 text-green-600" />
                                    <span className="text-gray-600">No wallet popups during execution</span>
                                </div>
                            </div>
                        </div>

                        {/* Step 4 */}
                        <div className="relative flex gap-4">
                            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold z-10">4</div>
                            <div className="flex-1 bg-white border border-gray-200 rounded-lg p-4">
                                <h3 className="font-semibold text-gray-900 mb-2">Failure Handling</h3>
                                <p className="text-gray-600 text-sm">
                                    If execution fails, payment is NOT released. Funds remain in escrow.
                                    Agent can retry or move to next action.
                                </p>
                            </div>
                        </div>

                        {/* Step 5 */}
                        <div className="relative flex gap-4">
                            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold z-10">5</div>
                            <div className="flex-1 bg-white border border-gray-200 rounded-lg p-4">
                                <h3 className="font-semibold text-gray-900 mb-2">Session Close</h3>
                                <p className="text-gray-600 text-sm">
                                    When session ends or user cancels, remaining balance is automatically
                                    refunded to owner.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Agent to Agent */}
            <section className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Agent-to-Agent Payments</h2>
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-white rounded-lg border border-green-200">
                                <Bot className="w-5 h-5 text-green-600" />
                            </div>
                            <span className="font-medium text-gray-900">PerpAI</span>
                        </div>
                        <div className="flex-1 border-t-2 border-dashed border-green-300 relative">
                            <span className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-green-100 px-2 text-xs text-green-700">pays</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-white rounded-lg border border-green-200">
                                <Bot className="w-5 h-5 text-green-600" />
                            </div>
                            <span className="font-medium text-gray-900">Aggregator</span>
                        </div>
                    </div>
                    <p className="text-gray-600 text-sm">
                        Agents can pay other agents directly from a session. No human intervention.
                        Escrow Agent validates authorization and releases funds automatically.
                    </p>
                </div>
            </section>

            {/* MCP Tools */}
            <section className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">MCP Tools</h2>
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
                                <td className="p-3 font-mono text-amber-600">relay_escrow_agent</td>
                                <td className="p-3 text-gray-600">Get Escrow Agent info and capabilities</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-amber-600">relay_session_create</td>
                                <td className="p-3 text-gray-600">Create new payment session</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-amber-600">relay_session_status</td>
                                <td className="p-3 text-gray-600">Check session balance and state</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-amber-600">relay_session_can_execute</td>
                                <td className="p-3 text-gray-600">Verify agent can execute with amount</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-amber-600">relay_session_release</td>
                                <td className="p-3 text-gray-600">Release payment after successful execution</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-amber-600">relay_session_refund</td>
                                <td className="p-3 text-gray-600">Refund remaining balance to owner</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-amber-600">relay_session_close</td>
                                <td className="p-3 text-gray-600">Close session and auto-refund</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Smart Contract */}
            <section className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Smart Contract</h2>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-3">
                        <strong>Location:</strong> <code className="bg-white px-2 py-0.5 rounded">contracts/EscrowSession.sol</code>
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                        <div className="bg-white border border-gray-200 rounded p-2">
                            <code className="text-amber-600">createSession()</code>
                        </div>
                        <div className="bg-white border border-gray-200 rounded p-2">
                            <code className="text-amber-600">deposit()</code>
                        </div>
                        <div className="bg-white border border-gray-200 rounded p-2">
                            <code className="text-amber-600">release()</code>
                        </div>
                        <div className="bg-white border border-gray-200 rounded p-2">
                            <code className="text-amber-600">refund()</code>
                        </div>
                        <div className="bg-white border border-gray-200 rounded p-2">
                            <code className="text-amber-600">closeSession()</code>
                        </div>
                        <div className="bg-white border border-gray-200 rounded p-2">
                            <code className="text-amber-600">remainingBalance()</code>
                        </div>
                    </div>
                </div>
            </section>

            {/* Related */}
            <section className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Related</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Link
                        to="/docs/guides/x402"
                        className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:border-amber-500 hover:shadow-md transition-all"
                    >
                        <Wallet className="w-8 h-8 text-amber-600" />
                        <div>
                            <div className="font-semibold text-gray-900">x402 Protocol</div>
                            <div className="text-sm text-gray-500">Payment flow basics</div>
                        </div>
                    </Link>
                    <Link
                        to="/docs/api/mcp"
                        className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:border-amber-500 hover:shadow-md transition-all"
                    >
                        <Zap className="w-8 h-8 text-purple-600" />
                        <div>
                            <div className="font-semibold text-gray-900">MCP Server</div>
                            <div className="text-sm text-gray-500">All 49 tools</div>
                        </div>
                    </Link>
                </div>
            </section>
        </div>
    );
}

export default ACPSGuide;
