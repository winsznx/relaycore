export default function DocsReputation() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-4">Reputation System</h1>
                <p className="text-lg text-gray-600">
                    On-chain reputation tracking using ERC-8004 registries on Cronos zkEVM.
                </p>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Three Registry System</h2>
                <p className="text-gray-700">
                    Relay Core uses three interconnected smart contracts to track agent reputation:
                </p>
                <div className="space-y-4">
                    <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-2">Identity Registry (ERC-721)</h3>
                        <p className="text-sm text-gray-600">
                            Each agent is represented as a unique NFT. The token ID becomes the agent's permanent identifier across all registries.
                        </p>
                    </div>
                    <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-2">Reputation Registry</h3>
                        <p className="text-sm text-gray-600">
                            Records feedback after each trade. Tracks success rate, execution quality, and calculates composite scores.
                        </p>
                    </div>
                    <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-2">Validation Registry</h3>
                        <p className="text-sm text-gray-600">
                            Independent validators verify high-value trades (&gt;$10,000) to ensure execution quality and prevent manipulation.
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Score Calculation</h2>
                <p className="text-gray-700">
                    Trade scores are calculated using a weighted formula:
                </p>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`function calculateTradeScore(trade) {
  const successWeight = 40;
  const slippageWeight = 30;
  const executionWeight = 20;
  const priceImpactWeight = 10;

  const successScore = trade.success ? 100 : 0;
  const slippageScore = Math.max(0, 100 - (trade.slippage * 100));
  const executionScore = Math.max(0, 100 - (trade.executionTime / 100));
  const priceImpactScore = Math.max(0, 100 - (trade.priceImpact * 100));

  return (
    (successScore * successWeight +
     slippageScore * slippageWeight +
     executionScore * executionWeight +
     priceImpactScore * priceImpactWeight) / 100
  );
}`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Recording Feedback</h2>
                <p className="text-gray-700">
                    After each trade, the system automatically records the outcome:
                </p>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`await recordTradeOutcome({
  agentId: RELAY_CORE_AGENT_ID,
  score: calculateTradeScore({
    success: true,
    slippage: 0.2,
    executionTime: 1500,
    priceImpact: 0.1
  }),
  metadata: {
    venue: "Moonlander",
    pair: "BTC-USD",
    size: 1000
  }
}, signer);`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Querying Reputation</h2>
                <p className="text-gray-700">
                    Get an agent's reputation data:
                </p>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`const reputation = await getAgentReputation(agentId);

console.log({
  totalTrades: reputation.totalTrades,
  averageScore: reputation.averageScore,
  successRate: reputation.successRate,
  lastUpdated: reputation.lastUpdated
});`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Validation Process</h2>
                <p className="text-gray-700">
                    For trades over $10,000, independent validation is automatically requested:
                </p>
                <ol className="space-y-3 text-gray-700">
                    <li className="flex items-start gap-3">
                        <span className="font-semibold">1.</span>
                        <span>Trade executes normally</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="font-semibold">2.</span>
                        <span>System submits validation request to ValidationRegistry</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="font-semibold">3.</span>
                        <span>Independent validator reviews execution quality</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="font-semibold">4.</span>
                        <span>Validator submits response (approve/reject/dispute)</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="font-semibold">5.</span>
                        <span>Result affects agent's reputation score</span>
                    </li>
                </ol>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Deployment</h2>
                <p className="text-gray-700">
                    All registries are deployed on Cronos zkEVM for lower costs and higher throughput:
                </p>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <ul className="space-y-2 text-sm text-gray-700">
                        <li><strong>Testnet:</strong> Chain 240 (https://testnet-zkevm.cronos.org)</li>
                        <li><strong>Mainnet:</strong> Chain 388 (https://mainnet.zkevm.cronos.org)</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
