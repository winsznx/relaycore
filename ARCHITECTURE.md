# Relay Core - Complete Production Architecture

## Product Overview

Relay Core is the payment and coordination infrastructure for autonomous agents on Cronos, combining:
1. **Infrastructure Layer**: ERC-8004 Agent NFTs, on-chain reputation, IPFS metadata, escrow sessions
2. **Application Layer**: PerpAI (perpetual DEX aggregator), RWA Settlement, Agent Coordination
3. **Integration Layer**: x402 payments, MCP tools, Cronos SDK, social identity

## Tech Stack

### Frontend
- React + Vite
- shadcn/ui + Tailwind CSS
- TanStack Query (React Query)
- Reown AppKit (WalletConnect)
- Responsive design

### Backend
- Supabase (PostgreSQL + Auth + Realtime)
- GraphQL (Apollo Server) + REST
- Node.js cron jobs (node-schedule)
- Wallet-based auth (SIWE)

### Blockchain
- Cronos EVM Testnet (Chain 338)
- Solidity contracts (Hardhat)
- x402 Facilitator SDK (EIP-3009)
- IPFS via Pinata

### Infrastructure
- Vercel (Frontend)
- Supabase (Backend)
- Sentry + Health Checks
- GitHub Actions CI/CD

## Smart Contracts (Cronos Testnet)

| Contract | Address | Purpose |
|----------|---------|---------|
| **IdentityRegistry** | `0x4b697D8ABC0e3dA0086011222755d9029DBB9C43` | Agent NFT registration |
| **ReputationRegistry** | `0xdaFC2fA590C5Ba88155a009660dC3b14A3651a67` | On-chain feedback |
| **ValidationRegistry** | `0x0483d030a1B1dA819dA08e2b73b01eFD28c67322` | Independent validation |

## Complete Service Inventory

### 1. Agent Services
- **AgentDiscoveryService**: Multi-source agent discovery (database, on-chain, URL-based, IPFS)
- **MetaAgentService**: Meta-agent orchestration and delegation
- **AgentRegistry**: Agent registration and lifecycle management
- **PerpAIAdapter**: PerpAI agent adapters (quote, trade, venues)

### 2. AI Services
- **ClaudeService**: Claude AI integration with streaming
- **ClaudeMCPService**: Claude with MCP tool integration
- **IntentClassifier**: Natural language intent classification
- **RelayAgentService**: Relay Core AI agent
- **ChatOrchestrator**: Multi-turn conversation management

### 3. Payment Services
- **X402SessionService**: x402-based session management
- **FacilitatorService**: Cronos Facilitator SDK integration
- **PaymentMiddleware**: x402 route protection
- **EscrowPaymentHelper**: Escrow payment integration
- **RWAPaymentService**: RWA-specific x402 payments

### 4. Escrow Services
- **EscrowAgentService**: Session-based escrow management
- **SessionManager**: Off-chain session tracking
- **SigningService**: Transaction preparation and signing
- **PendingTransactionStore**: Transaction handoff management

### 5. RWA Services
- **RWASettlementAgent**: Real-world service settlement with SLA verification
- **RWAAgentService**: RWA asset lifecycle management
- **RWAAgentCoordinator**: Multi-agent RWA task coordination
- **RWAStateMachineService**: RWA state transitions
- **RWAPaymentService**: RWA-specific payment flows

### 6. Trading Services
- **TradeRouter**: Multi-venue trade routing
- **MultiDexAggregator**: 6-venue DEX price aggregation (VVS, Moonlander, Delphi, Crypto.com, Cetus, Fulcrom)
- **PythPriceService**: Real-time Pyth oracle integration
- **TradeValidation**: High-value trade validation

