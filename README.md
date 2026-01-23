# Relay Core

![Relay Core](src/assets/relaycore.png)

Production payment infrastructure for autonomous AI agents on Cronos EVM. Relay Core implements the x402 payment protocol with session-based escrow, enabling agents to discover services, execute paid operations, and settle real-world asset transactions through verifiable on-chain outcomes.

The system combines HTTP 402 payment gates with EIP-3009 authorization, Cronos Facilitator settlement, and session escrow to eliminate gas fees while maintaining strict budget enforcement and complete audit trails.

## System Architecture

Relay Core operates across five layers:

**Client Layer**
- React dashboard with real-time payment tracking
- Model Context Protocol server exposing 63 agent tools
- TypeScript SDK for agent and service integration
- RelayCore CLI for project scaffolding and deployment
- LangGraph chatbot with RAG-powered documentation

**API Layer**
- GraphQL server for agent discovery, reputation queries, and session management
- REST endpoints for x402 payment settlement, trade routing, and RWA coordination
- Protected routes using x402 middleware

**Business Logic Layer**
- Payment indexers polling on-chain events every 5 minutes
- Reputation engine calculating scores with time decay
- Trade router aggregating quotes from 6 perpetual DEX venues
- RWA settlement agent verifying SLA compliance
- Escrow agent managing session budgets and payment releases
- Session manager tracking off-chain payment state
- LangGraph chatbot with RAG context retrieval from Chroma Cloud

**Data Layer**
- Supabase PostgreSQL with Row Level Security
- IPFS metadata storage via Pinata
- Chroma Cloud vector database for RAG embeddings
- Tables: services, payments, sessions, agent_reputation, rwa_execution_requests, identity_mappings, chat_conversations

**Blockchain Layer**
- Cronos EVM Testnet (Chain 338)
- x402 Facilitator for EIP-3009 settlement
- Smart contracts: IdentityRegistry, ReputationRegistry, ValidationRegistry, EscrowSession

## Core Concepts

### x402 Payment Protocol

HTTP 402 Payment Required responses trigger client-side EIP-3009 authorization. The client signs a TransferWithAuthorization message, submits it to `/api/pay`, and the Facilitator SDK verifies the signature and settles the payment on-chain. The server grants entitlement and subsequent requests include the `x-payment-id` header to access protected resources.

### Session-Based Escrow

Users create sessions with a maximum spend limit and duration. The system generates an x402 payment request for the session deposit. Once paid, the session activates with the budget available. When agents are hired, Relay pays from the session budget via x402 on the user's behalf. All payments are gasless. Sessions track spending in real-time and enforce limits. Upon expiration or closure, remaining balances are refunded via x402.

### Agent-to-Agent Execution

Agents register in the IdentityRegistry contract as ERC-721 NFTs with IPFS metadata. The meta-agent service discovers agents through database queries, on-chain events, and .well-known endpoints. When hiring, the meta-agent creates an escrow session, delegates the task, and the target agent executes with payment deducted from the session. Reputation scores update based on execution outcomes.

### SLA-Based Settlement

RWA services register with SLA terms specifying maximum latency, required proof fields, and refund conditions. Agents request execution, and the RWA settlement agent locks funds in escrow. After off-chain execution, the service provider submits cryptographic proof. The settlement agent verifies latency, field presence, and signature validity. If SLA is met, funds release to the provider. If violated, funds refund to the requester.

### Route Proxy (x402 Wrapping)

The Route Proxy feature enables instant monetization of any API by wrapping it with x402 payment protection via a single CLI command. The system generates a proxy URL that intercepts requests, enforces payment, settles via the Facilitator SDK, and forwards to the upstream service.

**Example usage:**
```bash
relaycore route add --url https://api.example.com/data --price 0.01 --name "Data API"
# Output: https://api.relaycore.xyz/proxy/abc123
```

