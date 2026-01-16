/**
 * x402 Payment Routes
 * 
 * Handles x402 payment settlement and protected service calls
 */

import { Router } from 'express';
import { requirePayment, handlePaymentSettlement } from '../services/x402/payment-middleware.js';
import { supabase } from '../lib/supabase.js';
import logger from '../lib/logger.js';

const router = Router();

/**
 * POST /api/pay
 * 
 * Settle an x402 payment
 * This is called by the client after signing the EIP-3009 authorization
 */
router.post('/pay', handlePaymentSettlement);

/**
 * POST /api/services/:id/call
 * 
 * Call a service with x402 payment protection
 * 
 * Flow:
 * 1. Client calls this endpoint
 * 2. If no payment, returns 402 with payment requirements
 * 3. Client signs EIP-3009 authorization
 * 4. Client calls /api/pay to settle
 * 5. Client retries this endpoint with payment-id header
 * 6. Service is called and response returned
 */
router.post('/services/:id/call',
    async (req, res, next) => {
        try {
            // Get service details
            const { id } = req.params;
            const { data: service, error } = await supabase
                .from('services')
                .select('*, reputations(*)')
                .eq('id', id)
                .eq('is_active', true)
                .single();

            if (error || !service) {
                return res.status(404).json({ error: 'Service not found' });
            }

            // Get merchant address from service owner
            const merchantAddress = service.owner_address;
            const amount = service.price_per_call || '1000000'; // Default 1 USDC
            const resourceUrl = `${req.protocol}://${req.get('host')}/api/services/${id}/call`;

            // Apply x402 payment middleware
            const paymentMiddleware = requirePayment({
                merchantAddress,
                amount,
                resourceUrl,
            });

            await paymentMiddleware(req, res, next);
        } catch (error) {
            logger.error('Service call setup error', error as Error);
            res.status(500).json({ error: 'Failed to setup service call' });
        }
    },
    async (req, res) => {
        try {
            // Payment verified, call the actual service
            const { id } = req.params;
            const { data: service } = await supabase
                .from('services')
                .select('endpoint_url')
                .eq('id', id)
                .single();

            if (!service) {
                return res.status(404).json({ error: 'Service not found' });
            }

            // Forward request to service endpoint
            const startTime = Date.now();
            const response = await fetch(service.endpoint_url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Payment-Id': req.headers['x-payment-id'] as string,
                },
                body: JSON.stringify(req.body),
            });

            const latencyMs = Date.now() - startTime;
            const result = await response.json();

            // Update service metrics
            await supabase.rpc('increment_service_call', {
                p_service_id: id,
                p_success: response.ok,
                p_latency_ms: latencyMs,
            });

            logger.info('Service called successfully', {
                serviceId: id,
                latencyMs,
                success: response.ok,
            });

            res.json({
                success: true,
                result,
                latencyMs,
                serviceId: id,
            });
        } catch (error) {
            logger.error('Service call execution error', error as Error);
            res.status(500).json({ error: 'Service call failed' });
        }
    }
);

/**
 * GET /api/payments/history
 * 
 * Get payment history for the connected wallet
 */
router.get('/payments/history', async (req, res) => {
    try {
        const { address, limit = 50, offset = 0 } = req.query;

        if (!address) {
            return res.status(400).json({ error: 'address parameter required' });
        }

        const { data, error } = await supabase
            .from('payments')
            .select('*')
            .eq('from_address', String(address).toLowerCase())
            .order('timestamp', { ascending: false })
            .range(Number(offset), Number(offset) + Number(limit) - 1);

        if (error) throw error;

        res.json({
            payments: data,
            total: data.length,
            offset: Number(offset),
            limit: Number(limit),
        });
    } catch (error) {
        logger.error('Payment history error', error as Error);
        res.status(500).json({ error: 'Failed to fetch payment history' });
    }
});

/**
 * GET /api/payments/:paymentId
 * 
 * Get payment details
 */
router.get('/payments/:paymentId', async (req, res) => {
    try {
        const { paymentId } = req.params;

        const { data, error } = await supabase
            .from('payments')
            .select('*')
            .eq('payment_id', paymentId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Payment not found' });
            }
            throw error;
        }

        res.json(data);
    } catch (error) {
        logger.error('Payment detail error', error as Error);
        res.status(500).json({ error: 'Failed to fetch payment' });
    }
});

export default router;
