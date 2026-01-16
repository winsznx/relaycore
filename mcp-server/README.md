# Relay Core MCP Server

Unified Model Context Protocol (MCP) server for the Relay Core ecosystem, providing structured access to:

- **Crypto.com Exchange API** - Market data, orderbooks, candlesticks
- **Cronos Blockchain** - Native chain integration (mainnet + testnet)
- **Relay Core Services** - Agents, quotes, venues, reputation, x402 payments

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your API keys
vim .env

# Run the server
npm run dev
```

## Integration with Claude Code

```bash
# Add Relay Core MCP to Claude Code
claude mcp add relaycore 'npx tsx /path/to/relaycore/mcp-server/index.ts'

# Verify
claude mcp list

# Open Claude and use the tools
claude
```

---

## 🔐 API Key Authentication

Relay Core uses API keys for SDK and programmatic access. This ensures:
- **Secure access** to protected endpoints
- **Rate limiting** per developer (100 req/hour default)
- **Permission control** (read vs write operations)
- **Usage tracking** for analytics

### Obtaining an API Key

1. **Connect wallet** at https://relaycore.xyz/dashboard
2. Navigate to **Settings → API Keys**
3. Click **Generate API Key**
4. Copy the key immediately (shown once only!)

### Using API Keys

**In SDK:**
```typescript
import { createAgentSDK } from '@relaycore/sdk';

const sdk = createAgentSDK({
    apiKey: 'rc_xxxxx',           // Your API key
    walletAddress: '0x1234...',    // Your wallet address
});

// All SDK calls are now authenticated
const agents = await sdk.discoverAgents('oracle', 80);
```

**In HTTP Requests:**
```bash
# Using Authorization header
curl https://api.relaycore.xyz/agents \
  -H "Authorization: Bearer rc_xxxxx"

# Or using x-api-key header
curl https://api.relaycore.xyz/agents \
  -H "x-api-key: rc_xxxxx"
