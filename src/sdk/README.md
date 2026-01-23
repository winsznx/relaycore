# Relay Core SDK

TypeScript SDK for building AI agents and service providers on Relay Core. Provides agent discovery, x402 payment handling, session management, and service registration with production-grade error handling and observability.

## Installation

```bash
npm install @relaycore/sdk
```

## Agent SDK

The Agent SDK enables autonomous agents to discover services, manage payment sessions, and execute paid operations.

### Basic Setup

```typescript
import { RelayAgent, createAgent } from '@relaycore/sdk';

const agent = createAgent({
  wallet: signer, // ethers.Signer from connected wallet
  apiKey: "rc_test_...", // From Dashboard → API Keys
  network: 'cronos-testnet',
});
```

### Service Discovery

```typescript
const service = await agent.selectService({
  category: 'data.prices',
  constraints: {
    minReputation: 90,
    maxLatency: 200,
  },
});
```

### Service Execution

```typescript
const result = await agent.execute(service, { pair: 'BTC/USD' });

if (result.success) {
  console.log('Price:', result.data);
  console.log('Latency:', result.metrics.totalMs, 'ms');
} else {
  console.log('Error:', result.error?.message);
}
```

### Session Management

**Create Session**
```typescript
const { sessionId, paymentRequest } = await agent.createSession({
  maxSpend: 10, // USDC
  durationHours: 24,
  authorizedAgents: [] // Optional: restrict to specific agents
});

console.log(`Session ID: ${sessionId}`);
console.log(`Pay ${paymentRequest.amount} USDC to ${paymentRequest.payTo}`);
```

**Activate Session**
```typescript
// After transferring USDC to paymentRequest.payTo
const activation = await agent.activateSession(
  sessionId,
  "0x...txHash...", // USDC transfer transaction hash
  paymentRequest.amount
);

if (activation.success) {
  console.log("Session activated");
}
```

**Query Session**
```typescript
const session = await agent.getSession(sessionId);
console.log(`Budget: ${session.maxSpend} USDC`);
console.log(`Spent: ${session.spent} USDC`);
console.log(`Remaining: ${Number(session.maxSpend) - Number(session.spent)} USDC`);
```

### Trust Policy

```typescript
agent.setTrustPolicy({
  minReputation: 85,
  maxLatency: 500,
  verifiedOnly: true,
  blacklistedProviders: ['0x...'],
});
```

### Workflow Execution

```typescript
const result = await agent.executeWorkflow([
  { name: 'getPrice', criteria: { category: 'data.prices' } },
  { name: 'validate', transform: (price) => price.value > 0 ? price : null },
  { name: 'trade', criteria: { category: 'trading.execution' } },
], { pair: 'BTC/USD' });

console.log('Steps completed:', result.completedSteps);
console.log('Total time:', result.totalMs, 'ms');
```

### Outcome Tracking

```typescript
agent.onOutcome((outcome) => {
  console.log(`Service ${outcome.serviceId}: ${outcome.success ? 'success' : 'failure'}`);
});

const stats = agent.memory.getStats();
console.log('Success rate:', stats.successRate);
```

### Agent Discovery

**Discover Single Agent**
```typescript
const card = await agent.discoverAgentCard('https://perpai.relaycore.xyz');

if (card) {
  console.log('Agent:', card.name);
  console.log('Capabilities:', card.capabilities);
  
  card.resources.forEach(resource => {
    console.log(`${resource.title}: ${resource.url}`);
    console.log(`  Price: ${resource.price}`);
    console.log(`  Settlement: ${resource.paywall.settlement}`);
  });
}
```

**Discover Multiple Agents**
```typescript
const agents = await agent.discoverRemoteAgents([
  'https://perpai.relaycore.xyz',
  'https://rwa.relaycore.xyz',
  'https://treasury.relaycore.xyz',
]);

const onlineAgents = agents.filter(a => a.online);
console.log(`${onlineAgents.length}/${agents.length} agents online`);
```

**Get Local Agent Card**
```typescript
const localCard = await agent.getAgentCard();
console.log('Local resources:', localCard.resources.length);
```

### Task Artifacts

**Create Task**
```typescript
const task = await agent.createTask({
  service_id: 'perpai-quote',
  inputs: { pair: 'BTC/USD', size: 1000 },
});
console.log('Task ID:', task.task_id);
```

**Settle Task**
```typescript
const result = await agent.execute(service, { pair: 'BTC/USD' });

if (result.success) {
  await agent.settleTask(task.task_id, result.data, {
    total_ms: result.metrics.totalMs,
    payment_ms: result.metrics.paymentMs,
    service_ms: result.metrics.serviceMs,
  });
} else {
  await agent.failTask(task.task_id, {
    code: result.error?.code || 'UNKNOWN',
    message: result.error?.message || 'Unknown error',
    retryable: result.error?.retryable || false,
  });
}
```

**Query Tasks**
```typescript
const tasks = await agent.getTasks({
  state: 'settled',
  from: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
  limit: 50,
});
console.log('Completed tasks:', tasks.length);

const stats = await agent.getTaskStats();
console.log('Success rate:', (stats.success_rate * 100).toFixed(1) + '%');
console.log('Avg duration:', stats.avg_duration_ms + 'ms');
```

## Service SDK

The Service SDK enables service providers to register services, handle x402 payments, and record delivery proofs.

### Service Definition

