// ============================================
// SERVICE DISCOVERY
// ============================================

/**
 * GET /api/services
 * Query services with filtering
 */
export interface ServiceQueryParams {
    category?: string;
    minSuccessRate?: number;
    maxPrice?: number;
    minReputation?: number;
    sortBy?: 'reputation' | 'price' | 'volume' | 'recency';
    limit?: number;
    offset?: number;
}

export interface ServiceResponse {
    services: Array<{
        id: string;
        name: string;
        description: string;
        category: string;
        endpointUrl: string;
        pricePerCall: number;
        currency: string;
        reputation: {
            score: number;
            successRate: number;
            totalPayments: number;
            avgLatencyMs: number;
        };
        lastActive: string;
    }>;
    total: number;
    page: number;
    pageSize: number;
}

/**
 * GET /api/services/:id
 * Get detailed service information
 */
export interface ServiceDetailResponse {
    service: {
        id: string;
        name: string;
        description: string;
        category: string;
        endpointUrl: string;
        pricePerCall: number;
        currency: string;
        ownerAddress: string;
        createdAt: string;
        lastActive: string;
    };
    reputation: {
        score: number;
        successRate: number;
        reliabilityScore: number;
        speedScore: number;
        volumeScore: number;
        totalPayments: number;
        successfulPayments: number;
        failedPayments: number;
        avgLatencyMs: number;
        medianLatencyMs: number;
        p95LatencyMs: number;
        uniquePayers: number;
        repeatCustomers: number;
        totalVolumeUsd: number;
        lastCalculated: string;
    };
    recentPayments: Array<{
        txHash: string;
        amount: number;
        status: string;
        timestamp: string;
    }>;
}

/**
 * POST /api/services
 * Register a new service
 */
export interface CreateServiceRequest {
    name: string;
    description: string;
    category: string;
    endpointUrl: string;
    pricePerCall: number;
    currency: string;
    ownerAddress: string;
    metadata?: Record<string, any>;
}

export interface CreateServiceResponse {
    serviceId: string;
    message: string;
}

// ============================================
// REPUTATION & ANALYTICS
// ============================================

/**
 * GET /api/reputation/:serviceId
 * Get reputation score for a service
 */
export interface ReputationResponse {
    serviceId: string;
    reputationScore: number;
    successRate: number;
    components: {
        reliability: number;
        speed: number;
        volume: number;
        repeatCustomers: number;
    };
    metrics: {
        totalPayments: number;
        avgLatencyMs: number;
        uniquePayers: number;
    };
    calculatedAt: string;
}

/**
 * GET /api/rankings
 * Get service leaderboard
 */
export interface RankingsResponse {
    rankings: Array<{
        rank: number;
        serviceId: string;
        serviceName: string;
        category: string;
        reputationScore: number;
        successRate: number;
        totalPayments: number;
    }>;
    updatedAt: string;
}

// ============================================
// PAYMENT TRACKING
// ============================================

/**
 * GET /api/payments
 * Query payment history
 */
export interface PaymentQueryParams {
    serviceId?: string;
    payerAddress?: string;
    receiverAddress?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
    offset?: number;
}

export interface PaymentListResponse {
    payments: Array<{
        id: string;
        txHash: string;
        payerAddress: string;
        receiverAddress: string;
        serviceId: string;
        amount: number;
        currency: string;
        status: string;
        latencyMs: number;
        timestamp: string;
    }>;
    total: number;
}

/**
 * GET /api/payments/:txHash
 * Get detailed payment information
 */
export interface PaymentDetailResponse {
    payment: {
        id: string;
        txHash: string;
        blockNumber: number;
        payerAddress: string;
        receiverAddress: string;
        serviceId: string;
        serviceName: string;
        amount: number;
        currency: string;
        gasUsed: string;
        gasPrice: string;
        status: string;
        deliveryProof: string;
        latencyMs: number;
        timestamp: string;
    };
    outcome: {
        type: string;
        evidence: any;
        errorMessage: string;
    };
}

/**
 * POST /api/payments/execute
 * Execute a payment to a service
 */
export interface ExecutePaymentRequest {
    serviceId: string;
    amount: number;
    payerAddress: string;
    metadata?: Record<string, any>;
}

