# Relay Core MCP Server

Model Context Protocol server providing structured access to Cronos blockchain, Crypto.com Exchange API, and Relay Core payment infrastructure. Enables AI agents to discover services, execute x402 payments, query on-chain state, and access market data through 60+ tools.

## Server Architecture

The MCP server operates as a stdio-based tool provider exposing three integration layers:

**Crypto.com Exchange Integration**
- Real-time ticker data (price, volume, bid/ask spreads)
- Order book depth with configurable levels
- OHLCV candlestick data with multiple timeframes
- Trading pair enumeration

**Cronos Blockchain Integration**
- Block queries (number, details, transactions)
- Account balance checks (CRO and ERC-20 tokens)
- Transaction lookups by hash
- Smart contract read calls
- Event log retrieval
- Gas price estimation

**Relay Core Services Integration**
- Agent discovery with reputation filtering
- Service registration and search
- x402 payment settlement
- Session management (create, activate, query)
- RWA state transitions
- Reputation score queries

## Tool Categories

### x402 Payments (3 tools)

**wallet_status**
Returns wallet address, CRO balance, USDC balance, and auto-pay configuration.

**pay**
Settles x402 payment via Facilitator SDK. Requires payment header and requirements from 402 response.

**get_quote_with_payment**
Fetches perpetual DEX quote with automatic payment handling.

### Services (9 tools)

**list_services**
Returns all registered services with filtering by category, type, and active status.

**register_service**
Registers new service with name, endpoint, pricing, and metadata.

**deactivate_service**
Deactivates service by ID.

**search_services**
Searches services by category, type, or keyword.

**get_service_details**
Returns full service configuration including SLA terms.

**update_service**
Updates service metadata and pricing.

**get_service_metrics**
Returns call count, success rate, and latency statistics.

**get_service_reputation**
Returns reputation score with trend analysis.

**list_service_categories**
Enumerates available service categories.

### Reputation (6 tools)

**get_reputation_score**
Returns agent reputation score with success rate and volume metrics.

**submit_feedback**
Records feedback with rating, comment, and proof hash.

**get_feedback_history**
Returns all feedback submissions for an agent.

**get_reputation_trend**
Returns historical reputation data with time series.

**get_top_agents**
Returns highest-rated agents by category.

**verify_feedback**
Verifies feedback proof hash against on-chain record.

### Agents (7 tools)

**list_agents**
Returns all registered agents with filtering by type and status.

**register_agent**
Mints agent NFT with IPFS metadata on IdentityRegistry contract.

**update_agent**
Updates agent metadata URI.

**deactivate_agent**
Deactivates agent by ID.

**get_agent_info**
Returns agent details including NFT token ID and metadata.

**search_agents**
Searches agents by capability or service type.

**get_agent_activity**
Returns agent execution history with outcomes.

### ACPS (7 tools)

**create_session**
Creates escrow session with max spend, duration, and authorized agents.

**can_execute**
Checks if agent can execute with payment from session.

**release_payment**
Releases payment from session to agent (escrow agent only).

**refund_session**
Refunds remaining balance to session owner.

**get_session_state**
Returns session balance, spending, and expiration.

**list_sessions**
Returns all sessions for an owner.

**close_session**
Deactivates session and triggers refund.

### RWA (11 tools)

**state_create**
Creates RWA asset with initial metadata.

**state_transition**
Transitions asset state with proof and agent signature.

**list_all_assets**
Returns all RWA assets with current state.

**verify_proof**
Verifies execution proof against SLA terms.

**get_asset_state**
Returns current state and transition history.

**register_rwa_service**
Registers RWA service with SLA terms.

**request_execution**
Requests off-chain execution with escrow lock.

**submit_proof**
Submits execution proof for verification.

**settle_execution**
Settles execution based on proof verification.

**get_execution_status**
Returns execution request status.

**list_rwa_services**
Returns all registered RWA services.

### Trading (9 tools)

**get_price**
Fetches Pyth oracle price for asset.

**get_quote**
Aggregates quotes from 6 perpetual DEX venues.

**execute_trade**
Routes trade to best venue.

**get_venues**
Returns all DEX venues with metrics.

**get_funding_rates**
Returns current funding rates across venues.

**get_position_history**
Returns user position history.

**get_trade_history**
Returns user trade history.

**get_liquidity**
Returns venue liquidity depth.

**get_market_stats**
Returns 24h volume and price statistics.

### Analytics (8 tools)

**provider_stats**
Returns service provider call count, revenue, and success rate.

**market_data**
Returns DEX market data with volume and liquidity.

**health_check**
Returns system health status for all services.

**get_indexer_status**
Returns indexer sync status and last block.

**get_payment_history**
Returns x402 payment history with settlement status.

**get_session_analytics**
Returns session usage statistics.

**get_reputation_leaderboard**
Returns top agents by reputation score.

**get_system_metrics**
Returns system-wide metrics (total payments, active sessions, registered agents).

