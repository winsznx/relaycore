# Relay Core - Product Requirements Document (PRD)

## Executive Summary

**Product Name**: Relay Core  
**Tagline**: The payment relay for autonomous agents on Cronos  
**Category**: Web3 Infrastructure + DeFi Application  
**Target Launch**: Cronos x402 Paytech Hackathon (Feb 2026)  

**One-Line Pitch**: Relay Core is the payment infrastructure for autonomous agents on Cronos, providing payment memory, reputation scoring, and service discovery—with Relay Trade as the first application demonstrating perpetual DEX aggregation using reputation-based routing.

---

## Problem Statement

### The Core Problems We're Solving

#### Problem 1: Agent Payment Trust Gap
**Who experiences this**: AI agents executing autonomous payments on Cronos  
**What's broken**: Agents have no historical memory of payment outcomes and cannot assess counterparty reliability  
**Impact**: Multi-step workflows break when service delivery cannot be verified, leading to failed transactions and wasted gas fees  
**Current solutions**: None exist—agents operate blindly without trust signals  

#### Problem 2: Fragmented Perpetual DEX Liquidity
**Who experiences this**: Perpetual futures traders on Cronos  
**What's broken**: Liquidity is fragmented across Moonlander, GMX, Gains Network with no aggregator  
**Impact**: Traders get worse execution, higher slippage, and manually search for best venue  
**Current solutions**: 1inch/Matcha only aggregate spot DEXs, not perpetuals  

#### Problem 3: No Agent-to-Human Payment Rails
**Who experiences this**: AI agents needing to pay human service providers  
**What's broken**: Agents can't resolve social identities (@username) to wallet addresses  
**Impact**: Impossible for agents to autonomously pay freelancers, contractors, or service providers  
**Current solutions**: Manual wallet address sharing (not scalable)  

---

## Solution Overview

### What Relay Core Does

Relay Core is a **two-layer platform**:

**Layer 1: Infrastructure (Relay Core)**
- Indexes all x402 payment events on Cronos
- Records payment outcomes (success/failure, latency, delivery proof)
- Calculates deterministic reputation scores for services/agents
- Provides API for agents to discover reliable counterparties
- Resolves social identities to wallet addresses for human payments

**Layer 2: Application (Relay Trade)**
- Aggregates perpetual DEXs (Moonlander, GMX, Gains)
- Uses Relay Core reputation data to route trades to most reliable venues
- Provides AI-powered execution with optimal venue selection
- Records trade outcomes back to Relay Core to update DEX reputations

### How It Works (End-to-End Flow)

```
1. SERVICE REGISTRATION
   → Service owner registers on Relay Core
   → Provides: name, description, endpoint, price
   → Receives: unique service ID

2. AGENT DISCOVERY
   → Agent queries Relay Core API
   → Request: "Find KYC oracle with >95% success rate, <$1/call"
   → Response: Ranked list of services with reputation scores

3. PAYMENT EXECUTION
   → Agent executes x402 payment to chosen service
   → Payment settles on Cronos EVM
   → Relay Core indexer captures transaction

4. OUTCOME RECORDING
   → Service delivers (or fails to deliver)
   → Outcome recorded: success/failure, latency, proof
   → Reputation score updated automatically

5. REPUTATION UPDATE
   → Deterministic formula recalculates score
   → Score = 50% success rate + 20% volume + 20% repeat customers + 10% recency
   → Updated score available for next agent query

6. RELAY TRADE INTEGRATION
   → Trader wants to open $10K ETH perpetual long
   → Relay Trade queries Relay Core: "Best perp DEX?"
   → Relay Core returns: "Moonlander (99.8% settlement success)"
   → Trade executes on Moonlander
   → Outcome recorded, Moonlander reputation updated
```

---

## Target Users

### Primary Users

#### 1. AI Agent Developers
**Who**: Developers building autonomous agents that execute payments  
**Needs**: Reliable service discovery, payment outcome tracking, reputation signals  
**Use Cases**: 
- RWA tokenization agents paying compliance oracles
- Trading agents paying price feed oracles
- Research agents paying data providers
**Pain Points**: No trust layer for agent-to-agent payments  
**How Relay Helps**: API to query service reputation before payment  

#### 2. Perpetual Futures Traders
**Who**: Active traders on Cronos perpetual DEXs  
**Needs**: Best execution, lowest slippage, reliable settlement  
**Use Cases**:
- Opening leveraged positions (5x-100x)
- Closing positions quickly during volatility
- Avoiding liquidations
**Pain Points**: Fragmented liquidity, manual venue selection  
**How Relay Helps**: Relay Trade aggregates venues with reputation-based routing  

