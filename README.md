# Relay Core

Production-grade payment infrastructure for autonomous AI agents on Cronos EVM.

Relay Core provides the discovery, reputation, and settlement layer that enables AI agents to interact, pay each other, and build trust through verifiable on-chain outcomes.

## Core Capabilities

### Agent-Controlled Payment Sessions (ACPS)
Session-based escrow that allows agents to execute autonomously within pre-approved spending limits. Agents operate without per-transaction wallet prompts while maintaining full custody guarantees through on-chain escrow.

### x402 Payments
Native integration with the x402 protocol for HTTP-based payments. Services return 402 Payment Required, agents pay via the Facilitator SDK, and execution resumes automatically.

### Real-World Asset Settlement (RWA)
Off-chain service verification with on-chain payment guarantees. Providers register services with SLA terms, agents request execution, and payments are released or refunded based on proof verification.

### Reputation and Discovery
On-chain reputation registry with latency tracking, success rates, and peer feedback. Service marketplace with category-based discovery and quality scoring.

### PerpAI Aggregator
AI-powered perpetual DEX aggregator that routes trades through the best available liquidity using Pyth Network price feeds.

## Architecture

| Component | Technology |
|-----------|------------|
| Frontend | React, Vite, shadcn/ui, TailwindCSS |
| Backend | Supabase (PostgreSQL, Edge Functions, RLS) |
| Blockchain | Cronos EVM (Testnet and Mainnet) |
| Payments | x402 Facilitator SDK (EIP-3009) |
| Oracles | Pyth Network |
| Trading | Moonlander Perpetual DEX |
| Agent Interface | Model Context Protocol (MCP) |
| Monitoring | Sentry |

## Smart Contracts

| Contract | Address (Cronos Testnet) | Purpose |
|----------|--------------------------|---------|
| EscrowSession | 0x9D340a67ddD4Fcf5eC590b7B67e1fE8d020F7D61 | ACPS payment escrow |
| IdentityRegistry | 0x4b697D8ABC0e3dA0086011222755d9029DBB9C43 | Agent identity (ERC-721) |
| ReputationRegistry | 0xdaFC2fA590C5Ba88155a009660dC3b14A3651a67 | Reputation storage |
| ValidationRegistry | 0x0483d030a1B1dA819dA08e2b73b01eFD28c67322 | Validation records |

## MCP Server

53 tools available for agent integration:

| Category | Count | Examples |
|----------|-------|----------|
| x402 Payments | 3 | wallet_status, pay, get_quote_with_payment |
| Services | 9 | list, register, deactivate, search |
| Reputation | 6 | get_score, submit_feedback, get_feedback |
| Agents | 7 | list, register, update, deactivate |
| ACPS | 7 | create_session, can_execute, release, refund |
| RWA | 4 | services, register, execute, settle |
| Trading | 9 | get_price, get_quote, execute_trade |
| Analytics | 8 | provider_stats, market_data, health |

## Quick Start

### Prerequisites

- Node.js 20 or higher
- pnpm (recommended) or npm
- Supabase account
- Cronos Testnet wallet with CRO and USDC

### Installation

```bash
git clone https://github.com/winsznx/relaycore.git
cd relaycore

pnpm install

cp .env.example .env
```

Configure environment variables:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_WALLETCONNECT_PROJECT_ID=your-project-id
WALLET_PRIVATE_KEY=your-private-key
ESCROW_CONTRACT_ADDRESS=0x9D340a67ddD4Fcf5eC590b7B67e1fE8d020F7D61
```

### Database Setup

```bash
pnpm db:migrate
```

Or run migrations manually in order:
1. supabase/migrations/001_relay_core_schema.sql
2. supabase/migrations/002_complete_schema.sql
3. supabase/migrations/012_escrow_sessions.sql
4. supabase/migrations/013_rwa_settlement.sql

### Development

```bash
pnpm dev:all        # Start all services
pnpm dev            # Frontend only (port 5173)
pnpm dev:graphql    # GraphQL API (port 4000)
pnpm dev:indexers   # Background jobs
```

### MCP Server

```bash
cd mcp-server
npm install
npm run build
```

Configure Claude Desktop:

```json
{
  "mcpServers": {
    "relay-core": {
      "command": "node",
      "args": ["/path/to/relaycore/mcp-server/dist/index.js"],
      "env": {
        "SUPABASE_URL": "your-url",
        "SUPABASE_ANON_KEY": "your-key",
        "WALLET_PRIVATE_KEY": "your-key",
        "ESCROW_CONTRACT_ADDRESS": "0x9D340a67ddD4Fcf5eC590b7B67e1fE8d020F7D61"
      }
    }
  }
}
```

### Production Build

```bash
pnpm build
```

## Project Structure

```
relaycore/
  contracts/           # Solidity contracts
  mcp-server/          # MCP server for agent integration
  src/
    components/        # React components
    pages/             # Page components
    services/          # Business logic
      escrow/          # ACPS escrow agent
      rwa/             # RWA settlement agent
      api/             # Relay API
    lib/               # Utilities
  supabase/
    migrations/        # Database migrations
```

## ACPS Flow

1. Agent requests session creation
2. System returns 402 Payment Required with escrow details
3. User deposits USDC into escrow contract
4. Agents execute autonomously within session limits
5. Payments released on success, refunded on failure
6. Session closes and returns remaining balance

## RWA Settlement Flow

1. Provider registers service with SLA terms
2. Agent requests execution with escrow-backed payment
3. Provider delivers proof of execution
4. System verifies proof against SLA (latency, format, signature)
5. Payment released if SLA met, refunded if not

## Security

- Escrow contract with ReentrancyGuard
- SafeERC20 for token transfers
- Rate limiting (100 calls per minute per session)
- Agent blacklisting
- Nonce tracking for replay prevention
- Comprehensive audit logging
- Row Level Security on all database tables

## Environment Variables

| Variable | Description |
|----------|-------------|
| VITE_SUPABASE_URL | Supabase project URL |
| VITE_SUPABASE_ANON_KEY | Supabase anonymous key |
| WALLET_PRIVATE_KEY | Wallet for signing transactions |
| ESCROW_CONTRACT_ADDRESS | EscrowSession contract address |
| CRONOS_RPC_URL | Cronos RPC endpoint |
| USDC_TOKEN_ADDRESS | USDC contract address |
| TELEGRAM_BOT_TOKEN | Telegram bot token (optional) |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

## License

MIT License

## Links

- Repository: https://github.com/winsznx/relaycore
- Documentation: /docs in the application
- Cronos: https://cronos.org
- x402 Protocol: https://www.x402.org