## x402 Payment Flow

When a tool requires payment, it returns a 402 status with payment requirements:

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

**Settlement Process**
1. Tool returns `payment_required` status
2. Client retrieves full payment details via `relay_x402_info`
3. Client creates EIP-3009 authorization and signs with wallet
4. Client submits to settlement endpoint with payment header
5. Facilitator SDK verifies signature and settles USDC transfer on-chain
6. Client retries tool with `paymentId` parameter
7. Tool executes and returns result

## API Key Authentication

All service and agent tools require API key authentication for rate limiting and permission control.

**Obtaining API Key**
1. Connect wallet at dashboard
2. Navigate to Settings → API Keys
3. Click Generate API Key
4. Copy key immediately (displayed once)

**Using API Key**

In MCP tools:
```
Use relay_discover_services with API key rc_xxxxx
```

In HTTP requests:
```bash
curl https://api.relaycore.xyz/agents \
  -H "Authorization: Bearer rc_xxxxx"
```

In SDK:
```typescript
const sdk = createAgentSDK({
  apiKey: 'rc_xxxxx',
  walletAddress: '0x...'
});
```

**Permissions**

| Permission | Description | Default |
|------------|-------------|---------|
| `read_services` | Query services and agents | Yes |
| `read_reputation` | Query reputation scores | Yes |
| `read_outcomes` | View payment outcomes | Yes |
| `read_payments` | View payment history | Yes |
| `execute_payments` | Execute x402 payments | No |
| `register_agents` | Register new agents | Yes |

Note: `execute_payments` requires wallet signature and cannot be performed via API key alone.

## Environment Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `RELAY_CORE_API_URL` | No | Backend URL (default: localhost:4000) |
| `RELAY_CORE_API_KEY` | No | API key for authenticated access |
| `CLAUDE_API_KEY` | No | Anthropic API key for ai_analyze tool |
| `CRONOS_RPC_URL` | No | Custom Cronos RPC endpoint |
| `CRONOSCAN_API_KEY` | No | Cronoscan API key for higher rate limits |
| `PYTH_PRICE_SERVICE_URL` | No | Custom Pyth endpoint |
| `WALLET_PRIVATE_KEY` | No | Wallet for signing transactions |
| `ESCROW_CONTRACT_ADDRESS` | No | EscrowSession contract address |

## Installation and Setup

**Prerequisites**
- Node.js 20+
- npm or pnpm

**Install Dependencies**
```bash
npm install
```

**Configure Environment**
```bash
cp .env.example .env
# Edit .env with your API keys
```

**Build**
```bash
npm run build
```

**Run Server**
```bash
npm run dev
```

## Claude Desktop Integration

Add to Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "relay-core": {
      "command": "node",
      "args": ["/path/to/relaycore/mcp-server/dist/index.js"],
      "env": {
        "RELAY_CORE_API_URL": "http://localhost:4000",
        "RELAY_CORE_API_KEY": "rc_xxxxx",
        "WALLET_PRIVATE_KEY": "your-key",
        "ESCROW_CONTRACT_ADDRESS": "0x9D340a67ddD4Fcf5eC590b7B67e1fE8d020F7D61"
      }
    }
  }
}
```

**Verify Installation**
```bash
claude mcp list
```

## Cronos Network Configuration

| Network | Chain ID | RPC Endpoint |
|---------|----------|--------------|
| Mainnet | 25 | https://evm.cronos.org |
| Testnet | 338 | https://evm-t3.cronos.org |

Tools support both networks via `network` parameter:
```
Get balance for 0x... on mainnet
Check gas price on testnet
```

## Example Usage

**Market Data Query**
```
User: What's the current BTC price on Crypto.com?

Claude: [Uses crypto_com_get_ticker tool]
BTC/USDT: $97,234.50
24h High: $98,100.00
24h Low: $96,500.00
24h Volume: 1,234.56 BTC
```

**Service Discovery**
```
User: Find oracle services with reputation above 80

Claude: [Uses relay_discover_services tool with API key]
Found 3 oracle services:
1. PerpAI Quote Agent - Score: 95 - $0.01/request
2. Pyth Price Feed - Score: 88 - Free
3. Chainlink Oracle - Score: 92 - $0.05/request
```

**Agent Registration**
```
User: Register my agent as a data provider

Claude: [Uses relay_register_agent tool]
Agent registered on Cronos Testnet
Agent ID: 2
IPFS: ipfs://bafybei...
TX: 0x1234...
```

**x402 Payment**
```
User: Get a quote for 10x long ETH with $1000

Claude: [Uses relay_get_quote tool]
Payment required: 0.01 USDC
[User approves payment]
Quote: Entry $2,450.50, Liquidation $2,205.45
Estimated funding: -0.02% per 8h
```

## Development

**Build TypeScript**
```bash
npm run build
```

**Run Built Version**
```bash
npm start
```

**Development Mode with Hot Reload**
```bash
npm run dev
```

## License

MIT
