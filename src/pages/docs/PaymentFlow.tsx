export default function DocsPaymentFlow() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-4">Payment Flow</h1>
                <p className="text-lg text-gray-600">
                    Understanding how x402 and EIP-3009 work together for gasless payments.
                </p>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Overview</h2>
                <p className="text-gray-700">
                    Relay Core uses a two-layer payment system that eliminates gas fees for users while maintaining security and decentralization.
                </p>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">HTTP 402 Payment Required</h2>
                <p className="text-gray-700">
                    When you request a paid endpoint like <code className="px-2 py-1 bg-gray-100 rounded text-sm">/api/trade/quote</code>,
                    the server returns a 402 status code with payment requirements:
                </p>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`HTTP/1.1 402 Payment Required
Content-Type: application/json

{
  "scheme": "exact",
  "network": "cronos-testnet",
  "payTo": "0x...",
  "asset": "0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0",
  "maxAmountRequired": "10000",
  "maxTimeoutSeconds": 300
}`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">EIP-3009 Authorization</h2>
                <p className="text-gray-700">
                    Instead of sending a transaction, you sign an EIP-712 message authorizing the transfer:
                </p>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`const authorization = {
  from: userAddress,
  to: paymentRecipient,
  value: amount,
  validAfter: 0,
  validBefore: Math.floor(Date.now() / 1000) + 300,
  nonce: randomNonce()
};

const signature = await signer._signTypedData(
  domain,
  types,
  authorization
);`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Facilitator Execution</h2>
                <p className="text-gray-700">
                    The Cronos x402 Facilitator executes the transfer on your behalf:
                </p>
                <ol className="space-y-3 text-gray-700">
                    <li className="flex items-start gap-3">
                        <span className="font-semibold">1.</span>
                        <span>Receives your signed authorization</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="font-semibold">2.</span>
                        <span>Calls USDC.e contract's transferWithAuthorization function</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="font-semibold">3.</span>
                        <span>Pays the gas fee from its own wallet</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="font-semibold">4.</span>
                        <span>Returns payment proof to include in retry request</span>
                    </li>
                </ol>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Complete Flow</h2>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                    <ol className="space-y-4 text-gray-700">
                        <li><strong>Step 1:</strong> Request endpoint → Receive 402 with payment requirements</li>
                        <li><strong>Step 2:</strong> Sign EIP-712 authorization (no gas needed)</li>
                        <li><strong>Step 3:</strong> Submit to Facilitator → Facilitator executes transfer</li>
                        <li><strong>Step 4:</strong> Retry request with X-Payment header → Get response</li>
                    </ol>
                </div>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Network Configuration</h2>
                <div className="space-y-4">
                    <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-2">Testnet</h3>
                        <ul className="space-y-1 text-sm text-gray-600">
                            <li>Chain ID: 338</li>
                            <li>RPC: https://evm-t3.cronos.org</li>
                            <li>USDC.e: 0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0</li>
                            <li>Facilitator: https://facilitator.cronoslabs.org/v2/x402</li>
                        </ul>
                    </div>
                    <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-2">Mainnet</h3>
                        <ul className="space-y-1 text-sm text-gray-600">
                            <li>Chain ID: 25</li>
                            <li>RPC: https://evm.cronos.org</li>
                            <li>USDC.e: 0xf951eC28187D9E5Ca673Da8FE6757E6f0Be5F77C</li>
                            <li>Facilitator: https://facilitator.cronoslabs.org/v2/x402</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
