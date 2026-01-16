# Relay Core SDK - 10-Minute Quickstart

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

// 1. Create agent (minimal config)
const agent = createAgent({
  wallet: signer, // ethers.Signer from connected wallet
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

if (!service) {
  console.log('No matching service found');
  return;
}

console.log(`Selected: ${service.name}`);
console.log(`Why: ${service.selectionReason}`);

// 3. Execute with automatic payment
const result = await agent.execute(service, { pair: 'BTC/USD' });

if (result.success) {
  console.log('Price:', result.data);
  console.log('Latency:', result.metrics.totalMs, 'ms');
} else {
  console.log('Error:', result.error?.message);
  if (result.error?.retryable) {
    console.log('Retrying in', result.error.retryAfterMs, 'ms');
  }
}
```

### Advanced: Trust Policy

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

## Next Steps

- [Full API Reference](/docs/api)
- [Common Patterns](/docs/patterns)
- [Advanced Workflows](/docs/workflows)
- [Security & Trust](/docs/security)