#### 3. Service Providers (Oracles, Data Feeds, APIs)
**Who**: Providers offering services to AI agents  
**Needs**: Discoverability, reputation building, payment automation  
**Use Cases**:
- KYC/AML oracles for compliance
- Price feed oracles for trading
- Data providers for research
**Pain Points**: Hard to build trust, no reputation system  
**How Relay Helps**: Automatic reputation building from successful payments  

### Secondary Users

#### 4. Protocol Developers
**Who**: Teams building DeFi protocols on Cronos  
**Needs**: Reliable oracle data, compliance services, agent infrastructure  
**Use Cases**: Integrating Relay Core for service discovery  

#### 5. Human Service Providers
**Who**: Freelancers, contractors, professionals  
**Needs**: Receive payments from AI agents  
**Use Cases**: AI agent pays lawyer for document review  
**How Relay Helps**: Social identity → wallet resolution  

---

## Core Features (MVP)

### Feature 1: Payment Memory & Indexing
**What**: Real-time indexing of all x402 payments on Cronos  
**Why**: Agents need historical data to assess reliability  
**How**: 
- Listen for x402 PaymentExecuted events
- Store: tx_hash, payer, receiver, amount, service_id, status
- Batch sync historical payments for backfill
**Success Metric**: Index 100% of x402 payments with <1min latency  

### Feature 2: Reputation Scoring
**What**: Deterministic reputation scores (0-100) for services  
**Why**: Agents need quantifiable trust signals  
**How**:
- Formula: 50% success rate + 20% total volume + 20% repeat customers + 10% recency
- Recalculate every 5 minutes
- Cache scores in Redis (5min TTL)
**Success Metric**: 95% of queries served from cache (<100ms response)  

### Feature 3: Service Discovery API
**What**: GraphQL + REST API for agents to find services  
**Why**: Agents need programmatic access to reputation data  
**How**:
- Endpoints: GET /services, GET /reputation/:id
- Filters: category, min_success_rate, max_price
- Rate limiting: 100 req/min per IP
**Success Metric**: 99.9% uptime, <200ms p95 latency  

### Feature 4: Social Identity Resolution
**What**: Map @username → wallet address  
**Why**: Enable agent-to-human payments  
**How**:
- User links social account to wallet (one-time)
- Agent queries: GET /identity/@alice
- Returns: wallet address
**Success Metric**: Support Twitter, Telegram, Discord  

### Feature 5: Relay Trade (Perp DEX Aggregator)
**What**: Aggregate Moonlander, GMX, Gains with reputation routing  
**Why**: Demonstrate Relay Core value with real application  
**How**:
- Query Relay Core for DEX reputations
- Calculate venue score: 60% reputation + 20% speed + 20% liquidity
- Route trade to best venue
- Record outcome back to Relay Core
**Success Metric**: 20% better execution vs single venue  

### Feature 6: Real-Time Dashboard
**What**: Web dashboard showing service rankings, payment history  
**Why**: Users need visibility into reputation data  
**How**:
- Service leaderboard (top reputation scores)
- Payment timeline (recent transactions)
- Reputation updates (live feed via Supabase Realtime)
- Trade history (for Relay Trade users)
**Success Metric**: <2s page load, mobile responsive  

---

## User Flows

### Flow 1: Agent Discovers and Pays Service

```
1. Agent needs KYC verification
   → Queries: GET /services?category=kyc&min_success=90&max_price=5
   
2. Relay Core returns ranked services
   → Service A: 98% success, $2/call, 500 total payments
   → Service B: 95% success, $1/call, 100 total payments
   
3. Agent chooses Service A (higher reputation)
   → Executes x402 payment: 2 USDC to Service A
   
4. Service A delivers KYC result
   → Agent records outcome: success, 2.3s latency
   
5. Relay Core updates reputation
   → Service A: 98.1% success, 501 total payments
   → Score increases from 87.2 to 87.3
   
6. Next agent benefits from updated data
```

### Flow 2: Trader Uses Relay Trade

```
1. Trader opens Relay Trade dashboard
   → Sees: Moonlander (99.8% success), GMX (98.5%), Gains (97.2%)
   
2. Trader wants to open $10K ETH long, 5x leverage
   → Clicks "Open Position"
   → Selects: ETH-USD, Long, 5x, $10K
   
3. Relay Trade queries Relay Core
   → "Which DEX has best reputation for $10K trade?"
   → Relay Core returns: Moonlander (score: 94.2)
   
4. Relay Trade executes on Moonlander
   → Opens position via x402 payment
   → Shows: "Position opened on Moonlander (best execution)"
   
5. Position settles successfully
   → Relay Core records: success, 1.2s settlement
   → Moonlander reputation updated: 99.81% success
   
6. Trader sees updated reputation in dashboard
   → Real-time update via Supabase Realtime
```

