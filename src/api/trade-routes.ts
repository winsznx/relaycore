/**
 * Trade API Routes with x402 Payment Integration
 * 
 * Endpoints:
 * - POST /api/trade/quote - Get trade quote (0.01 USDC)
 * - POST /api/trade/execute - Execute trade (0.05 USDC)
 */

import express from 'express';
import { requirePayment } from '../services/x402/payment-middleware.js';
import { TradeRouter } from '../services/perpai/trade-router.js';
import logger from '../lib/logger.js';

const router = express.Router();
const tradeRouter = new TradeRouter();

const network = (process.env.CRONOS_NETWORK as 'testnet' | 'mainnet') || 'testnet';

/**
 * Trade Quote Endpoint
 * Requires 0.01 USDC payment via x402
 */
router.post('/quote',
    requirePayment({
        merchantAddress: process.env.PAYMENT_RECIPIENT_ADDRESS || '0x0000000000000000000000000000000000000000',
        amount: '10000', // 0.01 USDC (6 decimals)
        resourceUrl: '/api/trade/quote',
    }),
    async (req, res) => {
        try {
            const { pair, side, leverage, sizeUsd } = req.body;

            if (!pair || !side || !leverage || !sizeUsd) {
                return res.status(400).json({ error: 'Missing required parameters' });
            }

            const quote = await tradeRouter.getQuote({
                pair,
                side,
                leverage,
                sizeUsd,
                maxSlippage: req.body.maxSlippage || 0.5,
            });

            logger.info('Trade quote generated', { pair, side, leverage, sizeUsd });
            res.json(quote);
        } catch (error: any) {
            logger.error('Trade quote failed', error);
            res.status(500).json({ error: error.message || 'Quote generation failed' });
        }
    }
);

/**
 * Trade Execute Endpoint
 * Requires 0.05 USDC payment via x402
 */
router.post('/execute',
    requirePayment({
        merchantAddress: process.env.PAYMENT_RECIPIENT_ADDRESS || '0x0000000000000000000000000000000000000000',
        amount: '50000', // 0.05 USDC (6 decimals)
        resourceUrl: '/api/trade/execute',
    }),
    async (req, res) => {
        try {
            const { pair, side, leverage, sizeUsd, userAddress, quoteId } = req.body;

            if (!pair || !side || !leverage || !sizeUsd || !userAddress) {
                return res.status(400).json({ error: 'Missing required parameters' });
            }

            const result = await tradeRouter.executeTrade({
                pair,
                side,
                leverage,
                sizeUsd,
                userAddress,
                maxSlippage: req.body.maxSlippage || 0.5,
                stopLoss: req.body.stopLoss,
                takeProfit: req.body.takeProfit,
            });

            logger.info('Trade executed', { tradeId: result.tradeId, txHash: result.txHash });
            res.json(result);
        } catch (error: any) {
            logger.error('Trade execution failed', error);
            res.status(500).json({ error: error.message || 'Trade execution failed' });
        }
    }
);

export default router;
