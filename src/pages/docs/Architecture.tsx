export default function DocsArchitecture() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-4">Architecture</h1>
                <p className="text-lg text-gray-600">
                    Understanding how Relay Core components work together.
                </p>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">System Overview</h2>
                <p className="text-gray-700">
                    Relay Core combines four main components to create a seamless AI-powered trading experience:
                </p>
                <ul className="space-y-3 text-gray-700">
                    <li className="flex items-start gap-3">
                        <span className="font-semibold text-gray-900">1. AI Layer:</span>
                        <span>Claude AI processes natural language and executes trading logic</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="font-semibold text-gray-900">2. Payment Layer:</span>
                        <span>x402 protocol and EIP-3009 enable gasless payments</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="font-semibold text-gray-900">3. Reputation Layer:</span>
                        <span>ERC-8004 registries track agent performance on-chain</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="font-semibold text-gray-900">4. Trading Layer:</span>
                        <span>Multi-venue routing across Cronos DEXs</span>
                    </li>
                </ul>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Component Interaction</h2>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                    <p className="text-gray-700 mb-4">User Request Flow:</p>
                    <ol className="space-y-2 text-gray-700">
                        <li>1. User sends message to AI chat</li>
                        <li>2. Claude AI analyzes intent and fetches market data</li>
                        <li>3. System requests trade quote (requires payment)</li>
                        <li>4. User signs gasless payment authorization</li>
                        <li>5. Trade executes on best venue</li>
                        <li>6. Outcome recorded to reputation registry</li>
                    </ol>
                </div>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Network Architecture</h2>
                <div className="space-y-4">
                    <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-2">Cronos EVM (Chain 338/25)</h3>
                        <p className="text-sm text-gray-600">Handles x402 payments and USDC.e transfers</p>
                    </div>
                    <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-2">Cronos zkEVM (Chain 240/388)</h3>
                        <p className="text-sm text-gray-600">Hosts ERC-8004 registries for agent identity and reputation</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
