# Relay Core - Production Architecture

## Product Overview

**Relay Core** is the payment infrastructure for autonomous agents on Cronos, combining:
1. **Infrastructure Layer**: ERC-8004 Agent NFTs, on-chain reputation, IPFS metadata
2. **Application Layer**: Relay Trade (perpetual DEX aggregator)

**Hackathon Tracks**: Dev Tooling + Agentic Finance + Ecosystem Integration

---

## Tech Stack

### Frontend
- **Framework**: React + Vite
- **UI**: shadcn/ui + Tailwind CSS
- **State**: TanStack Query (React Query)
- **Wallet**: Reown AppKit (WalletConnect)
- **Responsive**: Mobile/Tablet/Desktop configurations

### Backend
- **Database**: Supabase (PostgreSQL + Auth + Realtime)
- **API**: GraphQL (Apollo Server) + REST
- **Indexers**: Node.js cron jobs (node-schedule)
- **Auth**: Wallet-based (SIWE pattern)

### Blockchain
- **Network**: Cronos EVM Testnet (Chain 338)
- **Contracts**: Solidity (Hardhat) - ERC-8004 registries
- **Payments**: x402 Facilitator SDK (EIP-3009 gasless)
- **Metadata**: IPFS via Pinata

### Infrastructure
- **Hosting**: Vercel (Frontend) + Supabase (Backend)
- **Monitoring**: Sentry + Health Checks
- **CI/CD**: GitHub Actions

---

## Smart Contracts (Cronos Testnet)

| Contract | Address | Purpose |
|----------|---------|---------|
| **IdentityRegistry** | `0x4b697D8ABC0e3dA0086011222755d9029DBB9C43` | Agent NFT registration |
| **ReputationRegistry** | `0xdaFC2fA590C5Ba88155a009660dC3b14A3651a67` | On-chain feedback |
| **ValidationRegistry** | `0x0483d030a1B1dA819dA08e2b73b01eFD28c67322` | Independent validation |

All contracts are verified on [Cronos Explorer](https://explorer.cronos.org/testnet).

---

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
└────────────┼─────────────────────┼────────────────────┼─── ─────────┘
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
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │               REST API Endpoints                               │ │
│  │                                                                │ │
│  │  - POST /api/services      - GET /api/agents                   │ │
│  │  - POST /api/pay (x402)    - GET /api/prices                   │ │
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
│  │   (5min)      │  │ - Score Calc   │  │ - Venue Selection     │   │ 
│  │ - Activity    │  │ - Time Decay   │  │ - Price Quotes        │   │
│  │   (15min)     │  │ - Cache Mgmt   │  │ - Order Routing       │   │
│  │ - Reputation  │  │                │  │                       │   │
│  │   (daily)     │  │                │  │                       │   │
│  └───────────────┘  └────────────────┘  └───────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                   ↓
┌─────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                                  │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                  Supabase PostgreSQL                           │ │
│  │                                                                │ │
│  │  - services, payments, outcomes       - Row Level Security     │ │
│  │  - agent_activity, agent_reputation   - Realtime Subscriptions │ │
│  │  - dex_venues, trades                 - Connection Pooling     │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                        IPFS (Pinata)                           │ │
│  │                                                                │ │
│  │  - Agent metadata (ERC-721 standard)   - Permanent storage     │ │
│  │  - Feedback proofs                     - Content addressing    │ │
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
│  │               │  │               │  │  - Moonlander         │    │
│  │ - Market data │  │ - Price feeds │  │  - VVS Finance        │    │
│  │ - Tickers     │  │ - BTC, ETH,   │  │  - Delphi Trade       │    │
│  │ - Orderbooks  │  │   CRO, etc.   │  │                       │    │
│  └───────────────┘  └───────────────┘  └───────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Agent Registration Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     AGENT REGISTRATION FLOW                         │
└─────────────────────────────────────────────────────────────────────┘

  ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
  │ 1. Form  │ ──► │ 2. IPFS  │ ──► │ 3. Chain │ ──► │ 4. Index │
  │ Details  │     │ Upload   │     │ Register │     │ Supabase │
  └──────────┘     └──────────┘     └──────────┘     └──────────┘
       │                │                │                │
       ▼                ▼                ▼                ▼
  User fills      Metadata         registerAgent()    Save to DB
  agent form      uploaded to      called on          for discovery
  (name, type,    Pinata IPFS      IdentityRegistry   & analytics
  endpoint,       Returns:         Returns:
  price)          ipfs://...       agentId, txHash
```

---

## x402 Payment Flow

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

---

## Database Schema

### Core Tables

```sql
-- Agent services
CREATE TABLE agent_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_address TEXT NOT NULL,
  agent_id INTEGER,              -- On-chain ID from IdentityRegistry
  name TEXT NOT NULL,
  description TEXT,
  service_type TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  price_per_request DECIMAL(18,8),
  ipfs_uri TEXT,                 -- Metadata URI
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment transactions
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_hash TEXT UNIQUE NOT NULL,
  payer_address TEXT NOT NULL,
  receiver_address TEXT NOT NULL,
  service_id UUID REFERENCES agent_services(id),
  amount DECIMAL(18,8) NOT NULL,
  status TEXT NOT NULL,          -- pending, success, failed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reputation scores (computed)
CREATE TABLE agent_reputation (
  agent_address TEXT PRIMARY KEY,
  reputation_score DECIMAL(5,2),
  successful_transactions INTEGER DEFAULT 0,
  failed_transactions INTEGER DEFAULT 0,
  last_calculated TIMESTAMPTZ
);
```

---

## Security Considerations

### Development
- Environment variables in `.env` (never commit)
- RLS policies on all Supabase tables
- Public read, service role write

### Production (Recommended)
- AWS Nitro Enclave for key management
- AWS KMS for signing operations
- Rate limiting (100 req/min per IP)
- API key authentication
- CORS configuration

---

## Quick Start

```bash
# Install dependencies
pnpm install

# Start all services
pnpm dev              # Frontend (port 5173)
pnpm dev:graphql      # GraphQL API (port 4000)
pnpm dev:indexers     # Background cron jobs

# MCP Server (for Claude integration)
npx tsx mcp-server/index.ts
```

---

## Environment Variables

See `.env.example` for complete list. Key variables:

| Category | Variable | Purpose |
|----------|----------|---------|
| Supabase | `VITE_SUPABASE_URL` | Database & Auth |
| Cronos | `VITE_CRONOS_RPC_URL` | Blockchain RPC |
| x402 | `VITE_X402_FACILITATOR_URL` | Payment settlement |
| IPFS | `VITE_PINATA_JWT` | Metadata storage |
| Contracts | `VITE_IDENTITY_REGISTRY_ADDRESS` | Agent NFTs |

---

**Built for Cronos x402 Paytech Hackathon**  
**Status**: Production-ready core with ongoing enhancements
