import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { ReputationEngine } from '../_shared/reputation-engine.ts';
import { Facilitator, CronosNetwork } from 'npm:@crypto.com/facilitator-client';
import { ethers } from 'npm:ethers';
import { HermesClient } from 'npm:@pythnetwork/hermes-client';
import {
    Logger,
    PerformanceTracker,
    validateRequest,
    checkRateLimit,
    handleError,
    jsonResponse,
    generateRequestId,
    AppError,
    withRetry,
    type ValidationRule
} from '../_shared/middleware.ts';

interface VenueScore {
    venueId: string;
    venueName: string;
    reputationScore: number;
    liquidityScore: number;
    speedScore: number;
    feeScore: number;
    compositeScore: number;
    expectedSlippage: number;
    estimatedExecutionTime: number;
}

interface TradeRequest {
    pair: string;
    side: 'long' | 'short';
    leverage: number;
    sizeUsd: number;
    userAddress: string;
    maxSlippage?: number;
    urgency?: 'low' | 'medium' | 'high';
    paymentHeader?: string; // EIP-3009 Payment Header
}

// Validation rules for trade requests
const TRADE_REQUEST_RULES: ValidationRule[] = [
    { field: 'pair', type: 'string', required: true, pattern: /^[A-Z]+-[A-Z]+$/ },
    { field: 'side', type: 'string', required: true, enum: ['long', 'short'] },
    { field: 'leverage', type: 'number', required: true, min: 1, max: 50 },
    { field: 'sizeUsd', type: 'number', required: true, min: 10, max: 1000000 },
    { field: 'userAddress', type: 'string', required: true, pattern: /^0x[a-fA-F0-9]{40}$/ },
    { field: 'maxSlippage', type: 'number', required: false, min: 0, max: 100 },
    { field: 'urgency', type: 'string', required: false, enum: ['low', 'medium', 'high'] },
    { field: 'paymentHeader', type: 'string', required: false }
];

// Moonlander Contracts (Cronos EVM)
const MOONLANDER_ADDRESS = '0xE6F6351fb66f3a35313fEEFF9116698665FBEeC9';
// Cronos Testnet EntryPoint (Account Abstraction)
const ENTRY_POINT_ADDRESS = '0x84D2EF0545514BF121d81769d8E94b94770670Ef';

const MOONLANDER_ABI = [
    'function createIncreasePosition(address _path, address _indexToken, uint256 _amountIn, uint256 _minOut, uint256 _sizeDelta, bool _isLong, uint256 _acceptablePrice, uint256 _executionFee, bytes32 _referralCode, address _callbackTarget) external payable returns (bytes32)',
    'function createDecreasePosition(address _path, address _indexToken, uint256 _collateralDelta, uint256 _sizeDelta, bool _isLong, address _receiver, uint256 _acceptablePrice, uint256 _minOut, uint256 _executionFee, bool _withdrawETH, address _callbackTarget) external payable returns (bytes32)'
];

class TradeRouter {
    private supabase: any;
    private reputationEngine: ReputationEngine;
    private facilitator: Facilitator;
    private provider: ethers.JsonRpcProvider;
    private signer: ethers.Wallet;
    private pythConnection: HermesClient;
    private logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger;
        this.supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        this.reputationEngine = new ReputationEngine();

        // Initialize Facilitator
        const network = Deno.env.get('CRONOS_NETWORK') === 'mainnet'
            ? CronosNetwork.CronosMainnet
            : CronosNetwork.CronosTestnet;

        this.facilitator = new Facilitator({ network });

        // Initialize Provider/Signer for Execution
        this.provider = new ethers.JsonRpcProvider(Deno.env.get('CRONOS_RPC_URL'));
        // WARNING: In production, Use Nitro Enclave or KMS. Env var is for Hackathon/Dev only.
        this.signer = new ethers.Wallet(Deno.env.get('EXECUTOR_PRIVATE_KEY')!, this.provider);

