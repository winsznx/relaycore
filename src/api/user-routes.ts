import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { authenticateApiKey, type AuthenticatedRequest } from '../../middleware/api-auth.js';

const router = Router();

// Endpoint for CLI/SDK to verify API Key validity
router.get('/me', authenticateApiKey({ required: true }), (req: any, res) => {
    const authReq = req as AuthenticatedRequest;
    res.json({
        valid: true,
        id: authReq.apiKey?.id,
        userId: authReq.walletAddress,
        permissions: authReq.apiKey?.permissions
    });
});

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

router.post('/api-keys', async (req, res) => {
    try {
        const { walletAddress } = req.body;

        if (!walletAddress) {
            return res.status(400).json({ error: 'Wallet address required' });
        }

        const { data: existingKey } = await supabase
            .from('api_keys')
            .select('id')
            .eq('user_id', walletAddress)
            .eq('is_active', true)
            .single();

        if (existingKey) {
            return res.status(400).json({ error: 'You already have an active API key. Revoke it first to generate a new one.' });
        }

        const apiKey = `rk_${crypto.randomBytes(32).toString('hex')}`;
        const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

        const { data, error } = await supabase
            .from('api_keys')
            .insert({
                key_hash: keyHash,
                user_id: walletAddress,
                name: 'SDK Key',
                permissions: {
                    read_services: true,
                    read_reputation: true,
                    read_outcomes: true,
                    read_payments: true,
                    execute_payments: false
                },
                rate_limit: 100,
                expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        res.json({
            id: data.id,
            key: apiKey,
            name: data.name,
            created_at: data.created_at
        });
    } catch (error) {
        console.error('API key generation error:', error);
        res.status(500).json({ error: 'Failed to generate API key' });
    }
});

router.delete('/api-keys/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { walletAddress } = req.body;

        if (!walletAddress) {
            return res.status(400).json({ error: 'Wallet address required' });
        }

        const { error } = await supabase
            .from('api_keys')
            .update({ is_active: false })
            .eq('id', id)
            .eq('user_id', walletAddress);

        if (error) throw error;

        res.json({ success: true });
    } catch (error) {
        console.error('API key revocation error:', error);
        res.status(500).json({ error: 'Failed to revoke API key' });
    }
});

router.get('/api-keys', async (req, res) => {
    try {
        const { walletAddress } = req.query;

        if (!walletAddress) {
            return res.status(400).json({ error: 'Wallet address required' });
        }

        const { data, error } = await supabase
            .from('api_keys')
            .select('id, name, created_at, last_used_at, is_active, rate_limit, queries_used')
            .eq('user_id', walletAddress)
            .eq('is_active', true);

        if (error) throw error;

        res.json(data || []);
    } catch (error) {
        console.error('API key fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch API keys' });
    }
});

router.get('/profile', async (req, res) => {
    try {
        const { wallet } = req.query;

        if (!wallet) {
            return res.status(400).json({ error: 'Wallet address required' });
        }

        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('wallet_address', (wallet as string).toLowerCase())
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        // Transform to camelCase for frontend
        const profile = data ? {
            walletAddress: data.wallet_address,
            displayName: data.display_name || '',
            email: data.email || '',
            notifications: {
                payments: data.notification_preferences?.payments ?? true,
                services: data.notification_preferences?.services ?? true,
                reputation: data.notification_preferences?.reputation ?? true,
                health: data.notification_preferences?.health ?? false,
                dailySummary: data.notification_preferences?.dailySummary ?? false
            }
        } : {
            walletAddress: wallet,
            displayName: '',
            email: '',
            notifications: {
                payments: true,
                services: true,
                reputation: true,
                health: false,
                dailySummary: false
            }
        };

        res.json(profile);
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

router.post('/profile', async (req, res) => {
    try {
        const { walletAddress, displayName, email, notificationPreferences } = req.body;

        if (!walletAddress) {
            return res.status(400).json({ error: 'Wallet address required' });
        }

        const { data, error } = await supabase
            .from('user_profiles')
            .upsert({
                wallet_address: walletAddress.toLowerCase(),
                display_name: displayName,
                email: email,
                notification_preferences: notificationPreferences,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'wallet_address'
            })
            .select()
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        console.error('Profile save error:', error);
        res.status(500).json({ error: 'Failed to save profile' });
    }
});

export default router;
