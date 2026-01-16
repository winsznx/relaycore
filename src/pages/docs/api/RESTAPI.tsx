export default function DocsRESTAPI() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-4">REST API Reference</h1>
                <p className="text-lg text-gray-600">
                    Complete reference for all REST API endpoints.
                </p>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Base URL</h2>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <code className="text-sm text-gray-800">http://localhost:4001/api</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Authentication</h2>
                <p className="text-gray-700">
                    Paid endpoints require x402 payment. Include payment proof in X-Payment header.
                </p>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Endpoints</h2>

                <div className="border border-gray-200 rounded-lg p-6 space-y-4">
                    <div className="flex items-center gap-3">
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded font-mono text-sm">POST</span>
                        <code className="text-gray-900">/trade/quote</code>
                    </div>
                    <p className="text-gray-700">Get trade quote from best venue</p>
                    <div className="space-y-2">
                        <p className="text-sm font-semibold text-gray-900">Request Body:</p>
                        <pre className="bg-gray-50 border border-gray-200 rounded p-3 text-xs overflow-x-auto">
                            <code className="text-gray-800">{`{
  "pair": "BTC-USD",
  "side": "long",
  "leverage": 5,
  "sizeUsd": 1000,
  "maxSlippage": 0.5
}`}</code>
                        </pre>
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm font-semibold text-gray-900">Response:</p>
                        <pre className="bg-gray-50 border border-gray-200 rounded p-3 text-xs overflow-x-auto">
                            <code className="text-gray-800">{`{
  "bestVenue": {
    "name": "Moonlander",
    "expectedPrice": 45234.50,
    "expectedSlippage": 0.2,
    "liquidationPrice": 36187.60
  },
  "alternativeVenues": [...]
}`}</code>
                        </pre>
                    </div>
                    <p className="text-sm text-gray-600">Cost: 0.01 USDC</p>
                </div>

                <div className="border border-gray-200 rounded-lg p-6 space-y-4">
                    <div className="flex items-center gap-3">
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded font-mono text-sm">POST</span>
                        <code className="text-gray-900">/trade/execute</code>
                    </div>
                    <p className="text-gray-700">Execute trade on selected venue</p>
                    <div className="space-y-2">
                        <p className="text-sm font-semibold text-gray-900">Request Body:</p>
                        <pre className="bg-gray-50 border border-gray-200 rounded p-3 text-xs overflow-x-auto">
                            <code className="text-gray-800">{`{
  "pair": "BTC-USD",
  "side": "long",
  "leverage": 5,
  "sizeUsd": 1000,
  "userAddress": "0x...",
  "stopLoss": 40000,
  "takeProfit": 50000
}`}</code>
                        </pre>
                    </div>
                    <p className="text-sm text-gray-600">Cost: 0.05 USDC</p>
                </div>

                <div className="border border-gray-200 rounded-lg p-6 space-y-4">
                    <div className="flex items-center gap-3">
                        <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded font-mono text-sm">POST</span>
                        <code className="text-gray-900">/chat</code>
                    </div>
                    <p className="text-gray-700">Chat with AI trading assistant</p>
                    <div className="space-y-2">
                        <p className="text-sm font-semibold text-gray-900">Request Body:</p>
                        <pre className="bg-gray-50 border border-gray-200 rounded p-3 text-xs overflow-x-auto">
                            <code className="text-gray-800">{`{
  "message": "What's the BTC price?",
  "walletAddress": "0x...",
  "conversationHistory": []
}`}</code>
                        </pre>
                    </div>
                    <p className="text-sm text-gray-600">Cost: FREE</p>
                </div>

                <div className="border border-gray-200 rounded-lg p-6 space-y-4">
                    <div className="flex items-center gap-3">
                        <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded font-mono text-sm">POST</span>
                        <code className="text-gray-900">/pay</code>
                    </div>
                    <p className="text-gray-700">x402 payment settlement endpoint</p>
                    <div className="space-y-2">
                        <p className="text-sm font-semibold text-gray-900">Request Body:</p>
                        <pre className="bg-gray-50 border border-gray-200 rounded p-3 text-xs overflow-x-auto">
                            <code className="text-gray-800">{`{
  "paymentProof": "0x...",
  "network": "cronos-testnet"
}`}</code>
                        </pre>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Error Responses</h2>
                <div className="space-y-4">
                    <div className="border border-gray-200 rounded-lg p-4">
                        <p className="font-semibold text-gray-900 mb-2">402 Payment Required</p>
                        <pre className="bg-gray-50 border border-gray-200 rounded p-3 text-xs">
                            <code className="text-gray-800">{`{
  "scheme": "exact",
  "network": "cronos-testnet",
  "payTo": "0x...",
  "asset": "0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0",
  "maxAmountRequired": "10000",
  "maxTimeoutSeconds": 300
}`}</code>
                        </pre>
                    </div>
                    <div className="border border-gray-200 rounded-lg p-4">
                        <p className="font-semibold text-gray-900 mb-2">400 Bad Request</p>
                        <pre className="bg-gray-50 border border-gray-200 rounded p-3 text-xs">
                            <code className="text-gray-800">{`{
  "error": "Missing required parameters"
}`}</code>
                        </pre>
                    </div>
                </div>
            </div>
        </div>
    );
}