        // Initialize Pyth
        this.pythConnection = new HermesClient(
            'https://hermes.pyth.network'
        );
    }

    // Find best venue for a trade
    async findBestVenue(request: TradeRequest, perf: PerformanceTracker): Promise<VenueScore> {
        this.logger.info('Finding best venue', { pair: request.pair, side: request.side });

        // Fetch all active venues supporting the pair with retry
        const { data: venues } = await withRetry(
            () => this.supabase
                .from('dex_venues')
                .select(`
                    *,
                    reputations (
                        reputation_score,
                        success_rate,
                        avg_latency_ms
                    )
                `)
                .eq('is_active', true),
            {
                maxRetries: 2,
                onRetry: (attempt, error) => {
                    this.logger.warn(`Retrying venue fetch (attempt ${attempt})`, { error: error.message });
                }
            }
        );

        perf.checkpoint('venues_fetched');

        if (!venues || venues.length === 0) {
            throw new AppError('No venues found', 503, 'NO_VENUES');
        }

        const validVenues = venues.filter((v: any) => v.supported_pairs && v.supported_pairs.includes(request.pair));

        if (validVenues.length === 0) {
            throw new AppError(`No venues support trading pair: ${request.pair}`, 400, 'UNSUPPORTED_PAIR');
        }

        // Score each venue
        const scoredVenues = await Promise.all(
            validVenues.map((venue: any) => this.scoreVenue(venue, request))
        );

        perf.checkpoint('venues_scored');

        // Sort by composite score
        scoredVenues.sort((a, b) => b.compositeScore - a.compositeScore);

        const bestVenue = scoredVenues[0];

        this.logger.info('Best venue selected', {
            venue: bestVenue.venueName,
            score: bestVenue.compositeScore
        });

        return bestVenue;
    }

    // Score individual venue
    private async scoreVenue(venue: any, request: TradeRequest): Promise<VenueScore> {
        // Component scores
        const reputationScore = venue.reputations?.reputation_score || 0;
        const liquidityScore = await this.calculateLiquidityScore(venue, request);
        const speedScore = this.calculateSpeedScore(venue, request);
        const feeScore = this.calculateFeeScore(venue, request);

        // Weight adjustments based on urgency
        const weights = this.getScoreWeights(request.urgency);

        // Composite score
        const compositeScore = (
            weights.reputation * reputationScore +
            weights.liquidity * liquidityScore +
            weights.speed * speedScore +
            weights.fee * feeScore
        );

        // Estimate execution metrics
        const expectedSlippage = await this.estimateSlippage(venue, request);
        const estimatedExecutionTime = venue.reputations?.avg_latency_ms || 3000;

        return {
            venueId: venue.id,
            venueName: venue.name,
            reputationScore,
            liquidityScore,
            speedScore,
            feeScore,
            compositeScore,
            expectedSlippage,
            estimatedExecutionTime
        };
    }

    // Calculate liquidity score
    private async calculateLiquidityScore(venue: any, request: TradeRequest): Promise<number> {
        // Fetch latest liquidity snapshot
        const { data: liquidity } = await this.supabase
            .from('venue_liquidity')
            .select('*')
            .eq('venue_id', venue.id)
            .eq('pair', request.pair)
            .order('timestamp', { ascending: false })
            .limit(1)
            .single();

        if (!liquidity) return 0;

        const availableLiquidity = request.side === 'long'
            ? liquidity.available_long_liquidity
            : liquidity.available_short_liquidity;

        // Calculate utilization ratio
        const utilizationRatio = request.sizeUsd / availableLiquidity;

        // Score based on utilization (lower is better)
        if (utilizationRatio < 0.01) return 100; // < 1% utilization
        if (utilizationRatio < 0.05) return 90;  // < 5% utilization
        if (utilizationRatio < 0.10) return 75;  // < 10% utilization
        if (utilizationRatio < 0.25) return 50;  // < 25% utilization

        return Math.max(0, 50 - (utilizationRatio * 100));
    }

    // Calculate speed score
    private calculateSpeedScore(venue: any, request: TradeRequest): number {
        const avgLatency = venue.reputations?.avg_latency_ms || 5000;

        // Adjust for urgency
        const urgencyMultiplier = {
            'low': 0.5,
            'medium': 1.0,
            'high': 2.0
        }[request.urgency || 'medium'] || 1.0;

        // Normalize latency to score
        const baseScore = Math.max(0, 100 - (avgLatency / 100));
        return baseScore * urgencyMultiplier;
    }

    // Calculate fee score
    private calculateFeeScore(venue: any, request: TradeRequest): number {
        const tradingFeeBps = venue.trading_fee_bps || 10; // 0.10% default

        // Calculate total fee for position
        const totalFeeBps = tradingFeeBps * request.leverage;

        // Normalize to score (lower fees = higher score)
        return Math.max(0, 100 - (totalFeeBps / 2));
    }

    // Get score weights based on urgency
    private getScoreWeights(urgency?: string) {
        switch (urgency) {
            case 'low':
                return {
                    reputation: 0.25,
                    liquidity: 0.25,
                    speed: 0.10,
                    fee: 0.40 // Prioritize fees
                };
            case 'high':
                return {
                    reputation: 0.35,
                    liquidity: 0.20,
                    speed: 0.35, // Prioritize speed
                    fee: 0.10
                };
            default: // medium
                return {
                    reputation: 0.30,
                    liquidity: 0.30,
                    speed: 0.20,
                    fee: 0.20
                };
        }
    }

    // Estimate slippage
    private async estimateSlippage(venue: any, request: TradeRequest): Promise<number> {
        // Fetch recent trades using db (keeping this logic for historical impact)
        const { data: recentTrades } = await this.supabase
            .from('trades')
            .select('entry_price, size_usd')
            .eq('venue_id', venue.id)
            .eq('pair', request.pair)
            .order('created_at', { ascending: false })
            .limit(50);

        if (!recentTrades || recentTrades.length < 10) {
            return 0.5; // Default conservative slippage
        }

        // Calculate average price impact per $1M volume
        const priceImpacts = recentTrades.map((trade: any, idx: number) => {
            if (idx === 0) return 0;
            const priceDiff = Math.abs(trade.entry_price - recentTrades[idx - 1].entry_price);
            const volumeDiff = trade.size_usd + recentTrades[idx - 1].size_usd;
            if (volumeDiff === 0) return 0;
            return (priceDiff / recentTrades[idx - 1].entry_price) / (volumeDiff / 1000000);
        }).filter((impact: number) => impact > 0);

        const avgPriceImpact = priceImpacts.reduce((sum: number, impact: number) => sum + impact, 0) / priceImpacts.length;

        // Estimate slippage for requested size
        const estimatedSlippage = avgPriceImpact * (request.sizeUsd / 1000000) * 100;

        return Math.min(5.0, estimatedSlippage); // Cap at 5%
    }

    // Process payment using Facilitator
    private async processPayment(header: string, request: TradeRequest): Promise<boolean> {
        try {
            this.logger.info('Processing payment', { userAddress: request.userAddress });

            // 1. Generate requirements for this trade
            const requirements = this.facilitator.generatePaymentRequirements({
                payTo: this.signer.address, // We (Relay) are receiving the payment to execute
                description: `Trade Execution: ${request.side} ${request.pair}`,
                maxAmountRequired: '1000000' // Fixed fee for now (e.g. 1 USDC), typically calculated
            });

            // 2. Verify
            const body = this.facilitator.buildVerifyRequest(header, requirements);
            const verify = await this.facilitator.verifyPayment(body);

            if (!verify.isValid) {
                this.logger.warn('Payment verification failed', verify);
                return false;
            }

            // 3. Settle
            const settle = await this.facilitator.settlePayment(body);
            this.logger.info('Payment settled', { txHash: settle.txHash });
            return true;

        } catch (error) {
            this.logger.error('Payment processing failed', error as Error);
            return false;
        }
    }

    // Execute trade on selected venue
    async executeTrade(request: TradeRequest, perf: PerformanceTracker): Promise<any> {
        // Check payment if header provided
        if (request.paymentHeader) {
            const paymentSuccess = await this.processPayment(request.paymentHeader, request);
            perf.checkpoint('payment_processed');
            if (!paymentSuccess) {
                throw new AppError('Payment failed. Cannot execute trade.', 402, 'PAYMENT_FAILED');
            }
        }

        // Find best venue
        const bestVenue = await this.findBestVenue(request, perf);

        // Check if slippage is acceptable
        if (request.maxSlippage && bestVenue.expectedSlippage > request.maxSlippage) {
            throw new AppError(
                `Expected slippage (${bestVenue.expectedSlippage}%) exceeds maximum (${request.maxSlippage}%)`,
                400,
                'SLIPPAGE_EXCEEDED'
            );
        }

        // Get venue contract details
        const { data: venue } = await this.supabase
            .from('dex_venues')
            .select('*')
            .eq('id', bestVenue.venueId)
            .single();

        perf.checkpoint('venue_fetched');

        // Check Pyth Price
        let currentPrice = 0;
        try {
            currentPrice = await this.getRealTimePrice(request.pair);
            perf.checkpoint('price_fetched');
        } catch (e) {
            this.logger.error('Failed to get Pyth price', e as Error);
        }

        // Execute trade via Venue Contract
        const tradeResult = await this.executeVenueTrade(venue, request, currentPrice);
        perf.checkpoint('trade_executed');

        // Record trade in database
        const { data: trade, error } = await this.supabase
            .from('trades')
            .insert({
                user_address: request.userAddress,
                venue_id: venue.id,
                pair: request.pair,
                side: request.side,
                leverage: request.leverage,
                size_usd: request.sizeUsd,
                entry_price: tradeResult.entryPrice,
                tx_hash_open: tradeResult.txHash,
                liquidation_price: tradeResult.liquidationPrice,
                status: 'open',
                metadata: {
                    expected_slippage: bestVenue.expectedSlippage,
                    actual_slippage: tradeResult.actualSlippage,
                    execution_time_ms: tradeResult.executionTime,
                    venue_score: bestVenue.compositeScore
                }
            })
            .select()
            .single();

        perf.checkpoint('trade_recorded');

        if (error) {
            this.logger.error('Failed to record trade', error);
        }

        // Update venue reputation asynchronously (fire and forget)
        this.updateVenueReputationAfterTrade(venue.id, tradeResult.success).catch(err => {
            this.logger.error('Failed to update reputation', err);
        });

        return {
            trade,
            venue: venue.name,
            metrics: {
                expectedSlippage: bestVenue.expectedSlippage,
                actualSlippage: tradeResult.actualSlippage,
                executionTime: tradeResult.executionTime,
                venueScore: bestVenue.compositeScore,
                currentPrice
            }
        };
    }

    // Execute trade on specific venue
    private async executeVenueTrade(venue: any, request: TradeRequest, currentPrice: number): Promise<any> {
        this.logger.info('Executing trade on venue', {
            venue: venue.name,
            contract: venue.contract_address,
            pair: request.pair,
            side: request.side
        });

        try {
            const startTime = Date.now();
            const _moonlander = new ethers.Contract(MOONLANDER_ADDRESS, MOONLANDER_ABI, this.signer);

            // Map pair to index/collateral tokens (Simplified mapping)
            // In prod, fetch from DB or Smart Contract config
            const tokenMap: Record<string, string> = {
                'BTC-USD': '0xBTC_ADDRESS', // Replace with real
                'ETH-USD': '0xE6F6351fb66f3a35313fEEFF9116698665FBEeC9', // Using proxy for example
                'CRO-USD': '0xCRO_ADDRESS'
            };
            const _tokenAddress = tokenMap[request.pair] || ethers.ZeroAddress;

            // Execute Transaction
            // Note: Real params need exact calculation (minOut, price, etc.)
            let _tx;
            if (request.side === 'long' || request.side === 'short') { // Simplified for demo
                // Placeholder for increase position
                // tx = await moonlander.createIncreasePosition(...)

                // Since we don't have user funds to settle the position collateral in this server-side wallet
                // (unless this is a Relayer that wraps user signature), we'll assume the USER sends the tx
                // OR this is a "Managed Trading" service where we pay.

                // For the "Relay" architecture, typically the User sends the tx, OR we use Account Abstraction.
                // Given x402 usage, likely the user pays US (Relay) via x402, and WE execute the on-chain trade.

                // For this step, we'll keep the mock return but VALIDATE the address flow
                this.logger.debug(`Simulating contract call to ${MOONLANDER_ADDRESS}`, {
                    tokenAddress: _tokenAddress,
                    contract: _moonlander.target,
                    txPlaceholder: _tx
                });
            }

            const executionTime = Date.now() - startTime;

            return {
                txHash: '0x' + '0'.repeat(64), // Mock hash until we have real private key config
                entryPrice: currentPrice > 0 ? currentPrice : 0,
                liquidationPrice: 0,
                actualSlippage: 0,
                executionTime,
                success: true
            };

        } catch (error) {
            this.logger.error('Venue execution failed', error as Error);
            throw error;
        }
    }

    // Update venue reputation after trade
    private async updateVenueReputationAfterTrade(venueId: string, _success: boolean) {
        // Trigger reputation recalculation for venue
        await this.reputationEngine.calculateReputation(venueId);
    }

    // Helper: Get Real-Time Price from Pyth
    private async getRealTimePrice(pair: string): Promise<number> {
        // Map pair to Pyth Feed ID (Cronos Testnet/Mainnet IDs)
        // See https://pyth.network/developers/price-feed-ids
        const feedIds: Record<string, string[]> = {
            'BTC-USD': ['0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43'], // BTC/USD
            'ETH-USD': ['0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace'], // ETH/USD
            'CRO-USD': ['0x00b9d9c223c7271423405b0b21a8d9b15b364177d4c827c13404c0587747e4c7']  // CRO/USD
        };

        const ids = feedIds[pair];
        if (!ids) return 0;

        const priceUpdates = await this.pythConnection.getLatestPriceUpdates(ids);
        if (priceUpdates && priceUpdates.parsed && priceUpdates.parsed.length > 0) {
            const priceData = priceUpdates.parsed[0].price;
            return Number(priceData.price) * Math.pow(10, priceData.expo);
        }
        return 0;
    }
}

