import React from 'react';
import { Copy, CheckCircle, Terminal } from 'lucide-react';

export default function DocsQuickstart() {
    const [copied, setCopied] = React.useState<string | null>(null);

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
    };

    const CodeBlock = ({ code, language = 'bash', id }: { code: string; language?: string; id: string }) => (
        <div className="relative group">
            <div className="absolute right-3 top-3">
                <button
                    onClick={() => copyToClipboard(code, id)}
                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                    {copied === id ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                        <Copy className="w-4 h-4 text-gray-300" />
                    )}
                </button>
            </div>
            <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                <code className="text-sm text-gray-800">{code}</code>
            </pre>
        </div>
    );

    return (
        <div className="space-y-12">
            {/* Header */}
            <div className="space-y-4">
                <h1 className="text-4xl font-bold text-gray-900">Quickstart</h1>
                <p className="text-xl text-gray-600">
                    Build your first AI-powered trading app with Relay Core in under 10 minutes.
                </p>
            </div>

            {/* Prerequisites */}
            <div className="space-y-4">
                <h2 className="text-2xl font-bold text-gray-900">Prerequisites</h2>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-900 mb-2">Before you begin, make sure you have:</h3>
                    <ul className="space-y-2 text-blue-800">
                        <li className="flex items-center space-x-2">
                            <CheckCircle className="w-4 h-4 flex-shrink-0" />
                            <span>Node.js 18+ and pnpm installed</span>
                        </li>
                        <li className="flex items-center space-x-2">
                            <CheckCircle className="w-4 h-4 flex-shrink-0" />
                            <span>A Cronos testnet wallet with some test CRO</span>
                        </li>
                        <li className="flex items-center space-x-2">
                            <CheckCircle className="w-4 h-4 flex-shrink-0" />
                            <span>An Anthropic API key (get one at console.anthropic.com)</span>
                        </li>
                        <li className="flex items-center space-x-2">
                            <CheckCircle className="w-4 h-4 flex-shrink-0" />
                            <span>Basic knowledge of React and TypeScript</span>
                        </li>
                    </ul>
                </div>
            </div>

            {/* Step 1: Clone */}
            <div className="space-y-4">
                <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                        1
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Clone the Repository</h2>
                </div>
                <p className="text-gray-700">
                    Start by cloning the Relay Core repository and installing dependencies:
                </p>
                <CodeBlock
                    id="clone"
                    code={`git clone https://github.com/relay-core/relay-core.git
cd relay-core
pnpm install`}
                />
            </div>

            {/* Step 2: Environment */}
            <div className="space-y-4">
                <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                        2
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Configure Environment</h2>
                </div>
                <p className="text-gray-700">
                    Create a <code className="px-2 py-1 bg-gray-100 rounded text-sm">.env</code> file in the root directory:
                </p>
                <CodeBlock
                    id="env"
                    language="bash"
                    code={`# Anthropic Claude AI
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here

# Cronos Network
CRONOS_NETWORK=testnet
CRONOS_RPC_URL=https://evm-t3.cronos.org

# x402 Payment Recipient
PAYMENT_RECIPIENT_ADDRESS=0xYourWalletAddress

# Supabase (already configured)
VITE_SUPABASE_URL=https://vartrdfjpicphsxnjsgt.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key`}
                />
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800">
                        <strong>Note:</strong> Replace the placeholder values with your actual API keys and wallet address.
                    </p>
                </div>
            </div>

            {/* Step 3: Start Development */}
            <div className="space-y-4">
                <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                        3
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Start Development Servers</h2>
                </div>
                <p className="text-gray-700">
                    Run both the frontend and backend servers:
                </p>
                <CodeBlock
                    id="dev"
                    code={`# Terminal 1: Frontend
pnpm dev

# Terminal 2: Backend (GraphQL + REST API)
pnpm dev:graphql`}
                />
                <p className="text-gray-700">
                    Your app will be available at:
                </p>
                <ul className="space-y-2 text-gray-700">
                    <li>• Frontend: <code className="px-2 py-1 bg-gray-100 rounded text-sm">http://localhost:5173</code></li>
                    <li>• GraphQL API: <code className="px-2 py-1 bg-gray-100 rounded text-sm">http://localhost:4000</code></li>
                    <li>• REST API: <code className="px-2 py-1 bg-gray-100 rounded text-sm">http://localhost:4001</code></li>
                </ul>
            </div>

            {/* Step 4: Test AI Chat */}
            <div className="space-y-4">
                <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                        4
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Test the AI Chat</h2>
                </div>
                <p className="text-gray-700">
                    Navigate to the dashboard and click the floating chat button in the bottom-right corner:
                </p>
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <ol className="space-y-3 text-gray-700">
                        <li className="flex items-start space-x-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                                1
                            </span>
                            <span>Go to <code className="px-2 py-1 bg-gray-100 rounded text-sm">http://localhost:5173/dashboard</code></span>
                        </li>
                        <li className="flex items-start space-x-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                                2
                            </span>
                            <span>Click the gradient chat button with a pulse indicator</span>
                        </li>
                        <li className="flex items-start space-x-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                                3
                            </span>
                            <span>Try asking: "What's the current BTC price?"</span>
                        </li>
                        <li className="flex items-start space-x-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                                4
                            </span>
                            <span>Claude AI will fetch real-time prices from Crypto.com MCP</span>
                        </li>
                    </ol>
                </div>
            </div>

            {/* Step 5: Execute a Trade */}
            <div className="space-y-4">
                <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                        5
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Execute Your First Trade</h2>
                </div>
                <p className="text-gray-700">
                    Use the AI chat to execute a trade with gasless payment:
                </p>
                <CodeBlock
                    id="trade-example"
                    language="typescript"
                    code={`// In the AI chat, type:
"Open a 5x long position on BTC with $1000"

// Claude AI will:
// 1. Fetch current BTC price from Crypto.com MCP
// 2. Get trade quote from PerpAI router (requires 0.01 USDC payment)
// 3. Show you the best venue (Moonlander, GMX, or Fulcrom)
// 4. Execute the trade after your confirmation (requires 0.05 USDC payment)
// 5. Record the outcome to ERC-8004 Reputation Registry`}
                />
            </div>

            {/* Payment Flow */}
            <div className="space-y-4">
                <h2 className="text-2xl font-bold text-gray-900">Understanding the Payment Flow</h2>
                <p className="text-gray-700">
                    Relay Core uses gasless payments via EIP-3009 and Cronos x402 Facilitator:
                </p>
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
                    <ol className="space-y-4 text-gray-700">
                        <li className="flex items-start space-x-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                                1
                            </span>
                            <div>
                                <strong>Request Trade Quote</strong>
                                <p className="text-sm text-gray-600 mt-1">
                                    Backend returns 402 Payment Required with payment details (0.01 USDC)
                                </p>
                            </div>
                        </li>
                        <li className="flex items-start space-x-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                                2
                            </span>
                            <div>
                                <strong>Sign Authorization</strong>
                                <p className="text-sm text-gray-600 mt-1">
                                    You sign an EIP-712 message (no gas needed)
                                </p>
                            </div>
                        </li>
                        <li className="flex items-start space-x-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                                3
                            </span>
                            <div>
                                <strong>Facilitator Executes</strong>
                                <p className="text-sm text-gray-600 mt-1">
                                    Cronos x402 Facilitator executes the transfer and pays gas
                                </p>
                            </div>
                        </li>
                        <li className="flex items-start space-x-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                                4
                            </span>
                            <div>
                                <strong>Get Quote</strong>
                                <p className="text-sm text-gray-600 mt-1">
                                    Backend verifies payment and returns trade quote
                                </p>
                            </div>
                        </li>
                    </ol>
                </div>
            </div>

            {/* Next Steps */}
            <div className="space-y-4">
                <h2 className="text-2xl font-bold text-gray-900">Next Steps</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <a
                        href="/docs/architecture"
                        className="p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
                    >
                        <h3 className="font-semibold text-gray-900 mb-2">Learn the Architecture</h3>
                        <p className="text-sm text-gray-600">
                            Understand how Relay Core combines AI, payments, and reputation
                        </p>
                    </a>

                    <a
                        href="/docs/api/rest"
                        className="p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
                    >
                        <h3 className="font-semibold text-gray-900 mb-2">Explore the API</h3>
                        <p className="text-sm text-gray-600">
                            Complete API reference for all endpoints and methods
                        </p>
                    </a>

                    <a
                        href="/docs/guides/x402"
                        className="p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
                    >
                        <h3 className="font-semibold text-gray-900 mb-2">Integrate x402 Payments</h3>
                        <p className="text-sm text-gray-600">
                            Add gasless payments to your own endpoints
                        </p>
                    </a>

                    <a
                        href="/docs/examples/trade"
                        className="p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
                    >
                        <h3 className="font-semibold text-gray-900 mb-2">View Code Examples</h3>
                        <p className="text-sm text-gray-600">
                            Working examples for common use cases
                        </p>
                    </a>
                </div>
            </div>

            {/* Help */}
            <div className="bg-gray-900 text-white rounded-xl p-8">
                <h2 className="text-2xl font-bold mb-4">Need Help?</h2>
                <p className="text-gray-300 mb-6">
                    Join our Discord community for support, discussions, and updates.
                </p>
                <a
                    href="https://discord.gg/relaycore"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
                >
                    <Terminal className="w-5 h-5" />
                    <span>Join Discord</span>
                </a>
            </div>
        </div>
    );
}
