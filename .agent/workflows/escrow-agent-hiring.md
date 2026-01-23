---
description: How to use escrow sessions for agent payments
---

# Escrow-Enabled Agent Hiring Workflow

This workflow demonstrates how to use escrow sessions for automated agent payments in Relay Core.

## Prerequisites

1. Supabase running locally (`npx supabase start`)
2. Backend API running (`npm run dev:graphql`)
3. MCP server running (`cd mcp-server && npm run dev`)
4. Wallet with USDC on Cronos Testnet

## Step 1: Create an Escrow Session

```bash
# Via MCP (Claude Desktop):
create an escrow session with 10 USDC budget for 24 hours

# Via SDK:
const session = await relay.createEscrowSession({
    maxSpend: '10.00',
    durationHours: 24
});
```

**Expected Output**:
- Session ID (e.g., `3`)
- Owner address
- Escrow agent address
- Transaction hash

## Step 2: Deposit Funds

```bash
# Via MCP:
deposit 10 USDC into session 3

# Via SDK:
await relay.depositToSession({
    sessionId: 3,
    amount: '10.00'
});
```

**Expected Output**:
- Deposit transaction hash
- Session status changed to "active"
- Balance: 10.00 USDC deposited

## Step 3: Hire an Agent (Auto-uses Escrow)

```bash
# Via MCP:
hire PerpAI Quote agent to get BTC long quote

# Via SDK:
const result = await relay.hireAgent({
    agentId: 'perp-ai-quote',
    resourceId: 'get-quote',
    budget: '0.10',
    task: {
        pair: 'BTC-USD',
        side: 'long',
        leverage: 10,
        sizeUsd: 10000
    }
});
```

**Expected Output**:
```json
{
  "success": true,
  "taskId": "task_123",
  "agentId": "perp-ai-quote",
  "cost": "0.01",
  "paymentMethod": "escrow",
  "escrowSessionId": 3,
  "paymentTxHash": "0x..."
}
```

## Step 4: Verify Payment

```bash
# Via MCP:
what's the status of escrow session 3?

# Via SDK:
const session = await relay.getSessionStatus(3);
console.log('Remaining:', session.remaining);
```

**Expected Output**:
- Deposited: 10.00 USDC
- Released: 0.01 USDC
- Remaining: 9.99 USDC

## Step 5: Hire Multiple Agents

```bash
# All will use the same escrow session automatically
hire PerpAI Venues agent to list venues
hire PerpAI Trade agent to execute trade
```

**Expected Output**:
- Each hire uses escrow session #3
- Balance decreases with each hire
- All transactions tracked

## Step 6: Check Total Spending

```bash
# Via MCP:
what's the status of escrow session 3?

# Via SDK:
const session = await relay.getSessionStatus(3);
const balance = relay.getSessionBalance(session);
console.log('Total spent:', balance.released);
```

## Step 7: Refund Remaining Balance

```bash
# Via MCP:
refund remaining balance from session 3

# Via SDK:
await relay.refundSession(3);
```

**Expected Output**:
- Refund transaction hash
- Amount refunded
- Session status changed to "closed"

## Advanced: Automated Trading Bot

```typescript
import { RelayAgent } from '@relaycore/sdk';

async function runTradingBot() {
    const relay = new RelayAgent({
        apiUrl: 'http://localhost:4001',
        walletAddress: '0xYourAddress'
    });

    // 1. Create daily escrow session
    const session = await relay.createEscrowSession({
        maxSpend: '100.00',
        durationHours: 24
    });

    await relay.depositToSession({
        sessionId: session.sessionId,
        amount: '100.00'
    });

    console.log('Bot initialized with session:', session.sessionId);

    // 2. Run trading loop
    while (true) {
        // Get quote
        const quote = await relay.hireAgent({
            agentId: 'perp-ai-quote',
            resourceId: 'get-quote',
            budget: '0.10',
            task: { pair: 'BTC-USD', side: 'long' }
        });

        console.log('Quote:', quote);

        // Execute if favorable
        if (shouldTrade(quote)) {
            const trade = await relay.hireAgent({
                agentId: 'perp-ai-trade',
                resourceId: 'execute-trade',
                budget: '0.50',
                task: { /* trade params */ }
            });

            console.log('Trade executed:', trade);
        }

        // Check remaining balance
        const status = await relay.getSessionStatus(session.sessionId);
        console.log('Remaining budget:', status.remaining);

        if (parseFloat(status.remaining) < 1.0) {
            console.log('Low balance, stopping bot');
            break;
        }

        await sleep(60000); // Wait 1 minute
    }

    // 3. Cleanup
    await relay.refundSession(session.sessionId);
    console.log('Bot stopped, funds refunded');
}

function shouldTrade(quote: any): boolean {
    return quote.expectedSlippage < 0.5;
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the bot
runTradingBot().catch(console.error);
```

## Troubleshooting

### Issue: "Agent not authorized"
**Solution**: The escrow system now auto-authorizes agents. If you see this error, check:
1. Backend API is running
2. Escrow contract address is correct
3. Wallet has permission to authorize agents

### Issue: "Insufficient escrow balance"
**Solution**: Deposit more funds:
```bash
deposit 5 USDC into session 3
```

### Issue: "Session expired"
**Solution**: Create a new session:
```bash
create an escrow session with 10 USDC budget for 24 hours
```

### Issue: "Escrow unavailable, using direct payment"
**Solution**: This is expected behavior. The system falls back to direct x402 payment if:
- No active escrow sessions
- Insufficient balance in escrow
- Escrow service unavailable

## Best Practices

1. **Create sessions at the start of your workflow**
   - Reduces transaction overhead
   - Easier budget management
   - Better cost tracking

2. **Monitor balance regularly**
   - Check remaining balance before expensive operations
   - Set up alerts for low balance
   - Auto-deposit when threshold reached

3. **Clean up sessions when done**
   - Always refund remaining balance
   - Close sessions to free up resources
   - Track session lifecycle

4. **Use appropriate session durations**
   - Short tasks: 1-2 hours
   - Daily bots: 24 hours
   - Long-running: 7 days max

5. **Handle errors gracefully**
   - Always have fallback to direct payment
   - Log payment method used
   - Monitor for failed transactions

## Files Modified

- `/Users/macbook/relaycore/src/services/escrow/escrow-agent.ts` - Auto-authorization
- `/Users/macbook/relaycore/src/services/escrow/escrow-payment-helper.ts` - Payment helper
- `/Users/macbook/relaycore/src/services/agents/meta-agent-service.ts` - Escrow integration
- `/Users/macbook/relaycore/src/types/meta-agent.ts` - Updated types

## Related Documentation

- `ESCROW_FIXES_APPLIED.md` - Technical details of fixes
- `SDK_ESCROW_GUIDE.md` - Complete SDK documentation
- `SUPABASE_LOCAL_SETUP.md` - Database setup

---

**Workflow Status**: ✅ Ready to use
**Last Updated**: 2026-01-16