Requests to this proxy URL require an `X-Payment` header containing an EIP-3009 authorization. The proxy validates the payment on Cronos before forwarding the request, enabling developers to turn any API into a paid service without code changes.

### Indexing and Observability

Seven cron jobs index blockchain events and database state:
- Payment indexer: x402 transactions every 5 minutes
- Agent indexer: registration events every 15 minutes
- Escrow session indexer: session state every 2 minutes
- Feedback indexer: reputation submissions every 15 minutes
- Reputation calculator: score aggregation daily
- Transaction indexer: general on-chain events every minute
- RWA state indexer: asset lifecycle transitions every 2 minutes

All indexed data is queryable via GraphQL and exposed through MCP tools for agent consumption.

## End-to-End Execution Flow

**Session Creation**
1. User calls `POST /api/sessions/create` with `maxSpend` and `duration`
2. System inserts session record in database with `is_active: false`
3. System generates x402 payment requirements with `payTo` as Relay wallet address
4. Client receives 402 response with payment challenge
5. User signs EIP-3009 authorization via wallet
6. Client submits to `POST /api/pay` with `paymentHeader` and `paymentRequirements`
7. Facilitator SDK verifies signature and settles USDC transfer on-chain
8. System updates session record with `deposited` amount and `is_active: true`

**Budget Allocation**
1. Session manager calculates `remaining = deposited - released`
2. Frontend displays session balance in real-time via Supabase Realtime subscription
3. User selects session from dropdown when invoking paid services

**Paid Execution**
1. User calls `POST /api/perpai/quote` with `X-Session-Id` header
2. Payment middleware intercepts request and queries session from database
3. Middleware checks `remaining >= amountRequired`
4. If sufficient, middleware updates `released` field and inserts `session_payments` record
5. Middleware sets `req.isEntitled = true` and calls `next()`
6. PerpAI service executes quote aggregation across 6 DEX venues
7. Response returns quote data with updated session balance

**Settlement**
1. Payment indexer cron job runs every 5 minutes
2. Queries Cronos Explorer API for recent USDC transfer events
3. Matches `tx_hash` to `payments` table records
4. Updates `block_number` and `status` fields
5. Reputation calculator aggregates payment outcomes for each agent
6. Updates `agent_reputation` table with new scores

**Indexing**
1. GraphQL queries fetch indexed payment history
2. MCP tools expose `list_payments`, `get_session_state`, `get_reputation_score`
3. Agents consume indexed data to make autonomous decisions

## On-Chain Integration

### Smart Contracts

**EscrowSession** (`0x9D340a67ddD4Fcf5eC590b7B67e1fE8d020F7D61`)
- `createSession(address escrowAgent, uint256 maxSpend, uint256 duration, address[] agents)`: Creates session with authorized agents
- `deposit(uint256 sessionId, uint256 amount)`: Deposits USDC into session
- `release(uint256 sessionId, address agent, uint256 amount, bytes32 executionId)`: Releases payment to agent (escrow agent only)
- `refund(uint256 sessionId)`: Refunds remaining balance to owner
- `closeSession(uint256 sessionId)`: Deactivates session and refunds

**IdentityRegistry** (`0x4b697D8ABC0e3dA0086011222755d9029DBB9C43`)
- ERC-721 contract for agent NFT registration
- `registerAgent(string memory metadataURI)`: Mints agent NFT with IPFS metadata
- `updateMetadata(uint256 tokenId, string memory metadataURI)`: Updates agent metadata
- `getAgentMetadata(uint256 tokenId)`: Returns IPFS URI

**ReputationRegistry** (`0xdaFC2fA590C5Ba88155a009660dC3b14A3651a67`)
- `submitFeedback(address agent, uint8 rating, string memory comment, bytes32 proofHash)`: Records on-chain feedback
- `getReputation(address agent)`: Returns aggregated reputation data
- `getFeedbackCount(address agent)`: Returns total feedback submissions

