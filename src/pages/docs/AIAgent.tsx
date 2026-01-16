export default function DocsAIAgent() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-4">AI Trading Agent</h1>
                <p className="text-lg text-gray-600">
                    How Claude AI powers intelligent trading decisions using Model Context Protocol.
                </p>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Architecture</h2>
                <p className="text-gray-700">
                    The AI agent uses Anthropic's Claude Sonnet 4 with tool calling capabilities to process natural language requests and execute trading operations.
                </p>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Available Tools</h2>
                <div className="space-y-4">
                    <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-2">get_crypto_price</h3>
                        <p className="text-sm text-gray-600 mb-2">Fetches real-time cryptocurrency prices via Crypto.com MCP</p>
                        <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs overflow-x-auto">
                            <code>{`{
  "symbol": "BTC",
  "currency": "USD"
}`}</code>
                        </pre>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-2">get_trade_quote</h3>
                        <p className="text-sm text-gray-600 mb-2">Gets best execution quote across all venues</p>
                        <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs overflow-x-auto">
                            <code>{`{
  "pair": "BTC-USD",
  "side": "long",
  "leverage": 5,
  "sizeUsd": 1000
}`}</code>
                        </pre>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-2">execute_trade</h3>
                        <p className="text-sm text-gray-600 mb-2">Executes trade on best venue after user confirmation</p>
                        <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs overflow-x-auto">
                            <code>{`{
  "pair": "BTC-USD",
  "side": "long",
  "leverage": 5,
  "sizeUsd": 1000,
  "userAddress": "0x..."
}`}</code>
                        </pre>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-2">get_venue_reputation</h3>
                        <p className="text-sm text-gray-600 mb-2">Retrieves reputation data for trading venues</p>
                        <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs overflow-x-auto">
                            <code>{`{
  "venueId": "moonlander"
}`}</code>
                        </pre>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Conversation Flow</h2>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                    <ol className="space-y-3 text-gray-700">
                        <li><strong>User:</strong> "What's the current BTC price?"</li>
                        <li><strong>Claude:</strong> Calls get_crypto_price tool</li>
                        <li><strong>MCP:</strong> Returns real-time price data</li>
                        <li><strong>Claude:</strong> "Bitcoin is currently trading at $45,234"</li>
                    </ol>
                </div>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Integration Example</h2>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const response = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 4096,
  tools: [
    {
      name: 'get_crypto_price',
      description: 'Get real-time cryptocurrency price',
      input_schema: {
        type: 'object',
        properties: {
          symbol: { type: 'string' },
          currency: { type: 'string' }
        }
      }
    }
  ],
  messages: [
    { role: 'user', content: message }
  ]
});`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Safety Features</h2>
                <ul className="space-y-3 text-gray-700">
                    <li className="flex items-start gap-3">
                        <span className="text-gray-400">•</span>
                        <span><strong>User Confirmation:</strong> All trades require explicit user approval</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="text-gray-400">•</span>
                        <span><strong>Wallet Verification:</strong> Trades only execute for connected wallets</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="text-gray-400">•</span>
                        <span><strong>Payment Required:</strong> Quote and execution require x402 payments</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="text-gray-400">•</span>
                        <span><strong>Validation:</strong> High-value trades automatically request independent validation</span>
                    </li>
                </ul>
            </div>
        </div>
    );
}
