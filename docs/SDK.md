# Relay Core SDK - 10-Minute Quickstart

![Relay Core](../assets/relaycore.png)

> Get started with Relay Core in under 10 minutes.

## Installation

```bash
npm install @relaycore/sdk
# or
pnpm add @relaycore/sdk
```

---

## For AI Agents: RelayAgent SDK

The Agent SDK is for **consuming** services - discovering, deciding, and executing.

### Quickstart

```typescript
import { RelayAgent, createAgent } from '@relaycore/sdk';

// 1. Create agent (API Key required)
const agent = createAgent({
  wallet: signer, // ethers.Signer from connected wallet
  apiKey: "rc_test_...", // Get yours from Dashboard > API Keys
  network: 'cronos-testnet',
});

// 2. Select best service by policy
const service = await agent.selectService({
  category: 'data.prices',
  constraints: {
    minReputation: 90,
    maxLatency: 200,
  },
});
```

---

## Session Management (x402)

Manage gasless payment sessions programmatically.

```typescript
// 1. Create a session (e.g., $10 budget for 24 hours)
const { sessionId, paymentRequest } = await agent.createSession({
    maxSpend: 10, // USDC
    durationHours: 24,
    authorizedAgents: [] // Optional: restricted list
});

console.log(`Created Session: ${sessionId}`);

// 2. Pay to activate (Client-side wallet interaction)
// Transfer USDC to 'paymentRequest.payTo' first, then:
const activation = await agent.activateSession(
    sessionId,
    "0x...txHash...", // Transaction hash of your USDC transfer
    paymentRequest.amount
);

if (activation.success) {
    console.log("Session Activated!");
}

// 3. Check session status
const session = await agent.getSession(sessionId);
console.log(`Remaining Budget: ${Number(session.maxSpend) - Number(session.spent)} USDC`);
```

---

## Service Selection & Execution

### Basic Execution
```typescript
const result = await agent.execute(service, { pair: 'BTC/USD' });

if (result.success) {
  console.log('Price:', result.data);
  console.log('Latency:', result.metrics.totalMs, 'ms');
} else {
  console.log('Error:', result.error?.message);
}
```

### Trust Policy

```typescript
// Set global trust policy (optional)
agent.setTrustPolicy({
  minReputation: 85,
  maxLatency: 500,
  verifiedOnly: true,
  blacklistedProviders: ['0x...'],
});
```

### Advanced: Workflows

```typescript
const result = await agent.executeWorkflow([
  { name: 'getPrice', criteria: { category: 'data.prices' } },
  { name: 'validate', transform: (price) => price.value > 0 ? price : null },
  { name: 'trade', criteria: { category: 'trading.execution' } },
], { pair: 'BTC/USD' });

console.log('Steps completed:', result.completedSteps);
console.log('Total time:', result.totalMs, 'ms');
```

### Advanced: Memory

```typescript
// Record outcomes for learning
agent.onOutcome((outcome) => {
  console.log(`Service ${outcome.serviceId}: ${outcome.success ? 'success' : 'failure'}`);
});

// Get stats
const stats = agent.memory.getStats();
console.log('Success rate:', stats.successRate);
```

### Advanced: A2A Discovery

Discover and interact with other x402-enabled agents via Agent Cards:

```typescript
// Discover a single agent's capabilities
const card = await agent.discoverAgentCard('https://perpai.relaycore.xyz');

if (card) {
  console.log('Agent:', card.name);
  console.log('Capabilities:', card.capabilities);
  console.log('Resources:', card.resources.map(r => r.title));
  
  // Each resource has x402 paywall info
  card.resources.forEach(resource => {
    console.log(`${resource.title}: ${resource.url}`);
    console.log(`  Price: ${resource.price}`);
    console.log(`  Settlement: ${resource.paywall.settlement}`);
  });
}

// Discover multiple agents in parallel
const agents = await agent.discoverRemoteAgents([
  'https://perpai.relaycore.xyz',
  'https://rwa.relaycore.xyz',
  'https://treasury.relaycore.xyz',
]);

const onlineAgents = agents.filter(a => a.online);
console.log(`${onlineAgents.length}/${agents.length} agents online`);

// Get local Relay Core agent card
const localCard = await agent.getAgentCard();
console.log('Local resources:', localCard.resources.length);
```

### Advanced: Task Artifacts

Track and audit all agent actions with TaskArtifacts:

```typescript
// Create a task before executing
const task = await agent.createTask({
  service_id: 'perpai-quote',
  inputs: { pair: 'BTC/USD', size: 1000 },
});
console.log('Task ID:', task.task_id);

// Execute your service call...
const result = await agent.execute(service, { pair: 'BTC/USD' });

// Mark task as settled (success) or failed
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

// Query your task history
const tasks = await agent.getTasks({
  state: 'settled',
  from: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
  limit: 50,
});
console.log('Completed tasks:', tasks.length);

// Get task statistics
const stats = await agent.getTaskStats();
console.log('Success rate:', (stats.success_rate * 100).toFixed(1) + '%');
console.log('Avg duration:', stats.avg_duration_ms + 'ms');
```

---

## For Service Providers: RelayService SDK

The Service SDK is for **exposing** services - registering, handling payments, and proving delivery.

### Quickstart

```typescript
import { RelayService, createService, defineService, hashProof } from '@relaycore/sdk';

// 1. Define your service (first-class metadata)
const myService = defineService({
  name: 'price-feed',
  category: 'data.prices',
  price: '0.01', // USDC per call
  inputType: 'PriceQuery',
  outputType: 'PriceData',
  tags: ['prices', 'real-time', 'crypto'],
});

// 2. Create provider
const provider = createService({
  wallet: signer, // ethers.Signer
  network: 'cronos-testnet',
});

// 3. Register on Relay Core
const registered = await provider.register(myService);
console.log('Service ID:', registered.id);

// 4. Handle payments (in your Express app)
app.use('/api/price', async (req, res, next) => {
  const paymentId = req.headers['x-payment-id'];

  if (!paymentId) {
    // Return payment required
    const requirements = await provider.createPaymentRequired({
      amount: '0.01',
      description: 'Price feed access',
    });
    return res.status(402).json(requirements);
  }

  // Verify payment
  const { verified } = await provider.verifyPayment(paymentId);
  if (!verified) {
    return res.status(402).json({ error: 'Payment not verified' });
  }

  next();
});

// 5. Deliver with proof
app.get('/api/price', async (req, res) => {
  const startTime = Date.now();
  
  // Your business logic
  const result = { price: 42000.50, pair: 'BTC/USD', timestamp: Date.now() };
  
  // Record delivery with proof
  await provider.recordDelivery(req.headers['x-payment-id'], {
    result,
    proof: hashProof(result),
    latencyMs: Date.now() - startTime,
  });

  res.json(result);
});
```

### Using the Middleware Helper

```typescript
import { createPaymentMiddleware } from '@relaycore/sdk';

// Simpler approach with built-in middleware
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
  
  // Process request
  const result = await processRequest(ctx.input);
  
  // Deliver with proof
  ctx.deliver({
    result,
    proof: hashProof(result),
  });
});

provider.onPaymentFailed(async (event) => {
  console.log('Payment failed:', event.paymentId, event.error);
});
```

### Check Reputation

```typescript
const reputation = await provider.getReputation();
console.log('Score:', reputation.reputationScore);
console.log('Success rate:', reputation.successRate);
console.log('Trend:', reputation.trend);
```

### View Metrics

```typescript
const metrics = await provider.getMetrics(serviceId, {
  from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
  interval: '1d',
});

metrics.forEach((m) => {
  console.log(`${m.timestamp}: ${m.totalCalls} calls, ${m.successRate}% success`);
});
```

---

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

---

## Key Principles

1. **Progressive configuration** - Start simple, add options as needed
2. **Explicit payments** - No magic, full visibility into payment flow
3. **Proof of delivery** - Every outcome has a hash for verification
4. **Structured errors** - Retryable vs terminal, with explanations
5. **Built-in observability** - Logs, metrics, and stats out of the box

---

## Network Configuration

| Network | Chain ID | Description |
|---------|----------|-------------|
| `cronos-mainnet` | 25 | Cronos EVM Mainnet |
| `cronos-testnet` | 338 | Cronos EVM Testnet |
| `cronos-zkevm` | 388 | Cronos zkEVM Mainnet |

---

## X402 Protocol (Cronos Standard)

The SDK includes a Cronos-standard x402 implementation for protecting endpoints:

### Protecting Routes with x402

```typescript
import { requireX402 } from '@relaycore/sdk';

// Protect an endpoint with x402 payment
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
    res.json({ data: 'Premium content here' });
  }
);
```

### Handling x402 Payments

```typescript
import { handleX402Settlement, Facilitator } from '@relaycore/sdk';

// Settlement endpoint (POST /api/pay)
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

### x402 Flow Summary

1. Client requests protected resource
2. Server returns `402 Payment Required` with payment requirements
3. Client creates EIP-3009 authorization
4. Client submits payment to `/api/pay`
5. Server verifies and settles via Facilitator
6. Client retries with `x-payment-id` header
7. Server returns protected content

---

## Next Steps

- [Full API Reference](/docs/api)
- [Common Patterns](/docs/patterns)
- [Advanced Workflows](/docs/workflows)
- [Security & Trust](/docs/security)