### 7. Indexer Services
- **PaymentIndexer**: x402 payment event indexing (5min)
- **AgentIndexer**: Agent registration event indexing
- **EscrowSessionIndexer**: Escrow session event indexing
- **FeedbackIndexer**: Reputation feedback indexing
- **ReputationCalculator**: Reputation score calculation (daily)
- **TransactionIndexer**: General transaction indexing
- **RWAStateIndexer**: RWA state change indexing
- **GraphIndexer**: Service relationship graph
- **PerpIndexer**: Perpetual position/trade indexing
- **TemporalIndexer**: Time-series data indexing

### 8. Identity Services
- **IdentityService**: Cross-platform identity resolution
- **SocialIdentityService**: Social platform identity linking (Twitter, Telegram, Discord)
- **ZAuthClient**: zAuth x402 integration

### 9. Integration Services
- **CronosSDK**: Cronos Developer Platform SDK
- **CryptoComMCPClient**: Crypto.com market data MCP
- **WellKnownService**: .well-known endpoint serving
- **BotLinking**: Telegram/Discord bot integration
- **NotificationService**: Cross-platform notifications

### 10. Infrastructure Services
- **HealthCheckService**: System health monitoring
- **ObservabilityService**: Metrics, traces, alerts
- **ReputationEngine**: Reputation calculation engine
- **OutcomeService**: Outcome recording and tracking
- **TaskStore**: Task queue management

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                │
│                                                                     │
│  ┌───────────────────┐  ┌──────────────────┐  ┌─────────────────┐   │
│  │   React + Vite    │  │   MCP Server     │  │   Agent SDK     │   │
│  │   (Dashboard)     │  │   (53 tools)     │  │  (TypeScript)   │   │
│  └─────────┬─────────┘  └────────┬─────────┘  └───────┬─────────┘   │
│            │                     │                    │             │
└────────────┼─────────────────────┼────────────────────┼─────────────┘
             │                     │                    │
             └─────────────────────┴────────────────────┘
                                   ↓
┌─────────────────────────────────────────────────────────────────────┐
│                         API LAYER                                   │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │               GraphQL Server (Apollo)                          │ │
│  │                                                                │ │
│  │  - Agent queries           - Reputation queries                │ │
│  │  - Service discovery       - Payment history                   │ │
│  │  - RWA operations          - Session management                │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │               REST API Endpoints                               │ │
│  │                                                                │ │
│  │  - POST /api/services      - GET /api/agents                   │ │
│  │  - POST /api/pay (x402)    - GET /api/prices                   │ │
│  │  - POST /api/trade/quote   - GET /api/rwa/settle               │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                   ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      BUSINESS LOGIC LAYER                           │
│                                                                     │
│  ┌───────────────┐  ┌────────────────┐  ┌───────────────────────┐   │  
│  │   Indexers    │  │   Reputation   │  │    Trade Router       │   │
│  │               │  │     Engine     │  │     (PerpAI)          │   │
│  │ - Payment     │  │                │  │                       │   │
│  │   (5min)      │  │ - Score Calc   │  │ - 6 Venue Quotes      │   │ 
│  │ - Activity    │  │ - Time Decay   │  │ - Price Aggregation   │   │
│  │   (15min)     │  │ - Cache Mgmt   │  │ - Order Routing       │   │
│  │ - Reputation  │  │                │  │                       │   │
│  │   (daily)     │  │                │  │                       │   │
│  │ - RWA State   │  │                │  │                       │   │
│  └───────────────┘  └────────────────┘  └───────────────────────┘   │
│                                                                     │
│  ┌───────────────┐  ┌────────────────┐  ┌───────────────────────┐   │
│  │  RWA Services │  │  Escrow Agent  │  │   Session Manager     │   │
│  │               │  │                │  │                       │   │
│  │ - Settlement  │  │ - Budget Track │  │ - Off-chain Sessions  │   │
│  │ - SLA Verify  │  │ - Payment Lock │  │ - x402 Integration    │   │
│  │ - Coordinator │  │ - Refunds      │  │ - Payment Tracking    │   │
│  └───────────────┘  └────────────────┘  └───────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                   ↓
┌─────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                                  │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                  Supabase PostgreSQL                           │ │
│  │                                                                │ │
│  │  Tables:                                                       │ │
│  │  - services, payments, outcomes       - sessions               │ │
│  │  - agent_activity, agent_reputation   - rwa_execution_requests │ │
│  │  - dex_venues, trades                 - x402_payments          │ │
│  │  - escrow_sessions, feedback          - identity_mappings      │ │
│  │                                                                │ │
│  │  Features: RLS, Realtime, Connection Pooling                   │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                        IPFS (Pinata)                           │ │
│  │                                                                │ │
│  │  - Agent metadata (ERC-721)    - Permanent storage             │ │
│  │  - Feedback proofs             - Content addressing            │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                   ↓
┌─────────────────────────────────────────────────────────────────────┐
│                       BLOCKCHAIN LAYER                              │
│                                                                     │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────┐    │
│  │  Cronos EVM   │  │ x402 Facili-  │  │   ERC-8004 Contracts  │    │
│  │    (RPC)      │  │    tator      │  │                       │    │
│  │               │  │               │  │  - IdentityRegistry   │    │
│  │ - Testnet 338 │  │ - Payment     │  │  - ReputationRegistry │    │
│  │ - Multi-RPC   │  │   settlement  │  │  - ValidationRegistry │    │
│  │   failover    │  │ - EIP-3009    │  │                       │    │
│  └───────────────┘  └───────────────┘  └───────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                   ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    EXTERNAL INTEGRATIONS                            │
│                                                                     │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────┐    │
│  │  Crypto.com   │  │     Pyth      │  │      DEX APIs         │    │
│  │   Exchange    │  │    Oracle     │  │                       │    │
│  │               │  │               │  │  - VVS Finance        │    │
│  │ - Market data │  │ - Price feeds │  │  - Moonlander         │    │
│  │ - MCP client  │  │ - BTC, ETH,   │  │  - Delphi Trade       │    │
│  │ - Orderbooks  │  │   CRO, ATOM   │  │  - Cetus, Fulcrom     │    │
│  └───────────────┘  └───────────────┘  └───────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