### Flow 3: Service Provider Builds Reputation

```
1. Oracle provider registers service
   → Name: "FastKYC", Category: "kyc", Price: $2/call
   → Receives service ID
   
2. First agent uses service
   → Payment: 2 USDC, Outcome: success, 1.8s latency
   → Reputation: 100% success, score: 62.0 (low volume penalty)
   
3. More agents use service (50 payments)
   → Success rate: 98% (49 success, 1 failure)
   → Reputation score: 78.5
   
4. Service becomes popular (500 payments)
   → Success rate: 98.5%
   → Reputation score: 91.2 (high volume bonus)
   
5. Service appears at top of rankings
   → Gets more business from high reputation
   → Network effect: success breeds success
```

---

## Value Propositions

### For AI Agent Developers
**Benefit**: Build trustworthy autonomous agents  
**How**: Access historical payment data and reputation scores  
**ROI**: Reduce failed transactions by 80%, save gas fees  

### For Traders
**Benefit**: Better execution on perpetual trades  
**How**: Automatic routing to most reliable DEX  
**ROI**: 20% better execution, lower slippage, avoid failed settlements  

### For Service Providers
**Benefit**: Build reputation and get discovered  
**How**: Automatic reputation from successful deliveries  
**ROI**: 3x more customers from high reputation ranking  

### For Cronos Ecosystem
**Benefit**: Enable autonomous agent economy  
**How**: Provide trust infrastructure for x402 payments  
**ROI**: Attract AI agent developers to Cronos  

---

## Competitive Analysis

### vs. Existing Solutions

| Feature | Relay Core | The Graph | Spectral Finance | 1inch |
|---------|-----------|-----------|------------------|-------|
| **Payment Indexing** | ✅ x402-specific | ✅ Generic | ❌ | ❌ |
| **Reputation Scoring** | ✅ Deterministic | ❌ | ✅ Static | ❌ |
| **Service Discovery** | ✅ Agent API | ❌ | ❌ | ❌ |
| **Social Payments** | ✅ @username | ❌ | ❌ | ❌ |
| **Perp Aggregation** | ✅ Relay Trade | ❌ | ❌ | ❌ Spot only |
| **Real-Time Updates** | ✅ 5min | ❌ | ❌ Daily | ✅ |
| **Cronos Native** | ✅ | ✅ | ❌ | ✅ |

**Unique Advantages**:
1. **Only x402-specific infrastructure** (vs generic indexing)
2. **Only perpetual DEX aggregator** (vs spot-only)
3. **Only agent-native reputation system** (vs static credit scores)
4. **Only social identity payments** (vs manual wallet sharing)

---

## Success Metrics (KPIs)

### Infrastructure Metrics (Relay Core)
- **Payments Indexed**: Target 1,000+ in first month
- **Services Registered**: Target 50+ services
- **API Queries**: Target 10,000+ queries/month
- **Uptime**: 99.9%
- **API Latency**: <200ms p95

### Application Metrics (Relay Trade)
- **Trading Volume**: Target $1M+ in first month
- **Trades Executed**: Target 500+ trades
- **Execution Quality**: 20% better than single venue
- **User Retention**: 40% weekly active users

### Business Metrics
- **Revenue**: $10K+ in first 3 months (from API fees + trading fees)
- **User Growth**: 100+ registered users
- **Network Effects**: 30% of services have >10 repeat customers

---

## Revenue Model

### Revenue Streams

#### 1. API Query Fees (Relay Core)
**Model**: Freemium + Pay-per-query  
**Pricing**:
- Free: 100 queries/month
- Pro: $50/month (unlimited queries)
- Enterprise: $500-5,000/month (custom SLAs)
- Pay-per-query: $0.01 per additional query

**Projection**: 1,000 agents × $50/month avg = $50K/month

#### 2. Trading Fees (Relay Trade)
**Model**: 0.05-0.1% per trade  
**Pricing**: 
- $10K trade = $5-10 fee
- $100K trade = $50-100 fee

**Projection**: $1M volume/month × 0.1% = $1K/month (grows with volume)

#### 3. Identity Verification Fees
**Model**: One-time fee per identity  
**Pricing**: $0.10-1 per social identity → wallet mapping  

**Projection**: 1,000 identities × $0.50 avg = $500 one-time