**ValidationRegistry** (`0x0483d030a1B1dA819dA08e2b73b01eFD28c67322`)
- `recordValidation(bytes32 requestId, address validator, bool result, string memory evidence)`: Stores validation outcomes
- `getValidation(bytes32 requestId)`: Returns validation record

### Network Configuration

All contracts deployed on Cronos Testnet (Chain ID 338). RPC endpoints:
- Primary: `https://evm-t3.cronos.org`
- Fallback: `https://cronos-testnet.crypto.org:8545`

USDC token address: `0x...` (configured via `VITE_USDCE_CONTRACT`)

x402 Facilitator endpoint: `https://facilitator.cronos.org` (configured via `VITE_X402_FACILITATOR_URL`)

## Agentic Functionality

### Agent Entities

**Meta-Agent**
- Autonomous entity that discovers, evaluates, and hires other agents
- Decision logic: queries reputation scores, filters by service type, selects highest-rated agent within budget
- Autonomy enforcement: creates escrow sessions without user intervention, delegates tasks based on SLA terms

**RWA Settlement Agent**
- Verifies off-chain service execution against SLA terms
- Decision logic: checks proof latency, validates required fields, verifies cryptographic signatures
- Autonomy enforcement: automatically releases funds if SLA met, refunds if violated

**Escrow Agent**
- Manages session budgets and payment releases
- Decision logic: checks remaining balance, validates agent authorization, enforces rate limits
- Autonomy enforcement: releases payments on behalf of session owner, triggers refunds on expiration

**PerpAI Quote Agent**
- Aggregates quotes from 6 perpetual DEX venues
- Decision logic: selects best price with composite scoring (price, liquidity, latency)
- Autonomy enforcement: routes trades without manual approval when within session budget

### Verifiable Behaviors

All agent decisions are recorded in database tables with timestamps and execution IDs. Reputation updates are deterministic based on success/failure outcomes. Payment releases are logged with `tx_hash` for on-chain verification. SLA violations trigger automatic refunds with proof stored in `rwa_execution_requests.verification` JSONB field.

## Developer Tooling

### Relay SDK

**RelayAgent Class**
```typescript
import { RelayAgent } from '@/sdk/relay-agent'

const agent = new RelayAgent({
  agentId: 'my-agent',
  endpoint: 'https://api.example.com',
  pricePerCall: '1000000' // 1 USDC
})

await agent.register()
const result = await agent.execute({ input: 'data' })
```

**RelayService Class**
```typescript
import { RelayService } from '@/sdk/relay-service'

const service = new RelayService({
  name: 'Data Provider',
  serviceType: 'research',
  endpoint: 'https://api.example.com/data'
})

await service.register()
```

**RelayRWASDK Class**
```typescript
import { RelayRWASDK } from '@/sdk/rwa-sdk'

const rwa = new RelayRWASDK()
await rwa.createAsset({ metadata: { type: 'property' } })
await rwa.transitionState('asset-id', 'verified', { proof: '...' })
```

### MCP Server

63 tools organized by category:

**x402 Payments** (3 tools)
- `wallet_status`: Returns wallet address, CRO balance, USDC balance
- `pay`: Settles x402 payment via Facilitator SDK
- `get_quote_with_payment`: Fetches quote with automatic payment

**Services** (9 tools)
- `list_services`: Returns all registered services
- `register_service`: Registers new service with pricing
- `deactivate_service`: Deactivates service
- `search_services`: Searches by category or type

**Reputation** (6 tools)
- `get_reputation_score`: Returns agent reputation
- `submit_feedback`: Records feedback with proof
- `get_feedback_history`: Returns all feedback for agent

**Agents** (7 tools)
- `list_agents`: Returns all registered agents
- `register_agent`: Mints agent NFT with metadata
- `update_agent`: Updates agent metadata
- `deactivate_agent`: Deactivates agent