## x402 Payment Flow (9 Steps)

```
┌─────────────────────────────────────────────────────────────────────┐
│                       x402 PAYMENT FLOW                             │
└─────────────────────────────────────────────────────────────────────┘

  Client                    Server                    Facilitator
    │                          │                           │
    │  1. GET /api/resource    │                           │
    │ ─────────────────────────►                           │
    │                          │                           │
    │  2. 402 Payment Required │                           │
    │     + x402 challenge     │                           │
    │ ◄─────────────────────────                           │
    │                          │                           │
    │  3. Generate EIP-3009    │                           │
    │     authorization        │                           │
    │                          │                           │
    │  4. POST /api/pay        │                           │
    │     + paymentHeader      │                           │
    │ ─────────────────────────►                           │
    │                          │  5. Verify & Settle       │
    │                          │ ─────────────────────────►│
    │                          │                           │
    │                          │  6. Settlement OK         │
    │                          │ ◄─────────────────────────│
    │                          │                           │
    │  7. 200 OK + paymentId   │                           │
    │ ◄─────────────────────────                           │
    │                          │                           │
    │  8. GET /api/resource    │                           │
    │     + x-payment-id       │                           │
    │ ─────────────────────────►                           │
    │                          │                           │
    │  9. 200 OK + content     │                           │
    │ ◄─────────────────────────                           │
```

## RWA Settlement Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    RWA SETTLEMENT FLOW                              │
└─────────────────────────────────────────────────────────────────────┘

  Agent                   RWA Service              Escrow
    │                          │                      │
    │  1. Request Execution    │                      │
    │ ─────────────────────────►                      │
    │                          │  2. Lock Funds       │
    │                          │ ────────────────────►│
    │                          │                      │
    │                          │  3. Execute Service  │
    │                          │     (off-chain)      │
    │                          │                      │
    │  4. Submit Proof         │                      │
    │ ─────────────────────────►                      │
    │                          │  5. Verify SLA       │
    │                          │     (latency, fields,│
    │                          │      signature)      │
    │                          │                      │
    │                          │  6. Release/Refund   │
    │                          │ ────────────────────►│
    │                          │                      │
    │  7. Settlement Result    │                      │
    │ ◄─────────────────────────                      │
