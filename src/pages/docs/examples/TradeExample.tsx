export default function DocsTradeExample() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Execute a Trade Example</h1>
        <p className="text-lg text-gray-600">
          Complete walkthrough of executing a leveraged trade with gasless payments.
        </p>
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Step 1: Get Trade Quote</h2>
        <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
          <code className="text-sm text-gray-800">{`async function getTradeQuote() {
  const response = await fetch(\`\${import.meta.env.VITE_API_URL || 'https://api.relaycore.xyz'}/api/trade/quote\`, {
              method: 'POST',
            headers: {'Content-Type': 'application/json' },
            body: JSON.stringify({
              pair: 'BTC-USD',
            side: 'long',
            leverage: 5,
            sizeUsd: 1000,
            maxSlippage: 0.5
    })
  });

            if (response.status === 402) {
    const paymentReq = await response.json();
            // Handle payment (see Step 2)
            return await handlePayment(paymentReq);
  }

            const quote = await response.json();
            return quote;
}`}</code>
        </pre>
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Step 2: Sign Payment Authorization</h2>
        <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
          <code className="text-sm text-gray-800">{`import { ethers } from 'ethers';

async function handlePayment(paymentReq) {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  
  // Create authorization
  const authorization = {
    from: await signer.getAddress(),
    to: paymentReq.payTo,
    value: ethers.parseUnits(paymentReq.maxAmountRequired, 6),
    validAfter: 0,
    validBefore: Math.floor(Date.now() / 1000) + 300,
    nonce: ethers.hexlify(ethers.randomBytes(32))
  };
  
  // Sign with EIP-712
  const domain = {
    name: 'USD Coin',
    version: '2',
    chainId: 338,
    verifyingContract: paymentReq.asset
  };
  
  const types = {
    TransferWithAuthorization: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' }
    ]
  };
  
  const signature = await signer.signTypedData(domain, types, authorization);
  
  // Submit to facilitator
  const facilitatorResp = await fetch(
    'https://facilitator.cronoslabs.org/v2/x402/execute',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        authorization,
        signature,
        network: 'cronos-testnet'
      })
    }
  );
  
  const { txHash } = await facilitatorResp.json();
  
  // Retry original request with payment proof
  const retryResp = await fetch('http://localhost:4001/api/trade/quote', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Payment': txHash
    },
    body: JSON.stringify({
      pair: 'BTC-USD',
      side: 'long',
      leverage: 5,
      sizeUsd: 1000,
      maxSlippage: 0.5
    })
  });
  
  return await retryResp.json();
}`}</code>
        </pre>
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Step 3: Execute Trade</h2>
        <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
          <code className="text-sm text-gray-800">{`async function executeTrade(quote) {
  const userAddress = await signer.getAddress();
  
  const response = await fetch('http://localhost:4001/api/trade/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pair: 'BTC-USD',
      side: 'long',
      leverage: 5,
      sizeUsd: 1000,
      userAddress,
      stopLoss: 40000,
      takeProfit: 50000
    })
  });

  if (response.status === 402) {
    // Handle payment again (0.05 USDC for execution)
    const paymentReq = await response.json();
    return await handlePayment(paymentReq);
  }

  const result = await response.json();
  console.log('Trade executed:', result);
  return result;
}`}</code>
        </pre>
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Complete Example</h2>
        <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
          <code className="text-sm text-gray-800">{`async function openLongPosition() {
  try {
    // 1. Get quote (costs 0.01 USDC)
    console.log('Getting trade quote...');
    const quote = await getTradeQuote();
    console.log('Best venue:', quote.bestVenue.name);
    console.log('Expected price:', quote.bestVenue.expectedPrice);
    
    // 2. Show quote to user and get confirmation
    const confirmed = confirm(\`
      Open 5x long on BTC-USD?
      Size: $1000
      Venue: \${quote.bestVenue.name}
      Expected Price: $\${quote.bestVenue.expectedPrice}
      Liquidation: $\${quote.bestVenue.liquidationPrice}
    \`);
    
    if (!confirmed) {
      console.log('Trade cancelled by user');
      return;
    }
    
    // 3. Execute trade (costs 0.05 USDC)
    console.log('Executing trade...');
    const result = await executeTrade(quote);
    
    console.log('Trade successful!');
    console.log('Trade ID:', result.tradeId);
    console.log('Transaction:', result.txHash);
    console.log('Entry Price:', result.entryPrice);
    
    return result;
  } catch (error) {
    console.error('Trade failed:', error);
    throw error;
  }
}

// Execute
openLongPosition();`}</code>
        </pre>
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Monitor Position</h2>
        <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
          <code className="text-sm text-gray-800">{`// Subscribe to WebSocket for real-time updates
const ws = new WebSocket('ws://localhost:4000/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    action: 'subscribe',
    events: ['trade.updated']
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  if (message.event === 'trade.updated') {
    console.log('Trade update:', message.data);
    
    if (message.data.status === 'closed') {
      console.log('Position closed!');
      console.log('PnL:', message.data.pnl);
    }
  }
};`}</code>
        </pre>
      </div>
    </div>
  );
}