**ACPS** (7 tools)
- `create_session`: Creates escrow session
- `can_execute`: Checks if agent can execute with payment
- `release_payment`: Releases payment from session
- `refund_session`: Refunds remaining balance

**RWA** (11 tools)
- `state_create`: Creates RWA asset
- `state_transition`: Transitions asset state
- `list_all_assets`: Returns all RWA assets
- `verify_proof`: Verifies execution proof

**Trading** (9 tools)
- `get_price`: Fetches Pyth oracle price
- `get_quote`: Aggregates DEX quotes
- `execute_trade`: Routes trade to best venue

**Analytics** (8 tools)
- `provider_stats`: Returns service provider metrics
- `market_data`: Returns DEX market data
- `health_check`: Returns system health status

**Chat** (3 tools)
- `chat_message`: Sends message to LangGraph chatbot with RAG context
- `get_chat_history`: Retrieves conversation history
- `initialize_rag`: Indexes documentation into Chroma Cloud

### RelayCore CLI

Production-grade command-line interface for building AI agents:

**Commands**
- `relaycore init [project-name]`: Scaffolds new agent project with MCP server and Next.js dashboard
- `relaycore auth login`: Authenticates with RelayCore API key
- `relaycore dev`: Starts agent server and frontend concurrently
- `relaycore agent register`: Registers agent via SDK
- `relaycore service register`: Registers service with pricing
- `relaycore route add`: Creates x402-protected proxy routes for any API

**Scaffold Structure**
```
my-agent/
├── apps/
│   ├── agent-server/    # MCP-compatible runtime
│   └── web/             # Next.js dashboard
├── packages/
│   ├── config/          # Shared TypeScript config
│   └── types/           # Shared type definitions
└── relaycore.config.ts  # Agent configuration
```

**Installation**
```bash
npx relaycore init my-agent
cd my-agent
# Add RELAYCORE_API_KEY to .env
relaycore dev
```

### LangGraph Chatbot

Conversational AI with RAG-powered documentation retrieval:

**Architecture**
- LangGraph state machine with intent classification, context retrieval, and response generation
- Chroma Cloud vector database for documentation embeddings
- OpenAI embeddings for semantic search
- Claude 3.5 Sonnet for LLM responses

**Features**
- Intent classification (greeting, technical, payment, general)
- RAG context retrieval from indexed documentation
- Conversation history tracking in Supabase
- Streaming responses via Server-Sent Events

**API Endpoints**
- `POST /api/chat`: Send message and receive streaming response
- `GET /api/chat/history`: Retrieve conversation history
- `POST /api/chat/initialize-rag`: Index documentation into vector store

**Environment Variables**
```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
CHROMA_API_KEY=your-chroma-cloud-key
CHROMA_TENANT=your-tenant-id
CHROMA_DATABASE=relaycore
```

### API Endpoints

**GraphQL** (`http://localhost:4000/graphql`)
```graphql
query GetAgents {
  agents(where: { is_active: { _eq: true } }) {
    id
    name
    service_type
    reputation_score
  }
}
```

**REST**
- `POST /api/pay`: x402 payment settlement
- `POST /api/perpai/quote`: Protected quote endpoint
- `GET /api/sessions`: List user sessions
- `POST /api/rwa/settle`: RWA settlement request

## Playground

Visual workflow builder for testing x402 flows. Drag-and-drop nodes representing:
- Wallet connection
- Session creation
- Agent invocation
- Payment gates
- Service endpoints
- Indexer queries

**Execution Modes**

**Mock Mode** (default)
- Simulates x402 flow with realistic delays
- Returns synthetic data for testing
- No wallet signature required

**Real Mode**
- Calls actual backend services
- Requires funded wallet with USDC
- Executes real x402 payments via Facilitator SDK
- Queries live Cronos RPC for balance and block data
- Updates Supabase database with real transactions

Toggle via "Demo Mode" switch in Playground UI.

## Indexing and Observability

### Event Tracking

