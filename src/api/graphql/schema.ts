/**
 * GraphQL Schema for Relay Core
 * 
 * Provides queryable API for AI agents to access:
 * - Payment history
 * - Agent reputation
 * - Service discovery
 * - Transaction patterns
 */

export const typeDefs = `#graphql
  scalar DateTime
  scalar BigInt
  scalar JSON

  type Payment {
    id: ID!
    paymentId: String!
    txHash: String!
    fromAddress: String!
    toAddress: String!
    amount: String!
    tokenAddress: String!
    resourceUrl: String
    status: PaymentStatus!
    blockNumber: BigInt!
    timestamp: DateTime!
  }

  enum PaymentStatus {
    VERIFIED
    SETTLED
    FAILED
  }

  type Agent {
    address: String!
    reputationScore: Float!
    totalPaymentsSent: String!
    totalPaymentsReceived: String!
    successfulTransactions: Int!
    failedTransactions: Int!
    lastActive: DateTime
    successRate: Float!
  }

  type Service {
    id: ID!
    ownerAddress: String!
    name: String!
    description: String
    category: String
    endpointUrl: String
    pricePerCall: String
    isActive: Boolean!
    createdAt: DateTime!
    reputation: ServiceReputation
    health: ServiceHealth
  }

  type ServiceReputation {
    totalPayments: Int!
    successfulPayments: Int!
    failedPayments: Int!
    avgLatencyMs: Int
    uniquePayers: Int!
    reputationScore: Float!
    successRate: Float!
  }

  type ServiceHealth {
    status: String!
    successRate: Float
    lastTestedAt: String
    reliable: Boolean!
    warning: String
  }

  type DexVenue {
    id: ID!
    name: String!
    contractAddress: String!
    chain: String!
    maxLeverage: Int!
    tradingFeeBps: Int!
    isActive: Boolean!
    reputation: VenueReputation
  }

  type VenueReputation {
    totalTrades: Int!
    successfulTrades: Int!
    failedTrades: Int!
    avgLatencyMs: Int
    avgSlippageBps: Int
    reputationScore: Float!
    successRate: Float!
  }

  type Trade {
    id: ID!
    userAddress: String!
    venue: DexVenue
    pair: String!
    side: String!
    leverage: Float
    sizeUsd: Float
    entryPrice: Float
    exitPrice: Float
    pnlUsd: Float
    status: String!
    txHash: String
    createdAt: DateTime!
    closedAt: DateTime
  }

  type AgentActivity {
    id: ID!
    agentAddress: String!
    activityType: String!
    metadata: JSON
    blockNumber: BigInt
    timestamp: DateTime!
  }

  type PaymentStats {
    totalVolume: String!
    totalPayments: Int!
    uniquePayers: Int!
    uniqueReceivers: Int!
    averagePayment: String!
  }

  type Query {
    # Payment queries
    payment(paymentId: String!): Payment
    payments(
      fromAddress: String
      toAddress: String
      status: PaymentStatus
      limit: Int = 100
      offset: Int = 0
    ): [Payment!]!
    
    # Agent queries
    agent(address: String!): Agent
    agents(
      minReputation: Float
      limit: Int = 100
      offset: Int = 0
    ): [Agent!]!
    
    # Service queries
    service(id: ID!): Service
    services(
      category: String
      minReputation: Float
      isActive: Boolean
      limit: Int = 100
      offset: Int = 0
    ): [Service!]!
    
    # DEX venue queries
    venue(id: ID!): DexVenue
    venues(
      chain: String
      isActive: Boolean
    ): [DexVenue!]!
    
    # Trade queries
    trade(id: ID!): Trade
    trades(
      userAddress: String
      venueId: ID
      status: String
      limit: Int = 100
      offset: Int = 0
    ): [Trade!]!
    
    # Reputation leaderboard
    reputationLeaderboard(limit: Int = 10): [Agent!]!
    serviceLeaderboard(limit: Int = 10): [Service!]!
    venueLeaderboard(limit: Int = 10): [DexVenue!]!
    
    # Activity queries
    agentActivity(
      address: String!
      activityType: String
      limit: Int = 100
    ): [AgentActivity!]!
    
    # Analytics
    paymentStats(
      fromAddress: String
      toAddress: String
      startTime: DateTime
      endTime: DateTime
    ): PaymentStats!
    
    # Service discovery
    findAgentsByService(
      serviceType: String!
      minReputation: Float = 0
    ): [Agent!]!
    
    # Identity resolution
    identity(socialId: String!): Identity
    walletIdentities(walletAddress: String!): [Identity!]!
    
    # Outcome queries
    outcomes(paymentId: String!): [Outcome!]!
    
    # Live prices from multi-DEX aggregator
    livePrices(symbols: [String!]): [LivePrice!]!
    currentPrices: CurrentPrices!
    
    # Indexer queries
    serviceGraph: ServiceGraph!
    serviceDependencies(serviceId: String!): [String!]!
    serviceDependents(serviceId: String!): [String!]!
    
    # Perp indexer queries
    perpOpenPositions(trader: String): [PerpPosition!]!
    perpRecentTrades(pair: String, limit: Int = 50): [PerpTrade!]!
    perpTraderStats(trader: String!): TraderStats!
    
    # Task artifact queries
    task(taskId: String!): TaskArtifact
    tasks(
      agentId: String
      serviceId: String
      sessionId: String
      state: String
      limit: Int = 100
    ): [TaskArtifact!]!
    taskStats(agentId: String): TaskStats!
  }

  type LivePrice {
    symbol: String!
    price: Float!
    source: String!
    sources: [PriceSource!]!
    latencyMs: Int!
    timestamp: DateTime!
  }

  type PriceSource {
    name: String!
    price: Float!
    latencyMs: Int!
  }

  type CurrentPrices {
    btcUsd: Float!
    ethUsd: Float!
    croUsd: Float!
    usdcUsd: Float!
    timestamp: DateTime!
  }

  type Identity {
    id: ID!
    socialId: String!
    walletAddress: String!
    platform: String!
    verified: Boolean!
    createdAt: DateTime!
  }

  type Outcome {
    id: ID!
    paymentId: String!
    outcomeType: String!
    latencyMs: Int
    evidence: JSON
    createdAt: DateTime!
  }

  # Indexer Data Types
  type ServiceNode {
    id: String!
    name: String!
    type: String!
    owner: String!
  }

  type ServiceEdge {
    from: String!
    to: String!
    weight: Float!
  }

  type ServiceGraph {
    nodes: [ServiceNode!]!
    edges: [ServiceEdge!]!
  }

  type PerpPosition {
    id: String!
    trader: String!
    pair: String!
    isLong: Boolean!
    size: String!
    collateral: String!
    entryPrice: String!
    liquidationPrice: String!
    pnl: String!
    openedAt: DateTime!
  }

  type PerpTrade {
    id: String!
    trader: String!
    pair: String!
    isLong: Boolean!
    size: String!
    price: String!
    fee: String!
    timestamp: DateTime!
  }

  type TraderStats {
    totalTrades: Int!
    totalVolume: String!
    totalPnl: String!
    winRate: Float!
  }

  type TaskArtifact {
    taskId: String!
    agentId: String!
    serviceId: String
    sessionId: String
    state: String!
    paymentId: String
    facilitatorTx: String
    retries: Int!
    createdAt: DateTime!
    updatedAt: DateTime!
    completedAt: DateTime
    inputs: JSON!
    outputs: JSON!
    error: JSON
    metrics: JSON
  }

  type TaskStats {
    total: Int!
    pending: Int!
    settled: Int!
    failed: Int!
    successRate: Float!
    avgDurationMs: Float!
  }

  type Mutation {
    linkIdentity(
      socialId: String!
      walletAddress: String!
      platform: String!
    ): Identity!
    
    recordOutcome(
      paymentId: String!
      outcomeType: String!
      latencyMs: Int
      evidence: JSON
    ): Outcome!
  }
`;

export default typeDefs;