```

## Database Schema

### Core Tables

```sql
CREATE TABLE services (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  service_type TEXT,
  description TEXT,
  endpoint_url TEXT,
  owner_address TEXT NOT NULL,
  price_per_call DECIMAL(18,8),
  category TEXT,
  metadata JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payments (
  id UUID PRIMARY KEY,
  payment_id TEXT UNIQUE,
  tx_hash TEXT,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  amount DECIMAL(18,8) NOT NULL,
  token_address TEXT,
  resource_url TEXT,
  service_id UUID REFERENCES services(id),
  status TEXT NOT NULL,
  block_number BIGINT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sessions (
  id SERIAL PRIMARY KEY,
  owner_address TEXT NOT NULL,
  max_spend DECIMAL(18,8) NOT NULL,
  deposited DECIMAL(18,8) DEFAULT 0,
  released DECIMAL(18,8) DEFAULT 0,
  remaining DECIMAL(18,8),
  payment_method TEXT DEFAULT 'x402',
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE agent_reputation (
  agent_address TEXT PRIMARY KEY,
  reputation_score DECIMAL(5,2),
  successful_transactions INTEGER DEFAULT 0,
  failed_transactions INTEGER DEFAULT 0,
  total_volume DECIMAL(18,8) DEFAULT 0,
  last_calculated TIMESTAMPTZ
);

CREATE TABLE rwa_execution_requests (
  request_id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL,
  session_id INTEGER REFERENCES sessions(id),
  agent_address TEXT NOT NULL,
  input JSONB,
  price DECIMAL(18,8),
  sla_terms JSONB,
  proof JSONB,
  verification JSONB,
  status TEXT NOT NULL,
  requested_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ
);

CREATE TABLE identity_mappings (
  id UUID PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  platform TEXT NOT NULL,
  platform_id TEXT NOT NULL,
  platform_username TEXT,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(wallet_address, platform)
);
```

## Environment Variables

| Category | Variable | Purpose |
|----------|----------|---------|
| Supabase | `VITE_SUPABASE_URL` | Database & Auth |
| Supabase | `VITE_SUPABASE_ANON_KEY` | Public API key |
| Supabase | `SUPABASE_SERVICE_ROLE_KEY` | Admin operations |
| Cronos | `VITE_CRONOS_RPC_URL` | Blockchain RPC |
| Cronos | `CRONOS_RPC_URL` | Server-side RPC |
| x402 | `VITE_X402_FACILITATOR_URL` | Payment settlement |
| x402 | `VITE_USDCE_CONTRACT` | USDC token address |
| Contracts | `VITE_IDENTITY_REGISTRY_ADDRESS` | Agent NFTs |
| Contracts | `VITE_REPUTATION_REGISTRY_ADDRESS` | Reputation |
| Contracts | `VITE_VALIDATION_REGISTRY_ADDRESS` | Validation |
| IPFS | `VITE_PINATA_JWT` | Metadata storage |
| IPFS | `VITE_PINATA_GATEWAY` | IPFS gateway |
| AI | `ANTHROPIC_API_KEY` | Claude AI |
| Pyth | `VITE_PYTH_ENDPOINT` | Price oracle |
| WalletConnect | `VITE_WALLETCONNECT_PROJECT_ID` | Wallet connection |

## Quick Start

```bash
pnpm install

pnpm dev              # Frontend (port 5173)
pnpm dev:graphql      # GraphQL API (port 4000)
pnpm dev:indexers     # Background cron jobs

npx tsx mcp-server/index.ts  # MCP Server
```

**Built for Cronos x402 Paytech Hackathon**  
**Status**: Production-ready with comprehensive feature set
