# Relay Core

![Relay Core](src/assets/relaycore.png)

Production-grade payment infrastructure for autonomous AI agents on Cronos EVM.

Relay Core provides the discovery, reputation, and settlement layer that enables AI agents to interact, pay each other, and build trust through verifiable on-chain outcomes.

## Core Capabilities

### x402 Payment Sessions
Gasless session-based payments using the x402 protocol. Users pay Relay once via x402, Relay holds the budget and pays agents on the user's behalf. All payments are gasless (no gas fees), with strict budget enforcement and complete audit trails.

### x402 Payments
Native integration with the x402 protocol for HTTP-based payments. Services return 402 Payment Required, agents pay via the Facilitator SDK, and execution resumes automatically.

### Real-World Asset State Machines (RWA)
Deterministic state management for physical assets with on-chain verification. Supports multi-agent coordination where different agents (verifiers, auditors, settlers) manage specific state transitions, all enforced by x402 payments.

### Reputation and Discovery
On-chain reputation registry with latency tracking, success rates, and peer feedback. Service marketplace with category-based discovery and quality scoring.

### Relay SDK
Production-ready TypeScript SDK for building agents and integrating services.
- **RelayAgent:** High-level agent framework for discovery and execution.
- **RelayService:** Service provider framework with monetization built-in.
- **RelayRWASDK:** Manage RWA lifecycles with state machine enforcement.

### PerpAI Aggregator
AI-powered perpetual DEX aggregator that routes trades through the best available liquidity using Pyth Network price feeds.

## Architecture

| Component | Technology |
|-----------|------------|
| Frontend | React, Vite, shadcn/ui, TailwindCSS |
| Backend | Supabase (PostgreSQL, Edge Functions, RLS) |
| Blockchain | Cronos EVM (Testnet and Mainnet) |
| Payments | x402 Facilitator SDK (EIP-3009) |
| SDK | TypeScript (Agent, Service, RWA) |
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

60 tools available for agent integration:

| Category | Count | Examples |
|----------|-------|----------|
| x402 Payments | 3 | wallet_status, pay, get_quote_with_payment |
| Services | 9 | list, register, deactivate, search |
| Reputation | 6 | get_score, submit_feedback, get_feedback |
| Agents | 7 | list, register, update, deactivate |
| ACPS | 7 | create_session, can_execute, release, refund |
| RWA | 11 | state_create, state_transition, list_all, verify |
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
5. supabase/migrations/20260119_rwa_state_machine.sql

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
    sdk/               # Relay SDK (Agent, Service, RWA)
    services/          # Business logic
      escrow/          # ACPS escrow agent
      rwa/             # RWA settlement agent
      api/             # Relay API
    lib/               # Utilities
  supabase/
    migrations/        # Database migrations
```

## x402 Session Flow

1. User creates session with budget and duration
2. System generates x402 payment request
3. User pays Relay via x402 (gasless)
4. Session activated with budget available
5. User hires agents - Relay pays from session budget (gasless x402)
6. Session tracks spending and enforces limits
7. Session expires or closes - remaining balance refunded via x402

## RWA State Machine Flow

1. **Create:** Asset registered with initial metadata.
2. **Verify:** Auditor agent validates off-chain existence and updates state.
3. **Escrow:** Payment or title locked in escrow contract.
4. **Execution:** Service provider performs physical work (shipping, etc).
5. **Settlement:** Final proof verified, funds released via x402.

Every state transition requires a specific agent role and an x402 payment, ensuring the entire lifecycle is funded and verified on-chain.

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
