/**
 * Route Proxy API
 * 
 * Manages x402-protected proxy routes that wrap any upstream API.
 * 
 * Endpoints:
 *   POST   /api/routes        - Create a new route
 *   GET    /api/routes        - List user routes
 *   DELETE /api/routes/:id    - Delete a route
 *   ALL    /proxy/:routeId/*  - Proxy handler with x402 payment
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../lib/supabase.js';
import { authenticateApiKey, type AuthenticatedRequest } from '../middleware/api-auth.js';
import { facilitatorService } from '../services/x402/facilitator-service.js';
import { Facilitator, CronosNetwork } from '@crypto.com/facilitator-client';
import logger from '../lib/logger.js';

const router = Router();

const API_BASE_URL = process.env.API_BASE_URL || 'https://api.relaycore.xyz';

interface Route {
    id: string;
    user_id: string;
    name: string;
    upstream_url: string;
    method: string;
    price_usdc: string;
    pay_to: string;
    secret_headers: Record<string, string>;
    is_active: boolean;
    request_count: number;
    revenue: string;
    created_at: string;
}

/**
 * POST /api/routes - Create a new route
 */
router.post('/', authenticateApiKey({ required: true }), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { name, upstreamUrl, method, priceUsdc, payTo, secretHeaders } = req.body;

        if (!name || !upstreamUrl) {
            return res.status(400).json({ error: 'Name and upstream URL are required' });
        }

        try {
            new URL(upstreamUrl);
        } catch {
            return res.status(400).json({ error: 'Invalid upstream URL' });
        }

        const routeId = uuidv4();
        const userId = req.walletAddress || req.apiKey?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'User ID not found' });
        }

        const { data, error } = await supabase
            .from('routes')
            .insert({
                id: routeId,
                user_id: userId,
                name,
                upstream_url: upstreamUrl,
                method: (method || 'GET').toUpperCase(),
                price_usdc: priceUsdc || '0.01',
                pay_to: payTo || userId,
                secret_headers: secretHeaders || {},
                is_active: true,
                request_count: 0,
                revenue: '0'
            })
            .select()
            .single();

        if (error) {
            logger.error('Failed to create route', error);
            return res.status(500).json({ error: 'Failed to create route' });
        }

        logger.info('Route created', { routeId, userId, name });

        res.status(201).json({
            id: data.id,
            name: data.name,
            method: data.method,
            upstreamUrl: data.upstream_url,
            priceUsdc: data.price_usdc,
            payTo: data.pay_to,
            proxyUrl: `${API_BASE_URL}/proxy/${data.id}`,
            isActive: data.is_active,
            createdAt: data.created_at
        });
    } catch (error) {
        logger.error('Route creation error', error as Error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/routes - List user routes
 */
router.get('/', authenticateApiKey({ required: true }), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.walletAddress || req.apiKey?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'User ID not found' });
        }

        const { data, error } = await supabase
            .from('routes')
            .select('*')
            .eq('user_id', userId)
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) {
            logger.error('Failed to fetch routes', error);
            return res.status(500).json({ error: 'Failed to fetch routes' });
        }

        res.json({
            routes: (data || []).map((r: Route) => ({
                id: r.id,
                name: r.name,
                method: r.method,
                upstreamUrl: r.upstream_url,
                priceUsdc: r.price_usdc,
                payTo: r.pay_to,
                proxyUrl: `${API_BASE_URL}/proxy/${r.id}`,
                requestCount: r.request_count,
                revenue: r.revenue,
                isActive: r.is_active,
                createdAt: r.created_at
            }))
        });
    } catch (error) {
        logger.error('Route list error', error as Error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/routes/:id - Delete a route
 */
router.delete('/:id', authenticateApiKey({ required: true }), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.walletAddress || req.apiKey?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'User ID not found' });
        }

        const { error } = await supabase
            .from('routes')
            .update({ is_active: false })
            .eq('id', id)
            .eq('user_id', userId);

        if (error) {
            logger.error('Failed to delete route', error);
            return res.status(500).json({ error: 'Failed to delete route' });
        }

        logger.info('Route deleted', { routeId: id, userId });
        res.json({ success: true });
    } catch (error) {
        logger.error('Route delete error', error as Error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;

/**
 * Proxy Router - Handles actual proxy requests with x402 payment
 */
export const proxyRouter = Router();

/**
 * ALL /proxy/:routeId - Handle proxy requests with x402 payment
 * Additional path segments passed via ?path= query parameter
 */
proxyRouter.all('/:routeId', handleProxyRequest);

async function handleProxyRequest(req: Request, res: Response) {
    const { routeId } = req.params;
    const startTime = Date.now();

    try {
        const { data: route, error } = await supabase
            .from('routes')
            .select('*')
            .eq('id', routeId)
            .eq('is_active', true)
            .single();

        if (error || !route) {
            return res.status(404).json({ error: 'Route not found' });
        }

        const priceBaseUnits = Math.round(parseFloat(route.price_usdc) * 1_000_000).toString();

        const paymentHeader = req.headers['x-payment'] as string;
        const paymentId = req.headers['x-payment-id'] as string;

        if (!paymentHeader && !paymentId) {
            return res.status(402).json({
                error: 'Payment Required',
                paymentId: `pay_${routeId}_${Date.now()}`,
                paymentRequirements: {
                    scheme: 'exact',
                    network: 'cronos-testnet',
                    payTo: route.pay_to,
                    asset: process.env.USDC_TOKEN_ADDRESS || '0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0',
                    maxAmountRequired: priceBaseUnits,
                    maxTimeoutSeconds: 300,
                    resource: `/proxy/${routeId}`,
                    description: route.name
                },
                message: `Payment of $${route.price_usdc} USDC required`,
                network: 'cronos-testnet'
            });
        }

        if (paymentHeader) {
            // Use facilitator service to verify and settle payment
            // settlePayment internally verifies before settling
            try {
                const paymentRequirements = facilitatorService.generatePaymentRequirements({
                    merchantAddress: route.pay_to,
                    amount: priceBaseUnits,
                    resourceUrl: `/proxy/${routeId}`,
                    description: route.name
                });

                const settleResult = await facilitatorService.settlePayment({
                    paymentHeader,
                    paymentRequirements
                });

                logger.info('Payment settled for proxy request', {
                    routeId,
                    txHash: settleResult.txHash
                });
            } catch (paymentError) {
                logger.error('Payment verification/settlement failed', paymentError as Error);
                return res.status(402).json({
                    error: 'Payment verification failed',
                    message: (paymentError as Error).message
                });
            }
        }

        const proxyPath = req.params[0] || '';
        const upstreamUrl = route.upstream_url + (proxyPath ? `/${proxyPath}` : '');
        const upstreamUrlWithQuery = req.query && Object.keys(req.query).length > 0
            ? `${upstreamUrl}?${new URLSearchParams(req.query as Record<string, string>).toString()}`
            : upstreamUrl;

        const upstreamHeaders: Record<string, string> = {
            'Content-Type': req.headers['content-type'] || 'application/json'
        };

        if (route.secret_headers) {
            Object.assign(upstreamHeaders, route.secret_headers);
        }

        const upstreamResponse = await fetch(upstreamUrlWithQuery, {
            method: req.method,
            headers: upstreamHeaders,
            body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body)
        });

        const responseData = await upstreamResponse.text();

        await supabase
            .from('routes')
            .update({
                request_count: route.request_count + 1,
                revenue: (parseFloat(route.revenue) + parseFloat(route.price_usdc)).toFixed(6)
            })
            .eq('id', routeId);

        const latencyMs = Date.now() - startTime;
        logger.info('Proxy request completed', { routeId, latencyMs, status: upstreamResponse.status });

        res.setHeader('X-Route-Id', routeId);
        res.setHeader('X-Latency-Ms', latencyMs.toString());

        try {
            res.status(upstreamResponse.status).json(JSON.parse(responseData));
        } catch {
            res.status(upstreamResponse.status).send(responseData);
        }
    } catch (error) {
        logger.error('Proxy error', error as Error);
        res.status(502).json({ error: 'Proxy error', message: (error as Error).message });
    }
}
