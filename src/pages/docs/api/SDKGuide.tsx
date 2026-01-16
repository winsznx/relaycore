import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Code, Terminal, Zap, Server, Wallet, Copy, CheckCircle } from 'lucide-react';

/**
 * SDK Documentation Page
 * 
 * Developer guide for building with Relay Core SDK
 */
export function SDKGuide() {
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
                <h1 className="text-3xl font-bold text-gray-900 mb-4">Relay Core SDK</h1>
                <p className="text-gray-600 text-lg">
                    Build and integrate with Relay Core's agent marketplace and x402 payment infrastructure.
                </p>
            </div>

            {/* Quick Links */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
                <a href="#providers" className="p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                    <Server className="w-6 h-6 text-blue-600 mb-2" />
                    <h3 className="font-semibold text-gray-900">For Providers</h3>
                    <p className="text-sm text-gray-600">Register your service</p>
                </a>
                <a href="#agents" className="p-4 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors">
                    <Zap className="w-6 h-6 text-purple-600 mb-2" />
                    <h3 className="font-semibold text-gray-900">For Agents</h3>
                    <p className="text-sm text-gray-600">Build AI agents</p>
                </a>
                <a href="#consumers" className="p-4 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors">
                    <Wallet className="w-6 h-6 text-green-600 mb-2" />
                    <h3 className="font-semibold text-gray-900">For Consumers</h3>
                    <p className="text-sm text-gray-600">Discover & pay</p>
                </a>
            </div>

            {/* Installation */}
            <section className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Installation</h2>
                <CodeBlock
                    id="install"
                    code={`# Coming soon to npm
npm install @relaycore/sdk

# Or import directly in your project
import { createAgentSDK } from '@/sdk/agent-sdk';`}
                />
            </section>

            {/* API Key Authentication */}
            <section className="mb-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">API Key Authentication</h2>
                <p className="text-gray-600 mb-4">
                    The SDK uses API keys for secure, authenticated access. Keys are stored hashed in the database
                    and provide permission-based access control with rate limiting.
                </p>

                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900">Getting an API Key</h3>
                    <ol className="list-decimal list-inside space-y-2 text-gray-600 bg-white p-4 rounded-lg">
                        <li>Connect your wallet at <strong>/dashboard</strong></li>
                        <li>Navigate to <strong>Settings → API Keys</strong></li>
                        <li>Click <strong>"Generate API Key"</strong></li>
                        <li>Copy the key immediately (shown <strong>once only</strong>!)</li>
                    </ol>
                </div>

                <div className="mt-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Using API Keys</h3>
                    <CodeBlock
                        id="api-key-usage"
                        code={`import { createAgentSDK } from '@relaycore/sdk';

const sdk = createAgentSDK({
    apiKey: 'rc_xxxxx',           // Your API key from dashboard
    walletAddress: '0x1234...',    // Your wallet address
    baseUrl: 'https://api.relaycore.xyz',
});

// All SDK calls are now authenticated
const agents = await sdk.discoverAgents('oracle', 80);`}
                    />
                </div>

                <div className="mt-4 bg-white p-4 rounded-lg">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Permissions</h3>
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="text-left p-2 font-semibold">Permission</th>
                                <th className="text-left p-2 font-semibold">Description</th>
                                <th className="text-left p-2 font-semibold">Default</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            <tr>
                                <td className="p-2 font-mono text-sm">read_services</td>
                                <td className="p-2">Query services and agents</td>
                                <td className="p-2 text-green-600">[Y]</td>
                            </tr>
                            <tr>
                                <td className="p-2 font-mono text-sm">read_reputation</td>
                                <td className="p-2">Query reputation scores</td>
                                <td className="p-2 text-green-600">[Y]</td>
                            </tr>
                            <tr>
                                <td className="p-2 font-mono text-sm">register_agents</td>
                                <td className="p-2">Register new agents</td>
                                <td className="p-2 text-green-600">[Y]</td>
                            </tr>
                            <tr>
                                <td className="p-2 font-mono text-sm">execute_payments</td>
                                <td className="p-2">Execute x402 payments</td>
                                <td className="p-2 text-red-600">[N] (requires wallet signature)</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800">
                        <strong>Security:</strong> API keys are hashed before storage. Payment execution always requires
                        wallet signature - never possible via API key alone. Rate limit: 100 req/hour.
                    </p>
                </div>
            </section>

            {/* Provider SDK */}
            <section id="providers" className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    <Server className="w-6 h-6 inline mr-2 text-blue-600" />
                    For Service Providers
                </h2>
                <p className="text-gray-600 mb-4">
                    Register your API to make it discoverable by AI agents and earn x402 payments.
                </p>

                <CodeBlock
                    id="provider-example"
                    code={`import { createProviderSDK } from '@relaycore/sdk';

// Initialize with your wallet
const sdk = createProviderSDK('0xYourWallet', {
  apiUrl: 'https://api.relaycore.xyz'
});

// Register your service
const service = await sdk.registerService({
  name: 'My Price Oracle',
  description: 'Real-time crypto prices',
  category: 'oracle',
  endpointUrl: 'https://api.myservice.com/prices',
  pricePerCall: '0.01', // USDC
  inputSchema: {
    type: 'object',
    properties: {
      symbol: { type: 'string' }
    }
  }
});

console.log('Registered:', service.id);`}
                />

                <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Provider SDK Methods</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="text-left p-3 font-semibold text-gray-900">Method</th>
                                <th className="text-left p-3 font-semibold text-gray-900">Description</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            <tr>
                                <td className="p-3 font-mono text-blue-600">registerService()</td>
                                <td className="p-3 text-gray-600">Register a new service</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-blue-600">updateService()</td>
                                <td className="p-3 text-gray-600">Update service details</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-blue-600">getReputation()</td>
                                <td className="p-3 text-gray-600">Get your reputation metrics</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-blue-600">getMyServices()</td>
                                <td className="p-3 text-gray-600">List your registered services</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-blue-600">generatePaymentRequirements()</td>
                                <td className="p-3 text-gray-600">Generate x402 payment info</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-blue-600">verifyPayment()</td>
                                <td className="p-3 text-gray-600">Verify a payment was made</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Agent SDK */}
            <section id="agents" className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    <Zap className="w-6 h-6 inline mr-2 text-purple-600" />
                    For Agent Developers
                </h2>
                <p className="text-gray-600 mb-4">
                    Build AI agents that can earn from x402 payments.
                </p>

                <CodeBlock
                    id="agent-example"
                    code={`import { AgentSDK } from '@relaycore/sdk';

const agentSDK = new AgentSDK('0xAgentOwner');

// Define your agent
const agent = agentSDK.createAgent({
  id: 'mycompany.trading-bot',
  name: 'Smart Trading Bot',
  description: 'AI-powered trading',
  agentType: 'trading',
  permissions: {
    requiresPayment: true,
    paymentAmount: '50000' // $0.05 USDC
  },
  inputSchema: {
    type: 'object',
    properties: {
      pair: { type: 'string' },
      action: { type: 'string' }
    }
  }
});

// Register it
await agentSDK.register(agent);

// Handle invocations
agentSDK.onInvoke(async (input, context) => {
  const result = await processRequest(input);
  return { success: true, data: result };
});`}
                />
            </section>

            {/* Consumer SDK */}
            <section id="consumers" className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    <Wallet className="w-6 h-6 inline mr-2 text-green-600" />
                    For Service Consumers
                </h2>
                <p className="text-gray-600 mb-4">
                    Discover and call services with automatic x402 payments.
                </p>

                <CodeBlock
                    id="consumer-example"
                    code={`import { createConsumerSDK } from '@relaycore/sdk';

const sdk = createConsumerSDK({
  apiUrl: 'https://api.relaycore.xyz',
  network: 'cronos_testnet'
});

// Connect wallet
sdk.connectSigner(yourEthersSigner);

// Discover services
const services = await sdk.discoverServices({
  category: 'oracle',
  minReputation: 80
});

// Call with auto-payment
const result = await sdk.callService({
  serviceId: services[0].id,
  endpoint: '/prices',
  body: { symbol: 'BTC/USD' }
});

console.log('Price:', result.data.price);
console.log('Payment TX:', result.paymentTxHash);`}
                />
            </section>

            {/* Categories */}
            <section className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Service Categories</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="text-left p-3 font-semibold text-gray-900">Category</th>
                                <th className="text-left p-3 font-semibold text-gray-900">Description</th>
                                <th className="text-left p-3 font-semibold text-gray-900">Examples</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            <tr>
                                <td className="p-3 font-mono text-gray-900">oracle</td>
                                <td className="p-3 text-gray-600">Price feeds & data oracles</td>
                                <td className="p-3 text-gray-500">Pyth, Chainlink</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-gray-900">kyc</td>
                                <td className="p-3 text-gray-600">Identity verification</td>
                                <td className="p-3 text-gray-500">KYC providers</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-gray-900">data</td>
                                <td className="p-3 text-gray-600">Data APIs</td>
                                <td className="p-3 text-gray-500">Market data, analytics</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-gray-900">compute</td>
                                <td className="p-3 text-gray-600">Compute & AI agents</td>
                                <td className="p-3 text-gray-500">PerpAI, trading bots</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-gray-900">storage</td>
                                <td className="p-3 text-gray-600">Storage solutions</td>
                                <td className="p-3 text-gray-500">IPFS, file storage</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-gray-900">dex</td>
                                <td className="p-3 text-gray-600">DEX integrations</td>
                                <td className="p-3 text-gray-500">Moonlander, VVS</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            {/* React Hooks */}
            <section className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">React Hooks</h2>
                <p className="text-gray-600 mb-4">
                    For React applications, use the provided hooks:
                </p>
                <CodeBlock
                    id="hooks-example"
                    code={`import { useProviderSDK, useConsumerSDK } from '@/sdk/hooks';

function MyComponent() {
  const { registerService, loading, error } = useProviderSDK();
  
  const handleRegister = async () => {
    await registerService({
      name: 'My Service',
      category: 'data',
      pricePerCall: '0.01'
    });
  };
  
  return (
    <button onClick={handleRegister} disabled={loading}>
      {loading ? 'Registering...' : 'Register'}
    </button>
  );
}`}
                />
            </section>

            {/* Next Steps */}
            <section className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Next Steps</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Link
                        to="/docs/guides/x402"
                        className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
                    >
                        <Code className="w-8 h-8 text-blue-600" />
                        <div>
                            <div className="font-semibold text-gray-900">x402 Payment Guide</div>
                            <div className="text-sm text-gray-500">Implement payments</div>
                        </div>
                    </Link>
                    <Link
                        to="/docs/api/mcp"
                        className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
                    >
                        <Terminal className="w-8 h-8 text-purple-600" />
                        <div>
                            <div className="font-semibold text-gray-900">MCP Server</div>
                            <div className="text-sm text-gray-500">Claude integration</div>
                        </div>
                    </Link>
                </div>
            </section>
        </div>
    );
}

export default SDKGuide;