// ============================================
// HTTP HANDLER WITH MIDDLEWARE
// ============================================

serve(async (req: Request) => {
    const requestId = generateRequestId();
    const perf = new PerformanceTracker();

    const logger = new Logger({
        requestId,
        timestamp: new Date().toISOString(),
        function: 'trade-router',
        method: req.method,
        path: new URL(req.url).pathname
    });

    try {
        // CORS headers
        if (req.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                }
            });
        }

        // Method validation
        if (req.method !== 'POST') {
            throw new AppError('Method not allowed', 405, 'METHOD_NOT_ALLOWED');
        }

        perf.checkpoint('request_received');

        // Rate limiting (by IP or user)
        const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
        const rateLimit = checkRateLimit(clientIp, 10, 60000); // 10 requests per minute

        if (!rateLimit.allowed) {
            logger.warn('Rate limit exceeded', { ip: clientIp });
            return new Response(
                JSON.stringify({ error: 'Rate limit exceeded' }),
                {
                    status: 429,
                    headers: {
                        'Content-Type': 'application/json',
                        'X-RateLimit-Remaining': '0',
                        'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString()
                    }
                }
            );
        }

        perf.checkpoint('rate_limit_checked');

        // Parse and validate request body
        const body = await req.json();
        const validation = validateRequest(body, TRADE_REQUEST_RULES);

        if (!validation.valid) {
            logger.warn('Validation failed', { errors: validation.errors });
            throw new AppError(
                'Validation failed',
                400,
                'VALIDATION_ERROR',
                { errors: validation.errors }
            );
        }

        perf.checkpoint('request_validated');

        logger.info('Processing trade request', {
            pair: body.pair,
            side: body.side,
            sizeUsd: body.sizeUsd
        });

        // Execute trade
        const router = new TradeRouter(logger);
        const result = await router.executeTrade(body, perf);

        perf.checkpoint('trade_completed');

        const metrics = perf.getMetrics();
        logger.info('Trade completed successfully', { metrics });

        // Return success response with metrics
        return jsonResponse(
            {
                success: true,
                data: result,
                requestId,
                metrics
            },
            200,
            {
                'Access-Control-Allow-Origin': '*',
                'X-Request-ID': requestId,
                'X-RateLimit-Remaining': rateLimit.remaining.toString()
            }
        );

    } catch (error: any) {
        const metrics = perf.getMetrics();
        logger.error('Request failed', error, { metrics });

        const errorResponse = handleError(error, logger);

        // Add CORS and request ID to error response
        const headers = new Headers(errorResponse.headers);
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('X-Request-ID', requestId);

        return new Response(errorResponse.body, {
            status: errorResponse.status,
            headers
        });
    }
});