```typescript
import { RelayService, createService, defineService, hashProof } from '@relaycore/sdk';

const myService = defineService({
  name: 'price-feed',
  category: 'data.prices',
  price: '0.01', // USDC per call
  inputType: 'PriceQuery',
  outputType: 'PriceData',
  tags: ['prices', 'real-time', 'crypto'],
});
```

### Service Registration

```typescript
const provider = createService({
  wallet: signer, // ethers.Signer
  network: 'cronos-testnet',
});

const registered = await provider.register(myService);
console.log('Service ID:', registered.id);
```

### Payment Handling

**Manual Payment Check**
```typescript
app.use('/api/price', async (req, res, next) => {
  const paymentId = req.headers['x-payment-id'];

  if (!paymentId) {
    const requirements = await provider.createPaymentRequired({
      amount: '0.01',
      description: 'Price feed access',
    });
    return res.status(402).json(requirements);
  }

  const { verified } = await provider.verifyPayment(paymentId);
  if (!verified) {
    return res.status(402).json({ error: 'Payment not verified' });
  }

  next();
});
```

**Delivery with Proof**
```typescript
app.get('/api/price', async (req, res) => {
  const startTime = Date.now();
  
  const result = { price: 42000.50, pair: 'BTC/USD', timestamp: Date.now() };
  
  await provider.recordDelivery(req.headers['x-payment-id'], {
    result,
    proof: hashProof(result),
    latencyMs: Date.now() - startTime,
  });

  res.json(result);
});
```

### Middleware Helper

```typescript
import { createPaymentMiddleware } from '@relaycore/sdk';

const paymentRequired = createPaymentMiddleware(provider, {
  amount: '0.01',
  description: 'API access',
});

app.use('/api/protected', paymentRequired, (req, res) => {
  res.json({ data: 'protected data' });
});
```

### Payment Event Handlers

```typescript
provider.onPaymentReceived(async (ctx) => {
  console.log('Payment received:', ctx.paymentId, ctx.amount, 'USDC');
  
  const result = await processRequest(ctx.input);
  
  ctx.deliver({
    result,
    proof: hashProof(result),
  });
});

provider.onPaymentFailed(async (event) => {
  console.log('Payment failed:', event.paymentId, event.error);
});
```

### Reputation and Metrics

**Check Reputation**
```typescript
const reputation = await provider.getReputation();
console.log('Score:', reputation.reputationScore);
console.log('Success rate:', reputation.successRate);
console.log('Trend:', reputation.trend);
```

**View Metrics**
```typescript
const metrics = await provider.getMetrics(serviceId, {
  from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
  interval: '1d',
});

metrics.forEach((m) => {
  console.log(`${m.timestamp}: ${m.totalCalls} calls, ${m.successRate}% success`);
});
```

## x402 Protocol Implementation

### Protecting Routes

```typescript
import { requireX402 } from '@relaycore/sdk';

router.get('/premium-data',
  requireX402({
    network: 'cronos-testnet',
    payTo: '0xYourMerchantAddress',
    asset: '0xUSDCAddress',
    maxAmountRequired: '1000000', // 1 USDC
    description: 'Access to premium data feed',
    resource: '/api/premium-data',
  }),
  (req, res) => {
    res.json({ data: 'Premium content' });
  }
);
```

### Settlement Endpoint

```typescript
import { handleX402Settlement, Facilitator } from '@relaycore/sdk';

router.post('/pay', async (req, res) => {
  const { paymentId, paymentHeader, paymentRequirements } = req.body;
  
  const facilitator = new Facilitator({ network: 'cronos-testnet' });
  
  const result = await handleX402Settlement({
    facilitator,
    paymentId,
    paymentHeader,
    paymentRequirements,
  });
  
  if (!result.ok) {
    return res.status(400).json(result);
  }
  
  res.json({ success: true, txHash: result.txHash });
});
```

### x402 Flow

1. Client requests protected resource
2. Server returns 402 Payment Required with payment requirements
3. Client creates EIP-3009 authorization
4. Client submits payment to settlement endpoint
5. Server verifies and settles via Facilitator
6. Client retries with x-payment-id header
7. Server returns protected content

## Error Handling

Both SDKs use structured errors for programmatic handling:

```typescript
const result = await agent.execute(service, input);

if (!result.success) {
  switch (result.error?.code) {
    case 'SERVICE_NOT_FOUND':
      console.log('Service not found');
      break;
    case 'PAYMENT_FAILED':
      console.log('Payment failed, check balance');
      break;
    case 'RATE_LIMITED':
      await sleep(result.error.retryAfterMs);
      // Retry
      break;
    case 'EXECUTION_TIMEOUT':
      // Retry with longer timeout
      break;
    default:
      console.log(result.error?.message);
  }
}
```

## Network Configuration

| Network | Chain ID | Description |
|---------|----------|-------------|
| `cronos-mainnet` | 25 | Cronos EVM Mainnet |
| `cronos-testnet` | 338 | Cronos EVM Testnet |
| `cronos-zkevm` | 388 | Cronos zkEVM Mainnet |

## Design Principles

1. **Progressive Configuration**: Start simple, add options as needed
2. **Explicit Payments**: No magic, full visibility into payment flow
3. **Proof of Delivery**: Every outcome has a hash for verification
4. **Structured Errors**: Retryable vs terminal, with explanations
5. **Built-in Observability**: Logs, metrics, and stats out of the box

## License

MIT