**Payment Events**
- Source: Cronos Explorer API
- Frequency: Every 5 minutes
- Data: `tx_hash`, `from_address`, `to_address`, `amount`, `block_number`
- Storage: `payments` table

**Agent Activity**
- Source: Supabase database triggers
- Frequency: Real-time
- Data: `agent_id`, `action_type`, `timestamp`, `outcome`
- Storage: `agent_activity` table

**State Transitions**
- Source: RWA service API
- Frequency: Every 2 minutes
- Data: `asset_id`, `from_state`, `to_state`, `proof_hash`
- Storage: `rwa_state_transitions` table

### Payment Records

All x402 payments recorded in `payments` table with fields:
- `payment_id`: Unique identifier from Facilitator
- `tx_hash`: On-chain transaction hash
- `from_address`: Payer wallet address
- `to_address`: Recipient wallet address
- `amount`: Payment amount in base units
- `token_address`: USDC contract address
- `resource_url`: Protected resource URL
- `service_id`: Associated service UUID
- `status`: `pending`, `settled`, `failed`
- `block_number`: Confirmation block
- `timestamp`: Settlement time

### State Transitions

RWA assets tracked through lifecycle states:
1. `created`: Initial registration
2. `verified`: Auditor validation complete
3. `escrowed`: Payment locked
4. `executing`: Service in progress
5. `settled`: Proof verified and payment released
6. `failed`: SLA violation or refund

Each transition logged in `rwa_state_transitions` with `agent_address`, `proof_hash`, and `timestamp`.

## Current Status

### Fully Implemented

**x402 Direct Payment**
- HTTP 402 challenge generation
- EIP-3009 authorization signing
- Facilitator SDK settlement
- Entitlement caching
- Protected route middleware
- PerpAI quote endpoint integration

**Session Management**
- Database-backed session creation
- x402 deposit flow
- Balance tracking with real-time updates
- Session payment deduction
- USDC refunds via Relay wallet

**MCP Server**
- 60 tools across 8 categories
- Cronos RPC integration
- Supabase query tools
- x402 payment tools
- Agent discovery tools

**PerpAI Aggregator**
- 6-venue quote aggregation (VVS, Moonlander, Delphi, Crypto.com, Cetus, Fulcrom)
- Pyth oracle price feeds
- Trade routing with composite scoring
- Funding rate tracking
- Position history

**Indexers**
- Payment indexer (5min cron)
- Agent indexer (15min cron)
- Escrow session indexer (2min cron)
- Reputation calculator (daily cron)
- RWA state indexer (2min cron)

### Partially Implemented

**On-Chain Escrow**
- EscrowSession.sol contract deployed
- TypeScript escrow agent service complete
- Not invoked by session service (uses database only)
- Requires `ESCROW_CONTRACT_ADDRESS` configuration

**RWA Settlement**
- SLA verification logic complete
- Proof submission and validation working
- Settlement uses database sessions, not on-chain escrow
- No deployed RWA token contract

**Meta-Agent Hiring**
- Agent discovery functional
- Hiring creates database delegation records
- Reputation scores computed but not enforced as access control
- Delegation execution calls agent endpoints

### Requires Configuration

**Smart Contract Integration**
- Contracts deployed but not called by backend services
- Backend uses Supabase queries instead of contract reads
- Requires environment variables for contract addresses

**Real-Time Indexing**
- Current implementation uses cron polling (1-15 min intervals)
- No WebSocket event subscription
- Indexer queries Explorer API, not direct event logs

## Deployment and Usage

### Local Development

**Prerequisites**
- Node.js 20+
- pnpm or npm
- Supabase account
- Cronos Testnet wallet with CRO and USDC
- Chroma Cloud account (for LangGraph chatbot RAG)
- OpenAI API key (for embeddings)
- Anthropic API key (for Claude LLM)

**Installation**
```bash
git clone https://github.com/winsznx/relaycore.git
cd relaycore
pnpm install
cp .env.example .env
```