```

**In MCP Tools:**
```
> Use relay_discover_services with API key rc_xxxxx
```

### API Key Permissions

| Permission | Description | Default |
|------------|-------------|---------|
| `read_services` | Query services and agents | ✅ |
| `read_reputation` | Query reputation scores | ✅ |
| `read_outcomes` | View payment outcomes | ✅ |
| `read_payments` | View payment history | ✅ |
| `execute_payments` | Execute x402 payments | ❌ |
| `register_agents` | Register new agents | ✅ |

Note: `execute_payments` requires wallet signature and cannot be done via API key alone.

---

## Available Tools (26+ total)

### Crypto.com Exchange API (4 tools)

| Tool | Description |
|------|-------------|
| `crypto_com_get_ticker` | Get real-time ticker (price, volume, bid/ask) |
| `crypto_com_get_orderbook` | Get order book (bids/asks) |
| `crypto_com_get_candlestick` | Get OHLCV candlestick data |
| `crypto_com_get_instruments` | List available trading pairs |

**Example:**
```
> Get the BTC_USDT ticker from Crypto.com
> Show me the ETH_USDT order book with 20 levels
> Get 1-hour candles for CRO_USDT
```

### Cronos Blockchain (9 tools)

| Tool | Description |
|------|-------------|
| `cronos_block_number` | Get current block number |
| `cronos_get_block` | Get block details by number |
| `cronos_get_balance` | Get CRO balance for address |
| `cronos_get_transaction` | Get transaction by hash |
| `cronos_get_nonce` | Get transaction count (nonce) |
| `cronos_gas_price` | Get current gas price |
| `cronos_call_contract` | Read smart contract (view function) |
| `cronos_token_balance` | Get ERC-20 token balance |
| `cronos_get_logs` | Get contract event logs |

**Example:**
```
> What's the current block on Cronos testnet?
> Check the CRO balance for 0x1234...
> Get gas prices on Cronos mainnet
> What's my USDC balance on 0xTokenAddress?
```

### Relay Core Services (8 tools)

| Tool | x402 | Description |
|------|------|-------------|
| `relay_get_prices` | ❌ | Multi-DEX aggregated prices |
| `relay_discover_services` | ❌ | Find services by category |
| `relay_get_quote` | ✅ | Get trade quote (payment required) |
| `relay_venue_rankings` | ❌ | DEX venues by reputation |
| `relay_funding_rates` | ❌ | Current funding rates |
| `relay_get_reputation` | ❌ | Entity reputation score |
| `relay_x402_info` | ❌ | Get x402 payment requirements |
| `relay_invoke_agent` | ✅ | Execute an agent |

**Example:**
```
> Get aggregated prices for BTC, ETH, CRO
> Find oracle services with reputation > 80
> Get a quote for 10x long on ETH worth $1000
> Show me the top trading venues by volume
```

### On-Chain Registry (4 tools)

| Tool | Description |
|------|-------------|
| `relay_register_agent` | Register agent on IdentityRegistry |
| `relay_get_agent_info` | Get agent details by ID |
| `relay_submit_feedback` | Submit feedback to ReputationRegistry |
| `relay_get_agent_score` | Get agent's reputation score |

**Example:**
```
> Register a new agent with name "My Oracle"
> Get info for agent ID 1
> Submit feedback score 95 for agent ID 1
```

### AI Analysis (1 tool)

| Tool | Description |
|------|-------------|
| `ai_analyze` | Claude-powered analysis of DeFi data |

**Example:**
```
> Analyze current market conditions for CRO
> Explain the x402 payment flow
```

---

## x402 Payment Flow

When a tool requires payment (like `relay_get_quote`), it returns:

```json
{
  "status": "payment_required",
  "x402": {
    "amount": "10000",
    "amountFormatted": "0.01 USDC",
    "token": "USDC",
    "recipient": "0x...",
    "network": "cronos_testnet",
    "chainId": 338,
    "resource": "/api/perpai/quote"
  }
}
```

**Flow:**
1. Tool returns `payment_required` status
2. Use `relay_x402_info` to get full payment details
3. Complete the on-chain USDC transfer
4. Retry the tool with `paymentId` parameter

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `RELAY_CORE_API_URL` | No | Relay Core backend (default: localhost:4000) |
| `RELAY_CORE_API_KEY` | No | API key for authenticated access |
| `CLAUDE_API_KEY` | No | Anthropic API key (for `ai_analyze`) |
| `CRONOS_RPC_URL` | No | Custom Cronos RPC endpoint |
| `CRONOSCAN_API_KEY` | No | Cronoscan API key (higher rate limits) |
| `PYTH_PRICE_SERVICE_URL` | No | Custom Pyth endpoint |

---

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    Claude Code / MCP Client                │
└──────────────────────────┬─────────────────────────────────┘
                           │ stdio
┌──────────────────────────▼─────────────────────────────────┐
│                   Relay Core MCP Server                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   Tool Registry                      │  │
│  │  ┌────────────┐ ┌────────────┐ ┌─────────────────┐   │  │
│  │  │ Crypto.com │ │   Cronos   │ │   Relay Core    │   │  │
│  │  │  4 tools   │ │  9 tools   │ │    8+ tools     │   │  │
│  │  └────────────┘ └────────────┘ └─────────────────┘   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              API Key Authentication                  │  │
│  │  - Validates rc_xxxxx API keys                       │  │
│  │  - Rate limiting (100 req/hour)                      │  │
│  │  - Permission checking                               │  │
│  └──────────────────────────────────────────────────────┘  │
└────────┬────────────────────┬────────────────────┬─────────┘
         │                    │                    │
   ┌─────▼─────┐        ┌─────▼─────┐       ┌──────▼──────┐
   │ Crypto.com│        │  Cronos   │       │ Relay Core  │
   │ Exchange  │        │   RPC     │       │    API      │
   │   API     │        │           │       │             │
   └───────────┘        └───────────┘       └─────────────┘
```

---

## Cronos Network Configuration

| Network | Chain ID | RPC Endpoint |
|---------|----------|--------------|
| Mainnet | 25 | `https://evm.cronos.org` |
| Testnet | 338 | `https://evm-t3.cronos.org` |

Tools support both networks via the `network` parameter:
```
> Get balance for 0x... on mainnet
> Check gas price on testnet
```

---

## Development

```bash
# Build TypeScript
npm run build

# Run built version
npm start

# Run in development mode (with hot reload)
npm run dev
```

---

## Example Session

```
You: What's the current BTC price on Crypto.com?

Claude: [Uses crypto_com_get_ticker tool]
The current BTC/USDT price on Crypto.com is $97,234.50
- 24h High: $98,100.00
- 24h Low: $96,500.00  
- 24h Volume: 1,234.56 BTC

You: Find me oracle services with good reputation

Claude: [Uses relay_discover_services tool with API key]
Found 3 oracle services with reputation > 80:
1. PerpAI Quote Agent (ID: 1) - Score: 95 - $0.01/request
2. Pyth Price Feed - Score: 88 - Free
3. Chainlink Oracle - Score: 92 - $0.05/request

You: Register my agent as a data provider

Claude: [Uses relay_register_agent tool]
✅ Agent registered on Cronos Testnet!
- Agent ID: 2
- IPFS: ipfs://bafybei...
- TX: 0x1234...
```

---

## License

MIT
