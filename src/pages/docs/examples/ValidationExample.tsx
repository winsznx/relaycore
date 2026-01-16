export default function DocsValidationExample() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Request Validation Example</h1>
        <p className="text-lg text-gray-600">
          Request independent validation for high-value trades using the Validation Registry.
        </p>
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">When to Request Validation</h2>
        <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
          <code className="text-sm text-gray-800">{`const VALIDATION_THRESHOLD = 10000; // $10,000 USD

function shouldRequestValidation(tradeSize) {
  return tradeSize >= VALIDATION_THRESHOLD;
}

// Check before submitting feedback
if (shouldRequestValidation(tradeResult.sizeUsd)) {
  console.log('Trade exceeds threshold - requesting validation');
  await requestValidation(tradeResult);
}`}</code>
        </pre>
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Submit Validation Request</h2>
        <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
          <code className="text-sm text-gray-800">{`import { ethers } from 'ethers';

async function requestValidation(tradeResult) {
  const provider = new ethers.JsonRpcProvider(
    'https://testnet-zkevm.cronos.org'
  );
  
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  const validationRegistry = new ethers.Contract(
    process.env.VALIDATION_REGISTRY_ADDRESS,
    [
      'function requestValidation(address validator, uint256 agentId, string requestData) returns (bytes32)',
      'event ValidationRequested(bytes32 indexed requestHash, address indexed requester, uint256 indexed agentId, address validator)'
    ],
    signer
  );
  
  // Prepare request data
  const requestData = JSON.stringify({
    tradeId: tradeResult.id,
    pair: tradeResult.pair,
    side: tradeResult.side,
    sizeUsd: tradeResult.sizeUsd,
    entryPrice: tradeResult.entryPrice,
    exitPrice: tradeResult.exitPrice,
    venue: tradeResult.venue,
    executionTime: tradeResult.executionTime,
    slippage: tradeResult.actualSlippage,
    timestamp: Date.now()
  });
  
  console.log('Requesting validation...');
  
  const tx = await validationRegistry.requestValidation(
    process.env.VALIDATOR_ADDRESS,
    process.env.RELAY_CORE_AGENT_ID,
    requestData
  );
  
  const receipt = await tx.wait();
  
  // Extract request hash from event
  const iface = new ethers.Interface([
    'event ValidationRequested(bytes32 indexed requestHash, address indexed requester, uint256 indexed agentId, address validator)'
  ]);
  
  const log = receipt.logs.find(l => {
    try {
      iface.parseLog(l);
      return true;
    } catch {
      return false;
    }
  });
  
  const parsed = iface.parseLog(log!);
  const requestHash = parsed!.args[0];
  
  console.log('Validation requested!');
  console.log('Request Hash:', requestHash);
  console.log('Transaction:', receipt.hash);
  
  return requestHash;
}`}</code>
        </pre>
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Check Validation Status</h2>
        <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
          <code className="text-sm text-gray-800">{`async function checkValidationStatus(requestHash) {
  const validationRegistry = new ethers.Contract(
    process.env.VALIDATION_REGISTRY_ADDRESS,
    [
      'function getValidation(bytes32 requestHash) view returns (tuple(address requester, uint256 agentId, string requestData, address validator, uint8 response, string responseData, uint256 requestedAt, uint256 respondedAt))'
    ],
    provider
  );
  
  const validation = await validationRegistry.getValidation(requestHash);
  
  const responseTypes = ['Pending', 'Approved', 'Rejected', 'Disputed'];
  
  console.log('Validation Status:');
  console.log('- Requester:', validation.requester);
  console.log('- Agent ID:', validation.agentId.toString());
  console.log('- Validator:', validation.validator);
  console.log('- Response:', responseTypes[validation.response]);
  console.log('- Requested:', new Date(validation.requestedAt * 1000));
  
  if (validation.respondedAt > 0) {
    console.log('- Responded:', new Date(validation.respondedAt * 1000));
    console.log('- Response Data:', validation.responseData);
  } else {
    console.log('- Status: Awaiting validator response');
  }
  
  return validation;
}`}</code>
        </pre>
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Wait for Validation</h2>
        <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
          <code className="text-sm text-gray-800">{`async function waitForValidation(requestHash, timeoutMs = 300000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    const validation = await checkValidationStatus(requestHash);
    
    if (validation.response !== 0) { // Not pending
      console.log('Validation complete!');
      return validation;
    }
    
    console.log('Still pending... checking again in 30s');
    await new Promise(resolve => setTimeout(resolve, 30000));
  }
  
  throw new Error('Validation timeout');
}

// Usage
const requestHash = await requestValidation(tradeResult);
const validation = await waitForValidation(requestHash);

if (validation.response === 1) {
  console.log('[OK] Trade validated successfully');
} else if (validation.response === 2) {
  console.log('[FAIL] Trade rejected by validator');
  console.log('Reason:', validation.responseData);
}`}</code>
        </pre>
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Complete Example</h2>
        <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
          <code className="text-sm text-gray-800">{`async function processHighValueTrade(tradeResult) {
  try {
    // 1. Check if validation needed
    if (!shouldRequestValidation(tradeResult.sizeUsd)) {
      console.log('Trade below threshold - no validation needed');
      return null;
    }
    
    console.log(\`High-value trade detected: $\${tradeResult.sizeUsd}\`);
    
    // 2. Request validation
    const requestHash = await requestValidation(tradeResult);
    
    // 3. Wait for validator response
    console.log('Waiting for validator...');
    const validation = await waitForValidation(requestHash);
    
    // 4. Process result
    if (validation.response === 1) {
      console.log('[OK] Trade approved by validator');
      console.log('Validator notes:', validation.responseData);
      
      // Record positive feedback
      await submitFeedback(
        process.env.RELAY_CORE_AGENT_ID,
        95,
        JSON.stringify({
          ...tradeResult,
          validated: true,
          validationHash: requestHash
        })
      );
    } else if (validation.response === 2) {
      console.log('[FAIL] Trade rejected by validator');
      console.log('Reason:', validation.responseData);
      
      // Record negative feedback
      await submitFeedback(
        process.env.RELAY_CORE_AGENT_ID,
        40,
        JSON.stringify({
          ...tradeResult,
          validated: false,
          validationHash: requestHash,
          rejectionReason: validation.responseData
        })
      );
    }
    
    return validation;
  } catch (error) {
    console.error('Validation process failed:', error);
    throw error;
  }
}

// Usage
const tradeResult = {
  id: 'trade_456',
  pair: 'BTC-USD',
  side: 'long',
  sizeUsd: 15000,
  entryPrice: 45234.50,
  exitPrice: 46500.00,
  venue: 'Moonlander',
  executionTime: 1500,
  actualSlippage: 0.18
};

await processHighValueTrade(tradeResult);`}</code>
        </pre>
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Listen for Validation Events</h2>
        <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
          <code className="text-sm text-gray-800">{`// Listen for validation responses
validationRegistry.on('ValidationResponded', (requestHash, response, event) => {
  console.log('Validation response received!');
  console.log('Request Hash:', requestHash);
  console.log('Response:', ['Pending', 'Approved', 'Rejected', 'Disputed'][response]);
  console.log('Block:', event.blockNumber);
  
  // Fetch full validation details
  checkValidationStatus(requestHash);
});`}</code>
        </pre>
      </div>
    </div>
  );
}