**Environment Configuration**
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_WALLETCONNECT_PROJECT_ID=your-project-id
WALLET_PRIVATE_KEY=your-private-key
RELAY_PRIVATE_KEY=your-relay-wallet-key
ESCROW_CONTRACT_ADDRESS=0x9D340a67ddD4Fcf5eC590b7B67e1fE8d020F7D61
VITE_CRONOS_RPC_URL=https://evm-t3.cronos.org
VITE_USDCE_CONTRACT=0x...

ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
CHROMA_API_KEY=your-chroma-cloud-key
CHROMA_TENANT=your-tenant-id
CHROMA_DATABASE=relaycore
```

**Database Setup**
```bash
pnpm db:migrate
```

Or run migrations manually in order:
1. `001_relay_core_schema.sql`
2. `002_complete_schema.sql`
3. `012_escrow_sessions.sql`
4. `013_rwa_settlement.sql`
5. `20260119_rwa_state_machine.sql`
6. `20260122_fix_schema_gaps.sql`

**Start Services**
```bash
pnpm dev              # Frontend (port 5173)
pnpm dev:graphql      # GraphQL API (port 4000)
pnpm dev:indexers     # Background cron jobs
```

**MCP Server**
```bash
cd mcp-server
npm install
npm run build
npm run dev
```

**Configure Claude Desktop**
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

Output in `dist/` directory. Deploy to Vercel or any static hosting.

### Testing x402 Flow

1. Connect wallet with Cronos Testnet USDC
2. Navigate to Trade page
3. Select "Pay from x402 Session" or "Direct Payment"
4. Click "Get Quote"
5. Sign EIP-3009 authorization when prompted
6. Payment settles via Facilitator
7. Quote returns with updated session balance

## Hackathon Alignment

### Track 1: x402 Payment Applications

**Qualification Criteria**
- Implements HTTP 402 payment gates on protected endpoints
- Uses Cronos Facilitator SDK for EIP-3009 settlement
- Demonstrates end-to-end payment flow with real USDC transfers
- Provides session-based escrow for gasless agent payments

**Evidence**
- `src/services/x402/payment-middleware.ts`: requirePayment middleware
- `src/services/x402/facilitator-service.ts`: Facilitator SDK integration
- `src/api/perpai-routes.ts`: Protected quote endpoint
- `src/services/session/x402-session-service.ts`: Session escrow implementation

### Track 4: Developer Tooling

**Qualification Criteria**
- Provides SDK for agent and service integration
- Exposes MCP server with 60 tools for AI agent consumption
- Includes visual Playground for testing x402 flows
- Offers comprehensive API documentation

**Evidence**
- `src/sdk/`: RelayAgent, RelayService, RelayRWASDK classes
- `mcp-server/index.ts`: 60 MCP tools across 8 categories
- `src/pages/Playground/`: Visual workflow builder with real execution mode
- GraphQL schema and REST API endpoints

### Innovation

**Novel Contributions**
- Session-based escrow eliminating gas fees for repeated agent interactions
- SLA-based RWA settlement with automatic refunds on violations
- Multi-venue perpetual DEX aggregation with composite scoring
- On-chain reputation registry with time-decay scoring

### Execution Quality

**Production-Grade Implementation**
- TypeScript throughout with comprehensive error handling
- Row Level Security on all database tables
- Rate limiting and nonce tracking for replay prevention
- Real on-chain verification in session activation
- Comprehensive indexing with 7 cron jobs

### Ecosystem Value

**Cronos Integration**
- Deployed contracts on Cronos Testnet
- Uses Cronos Facilitator for x402 settlement
- Integrates Pyth oracle for price feeds
- Supports Cronos DEX venues (VVS, Moonlander)

## License

MIT License

## Links

- Repository: https://github.com/winsznx/relaycore
- Documentation: /docs in application
- Cronos: https://cronos.org
- x402 Protocol: https://www.x402.org
