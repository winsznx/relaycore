export default function DocsFeedbackExample() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-4">Record Feedback Example</h1>
                <p className="text-lg text-gray-600">
                    Submit on-chain feedback to the Reputation Registry after trades.
                </p>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Calculate Trade Score</h2>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`function calculateTradeScore(tradeResult) {
  const weights = {
    success: 40,
    slippage: 30,
    execution: 20,
    priceImpact: 10
  };
  
  const successScore = tradeResult.success ? 100 : 0;
  const slippageScore = Math.max(0, 100 - (tradeResult.slippage * 100));
  const executionScore = Math.max(0, 100 - (tradeResult.executionTime / 100));
  const priceImpactScore = Math.max(0, 100 - (tradeResult.priceImpact * 100));
  
  const totalScore = (
    (successScore * weights.success +
     slippageScore * weights.slippage +
     executionScore * weights.execution +
     priceImpactScore * weights.priceImpact) / 100
  );
  
  return Math.round(totalScore);
}

const score = calculateTradeScore({
  success: true,
  slippage: 0.2,
  executionTime: 1500,
  priceImpact: 0.1
});

console.log('Trade score:', score); // e.g., 92`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Submit Feedback On-Chain</h2>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`import { ethers } from 'ethers';

async function submitFeedback(agentId, score, tradeDetails) {
  const provider = new ethers.JsonRpcProvider(
    'https://testnet-zkevm.cronos.org'
  );
  
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  const reputationRegistry = new ethers.Contract(
    process.env.REPUTATION_REGISTRY_ADDRESS,
    [
      'function submitFeedback(uint256 agentId, uint8 score, string metadata) public',
      'event FeedbackSubmitted(uint256 indexed agentId, address indexed submitter, uint8 score, string metadata)'
    ],
    signer
  );
  
  // Prepare metadata
  const metadata = JSON.stringify({
    tradeId: tradeDetails.tradeId,
    venue: tradeDetails.venue,
    pair: tradeDetails.pair,
    sizeUsd: tradeDetails.sizeUsd,
    slippage: tradeDetails.slippage,
    executionTime: tradeDetails.executionTime,
    timestamp: Date.now()
  });
  
  // Submit feedback
  console.log('Submitting feedback...');
  const tx = await reputationRegistry.submitFeedback(
    agentId,
    score,
    metadata
  );
  
  const receipt = await tx.wait();
  console.log('Feedback submitted!');
  console.log('Transaction:', receipt.hash);
  
  return receipt;
}`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Query Agent Reputation</h2>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`async function getAgentReputation(agentId) {
  const reputationRegistry = new ethers.Contract(
    process.env.REPUTATION_REGISTRY_ADDRESS,
    [
      'function getAverageScore(uint256 agentId) view returns (uint256)',
      'function getFeedbackCount(uint256 agentId) view returns (uint256)',
      'function getRecentFeedback(uint256 agentId, uint256 limit) view returns (tuple(uint256 agentId, uint8 score, string metadata, address submitter, uint256 timestamp)[])'
    ],
    provider
  );
  
  const avgScore = await reputationRegistry.getAverageScore(agentId);
  const count = await reputationRegistry.getFeedbackCount(agentId);
  const recentFeedback = await reputationRegistry.getRecentFeedback(agentId, 10);
  
  console.log('Agent Reputation:');
  console.log('- Average Score:', avgScore.toString());
  console.log('- Total Feedback:', count.toString());
  console.log('- Recent Feedback:', recentFeedback.length);
  
  recentFeedback.forEach((feedback, i) => {
    const meta = JSON.parse(feedback.metadata);
    console.log(\`\\nFeedback #\${i + 1}:\`);
    console.log('  Score:', feedback.score);
    console.log('  Trade:', meta.tradeId);
    console.log('  Venue:', meta.venue);
    console.log('  Submitter:', feedback.submitter);
  });
  
  return {
    averageScore: avgScore,
    totalFeedback: count,
    recentFeedback
  };
}`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Complete Example</h2>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`async function recordTradeOutcome(tradeResult) {
  try {
    // 1. Calculate score
    const score = calculateTradeScore({
      success: tradeResult.success,
      slippage: tradeResult.actualSlippage,
      executionTime: tradeResult.executionTime,
      priceImpact: tradeResult.priceImpact
    });
    
    console.log('Calculated score:', score);
    
    // 2. Submit feedback on-chain
    await submitFeedback(
      process.env.RELAY_CORE_AGENT_ID,
      score,
      {
        tradeId: tradeResult.id,
        venue: tradeResult.venue,
        pair: tradeResult.pair,
        sizeUsd: tradeResult.sizeUsd,
        slippage: tradeResult.actualSlippage,
        executionTime: tradeResult.executionTime
      }
    );
    
    // 3. Query updated reputation
    const reputation = await getAgentReputation(
      process.env.RELAY_CORE_AGENT_ID
    );
    
    console.log('Updated average score:', reputation.averageScore.toString());
    
    return reputation;
  } catch (error) {
    console.error('Failed to record feedback:', error);
    throw error;
  }
}

// Usage after trade execution
const tradeResult = {
  id: 'trade_123',
  success: true,
  venue: 'Moonlander',
  pair: 'BTC-USD',
  sizeUsd: 1000,
  actualSlippage: 0.15,
  executionTime: 1200,
  priceImpact: 0.08
};

await recordTradeOutcome(tradeResult);`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Listen for Feedback Events</h2>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`// Listen for new feedback
reputationRegistry.on('FeedbackSubmitted', (agentId, submitter, score, metadata, event) => {
  console.log('New feedback received!');
  console.log('Agent ID:', agentId.toString());
  console.log('Score:', score);
  console.log('Submitter:', submitter);
  console.log('Metadata:', JSON.parse(metadata));
  console.log('Block:', event.blockNumber);
});`}</code>
                </pre>
            </div>
        </div>
    );
}