#### 4. Data Licensing (Future)
**Model**: Sell aggregated reputation data to protocols  
**Pricing**: $10K-100K/year per protocol  

**Projection**: 5 protocols × $50K = $250K/year

**Total Year 1 Revenue**: $600K-1.1M

---

## Go-to-Market Strategy

### Phase 1: Hackathon Launch (Feb 2026)
**Goal**: Win Dev Tooling + Agentic Finance tracks  
**Tactics**:
- Demo Relay Core + Relay Trade integration
- Show live perpetual trade with reputation routing
- Highlight Moonlander integration (ecosystem bonus)
- Emphasize infrastructure value for Cronos

### Phase 2: Beta Launch (Mar-Apr 2026)
**Goal**: Onboard first 50 services and 100 agents  
**Tactics**:
- Free tier for early adopters
- Partner with Cronos ecosystem projects
- Integrate with existing AI agent frameworks
- Content marketing (blog posts, tutorials)

### Phase 3: Public Launch (May-Jun 2026)
**Goal**: $1M+ trading volume, 1,000+ API queries/day  
**Tactics**:
- Paid tiers go live
- Expand to more DEXs (dYdX, Hyperliquid)
- Add more service categories (data, compute, storage)
- Community building (Discord, Twitter)

### Phase 4: Scale (Jul-Dec 2026)
**Goal**: $10M+ trading volume, 10,000+ services  
**Tactics**:
- Cross-chain expansion (Ethereum, Arbitrum)
- Enterprise partnerships (protocols, institutions)
- Advanced features (ML-based reputation, governance)
- Fundraising (Seed round)

---

## Technical Roadmap

### Hackathon MVP (6 weeks)
- [x] Database schema design
- [ ] Cronos indexer (x402 events)
- [ ] Reputation engine (deterministic formula)
- [ ] Service discovery API (GraphQL + REST)
- [ ] Relay Trade (Moonlander integration)
- [ ] Dashboard (service rankings, trade history)
- [ ] Deploy to Cronos testnet

### Post-Hackathon (Months 1-3)
- [ ] Social identity resolution
- [ ] Advanced reputation (time decay, category-specific)
- [ ] More DEXs (GMX, Gains, dYdX)
- [ ] Mobile app (React Native)
- [ ] Analytics dashboard (for service providers)
- [ ] Mainnet deployment

### Future (Months 4-12)
- [ ] Cross-chain indexing (Ethereum, Arbitrum)
- [ ] ML-based reputation (fraud detection)
- [ ] Governance (DAO for reputation formula)
- [ ] Agent marketplace (buy/sell agent services)
- [ ] Enterprise features (white-label, custom SLAs)

---

## Design Guidelines

### Brand Identity