export interface ExecutePaymentResponse {
    txHash: string;
    status: string;
    estimatedLatency: number;
    message: string;
}

// ============================================
// SOCIAL IDENTITY
// ============================================

/**
 * GET /api/identity/:socialId
 * Resolve social identity to wallet
 */
export interface IdentityResolveResponse {
    socialId: string;
    walletAddress: string;
    platform: string;
    verified: boolean;
    lastVerified: string;
}

/**
 * POST /api/identity/link
 * Link social identity to wallet
 */
export interface LinkIdentityRequest {
    socialId: string;
    walletAddress: string;
    platform: string;
    verificationProof: string;
}

export interface LinkIdentityResponse {
    success: boolean;
    identityId: string;
    message: string;
}

// ============================================
// PERPAI TRADING
// ============================================

/**
 * GET /api/trade/venues
 * Get available trading venues
 */
export interface VenuesResponse {
    venues: Array<{
        id: string;
        name: string;
        supportedPairs: string[];
        maxLeverage: number;
        tradingFeeBps: number;
        reputation: {
            score: number;
            successRate: number;
            avgLatencyMs: number;
        };
    }>;
}

/**
 * POST /api/trade/quote
 * Get execution quote from best venue
 */
export interface TradeQuoteRequest {
    pair: string;
    side: 'long' | 'short';
    leverage: number;
    sizeUsd: number;
    maxSlippage?: number;
    urgency?: 'low' | 'medium' | 'high';
}

export interface TradeQuoteResponse {
    bestVenue: {
        id: string;
        name: string;
        reputationScore: number;
    };
    expectedPrice: number;
    expectedSlippage: number;
    liquidationPrice: number;
    totalFees: number;
    estimatedExecutionTime: number;
    alternativeVenues: Array<{
        name: string;
        score: number;
        expectedSlippage: number;
    }>;
}

/**
 * POST /api/trade/execute
 * Execute a trade
 */
export interface TradeExecuteRequest {
    pair: string;
    side: 'long' | 'short';
    leverage: number;
    sizeUsd: number;
    userAddress: string;
    maxSlippage?: number;
    stopLoss?: number;
    takeProfit?: number;
    urgency?: 'low' | 'medium' | 'high';
    paymentHeader?: string;
}

export interface TradeExecuteResponse {
    tradeId: string;
    txHash: string;
    venue: string;
    entryPrice: number;
    liquidationPrice: number;
    actualSlippage: number;
    executionTime: number;
    status: string;
}

/**
 *
 * GET /api/trade/positions
 * Get user's open positions
 */
export interface PositionsResponse {
    positions: Array<{
        id: string;
        venue: string;
        pair: string;
        side: string;
        leverage: number;
        sizeUsd: number;
        entryPrice: number;
        currentPrice: number;
        pnl: number;
        pnlPercentage: number;
        liquidationPrice: number;
        openedAt: string;
    }>;
}

/**
 * POST /api/trade/close
 * Close an open position
 */
export interface ClosePositionRequest {
    tradeId: string;
    userAddress: string;
}

export interface ClosePositionResponse {
    tradeId: string;
    txHash: string;
    exitPrice: number;
    pnl: number;
    pnlPercentage: number;
    executionTime: number;
    status: string;
}

// ============================================
// ANALYTICS & DASHBOARD
// ============================================

/**
 * GET /api/analytics/overview
 * Get platform-wide analytics
 */
export interface AnalyticsOverviewResponse {
    totalPayments: number;
    successfulPayments: number;
    totalVolumeUsd: number;
    uniquePayers: number;
    activeServices: number;
    avgSuccessRate: number;
    avgLatencyMs: number;
    totalTrades: number;
    totalTradeVolumeUsd: number;
    period: {
        from: string;
        to: string;
    };
}

/**
 * GET /api/analytics/service/:serviceId
 * Get service-specific analytics
 */
export interface ServiceAnalyticsResponse {
    serviceId: string;
    metrics: {
        totalPayments: number;
        successRate: number;
        avgLatencyMs: number;
        totalRevenue: number;
        uniqueCustomers: number;
    };
    timeSeries: Array<{
        date: string;
        payments: number;
        revenue: number;
        avgLatency: number;
    }>;
    topPayers: Array<{
        address: string;
        totalPayments: number;
        totalAmount: number;
    }>;
}