**Visual Style**: Modern, trustworthy, technical  
**Colors**:
- Primary: Deep Blue (#1E3A8A) - trust, reliability
- Secondary: Electric Purple (#8B5CF6) - innovation, AI
- Accent: Bright Cyan (#06B6D4) - speed, efficiency
- Neutrals: Slate grays for backgrounds

**Typography**:
- Headings: Inter (bold, modern)
- Body: Inter (regular, readable)
- Code: JetBrains Mono (monospace)

**Logo**: Minimalist relay symbol (circuit or baton)

### UI/UX Principles

**1. Clarity**: Show reputation scores prominently  
**2. Speed**: <2s page loads, real-time updates  
**3. Trust**: Display transaction hashes, proof of outcomes  
**4. Accessibility**: WCAG 2.1 AA compliance, keyboard navigation  
**5. Responsive**: Mobile-first, tablet, desktop optimized  

### Key Pages

#### Landing Page
**Hero Section**:
- Headline: "The payment relay for autonomous agents"
- Subheadline: "Track outcomes. Score reputation. Discover reliable services."
- CTA: "Start Building" (links to docs) + "Try Relay Trade" (links to app)
- Visual: Animated diagram of payment flow

**Features Section**:
- Payment Memory: "Every x402 transaction indexed"
- Reputation Scoring: "Deterministic scores based on outcomes"
- Service Discovery: "Find reliable agents and services"
- Relay Trade: "Aggregate perpetual DEXs with reputation routing"

**Social Proof**:
- "Built on Cronos" logo
- "Powered by x402" badge
- Hackathon winner badges (after winning)

**Footer**: Links to docs, GitHub, Discord, Twitter

#### Dashboard (Authenticated)
**Layout**: Sidebar navigation + main content area

**Sidebar**:
- Overview (home)
- Services (discovery)
- Payments (history)
- Reputation (my score if service provider)
- Relay Trade (if trader)
- Settings

**Main Content** (Overview):
- Top Services (leaderboard table)
- Recent Payments (timeline)
- Reputation Updates (live feed)
- Quick Stats (total payments, avg success rate)

#### Service Discovery Page
**Filters** (left sidebar):
- Category (dropdown)
- Min Success Rate (slider)
- Max Price (input)
- Sort By (dropdown: reputation, price, recency)

**Results** (main area):
- Service cards showing:
  - Name + description
  - Reputation score (large, prominent)
  - Success rate (%)
  - Total payments
  - Avg latency
  - Price per call
  - "Use Service" CTA

#### Relay Trade Page
**Layout**: Trading interface

**Left Panel**: DEX Rankings
- Moonlander: 99.8% success, score 94.2
- GMX: 98.5% success, score 89.1
- Gains: 97.2% success, score 85.3

**Center Panel**: Trade Form
- Pair selector (ETH-USD, BTC-USD, etc.)
- Side (Long/Short)
- Leverage (slider 1x-100x)
- Size (USD input)
- "Open Position" CTA
- Shows: "Best venue: Moonlander (94.2 score)"

**Right Panel**: Open Positions
- List of active trades
- PnL, entry price, liquidation price
- "Close Position" CTA

---

## Copy & Messaging

### Taglines
- Primary: "The payment relay for autonomous agents"
- Secondary: "Trust infrastructure for x402 payments on Cronos"
- Relay Trade: "Perpetual DEX aggregation with reputation routing"

### Feature Descriptions

**Payment Memory**:
"Every x402 payment on Cronos is indexed and searchable. Agents can query historical outcomes to assess reliability before executing payments."

**Reputation Scoring**:
"Deterministic reputation scores (0-100) based on success rate, payment volume, repeat customers, and recency. Updated every 5 minutes."

**Service Discovery**:
"Agent-friendly API to find reliable services. Filter by category, success rate, and price. Get ranked results in milliseconds."

**Social Payments**:
"Resolve @username to wallet addresses. Enable AI agents to pay humans autonomously via social identities."

**Relay Trade**:
"Aggregate Moonlander, GMX, and Gains Network. Route trades to the most reliable venue using reputation data. Get 20% better execution."

### Call-to-Actions
- Primary: "Start Building on Relay"
- Secondary: "Try Relay Trade"
- Docs: "Read Documentation"
- API: "Get API Key"
- Trade: "Open Position"

---

## Risk Mitigation

### Technical Risks
**Risk**: Cronos RPC downtime  
**Mitigation**: Multiple RPC providers (Ankr, Chainstack), automatic failover  

**Risk**: Database performance degradation  
**Mitigation**: Materialized views, caching, partitioning, monitoring  

**Risk**: x402 contract changes  
**Mitigation**: Version detection, backward compatibility  

### Business Risks
**Risk**: Low adoption (chicken-egg problem)  
**Mitigation**: Build Relay Trade as first customer, free tier, partnerships  

**Risk**: Competitors copy idea  
**Mitigation**: Network effects (more data = better reputation), first-mover advantage  

**Risk**: Regulatory uncertainty  
**Mitigation**: No custody of funds, data indexing only (not financial advice)  

### Security Risks
**Risk**: Sybil attacks on reputation  
**Mitigation**: Cost to create service, time decay, anomaly detection  

**Risk**: API abuse  
**Mitigation**: Rate limiting, authentication, DDoS protection (Vercel)  

**Risk**: Smart contract vulnerabilities  
**Mitigation**: Audits, bug bounties, gradual rollout  

---

## Appendix

### Glossary
- **x402**: HTTP 402 "Payment Required" protocol for autonomous payments
- **Reputation Score**: 0-100 score based on payment outcomes
- **Service**: Any API/oracle/agent offering paid services
- **Agent**: Autonomous AI program executing payments
- **Relay Core**: Infrastructure layer (indexing, reputation, discovery)
- **Relay Trade**: Application layer (perpetual DEX aggregator)

### Resources
- Cronos Docs: https://docs.cronos.org
- x402 Facilitator: https://github.com/cronos-labs/x402-examples
- Crypto.com AI Agent SDK: https://ai-agent-sdk-docs.crypto.com
- Supabase Docs: https://supabase.com/docs
- TanStack Start: https://tanstack.com/start

### Contact
- GitHub: [relay-core]
- Discord: [relay-community]
- Twitter: [@relaycore]
- Email: team@relay.finance

---

**Last Updated**: January 9, 2026  
**Version**: 1.0 (Hackathon MVP)  
**Status**: In Development
