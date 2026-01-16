import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Identity Resolution Edge Function
 * 
 * Endpoints:
 * GET /identity?socialId=xxx - Resolve social ID to wallet
 * GET /identity?wallet=xxx - Get all linked identities for a wallet
 * POST /identity - Link new social identity to wallet
 * DELETE /identity/:id - Unlink identity
 */
serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        const url = new URL(req.url);

        if (req.method === 'GET') {
            const socialId = url.searchParams.get('socialId');
            const wallet = url.searchParams.get('wallet');
            const platform = url.searchParams.get('platform');

            if (socialId) {
                // Resolve social ID to wallet
                let query = supabase
                    .from('identity_mappings')
                    .select('*')
                    .eq('social_id', socialId);

                if (platform) {
                    query = query.eq('platform', platform);
                }

                const { data, error } = await query.single();

                if (error || !data) {
                    return new Response(
                        JSON.stringify({
                            success: false,
                            error: 'Identity not found',
                            resolved: false
                        }),
                        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                }

                return new Response(
                    JSON.stringify({
                        success: true,
                        resolved: true,
                        data: {
                            socialId: data.social_id,
                            walletAddress: data.wallet_address,
                            platform: data.platform,
                            displayName: data.display_name,
                            verified: data.verified,
                            linkedAt: data.created_at
                        }
                    }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            if (wallet) {
                // Get all identities for a wallet
                const { data, error } = await supabase
                    .from('identity_mappings')
                    .select('*')
                    .eq('wallet_address', wallet.toLowerCase());

                if (error) throw error;

                return new Response(
                    JSON.stringify({
                        success: true,
                        walletAddress: wallet.toLowerCase(),
                        identities: data.map((id: any) => ({
                            id: id.id,
                            socialId: id.social_id,
                            platform: id.platform,
                            displayName: id.display_name,
                            avatarUrl: id.avatar_url,
                            verified: id.verified,
                            linkedAt: id.created_at
                        }))
                    }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            return new Response(
                JSON.stringify({ error: 'Provide socialId or wallet parameter' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (req.method === 'POST') {
            const body = await req.json();

            // Validate required fields
            const required = ['socialId', 'walletAddress', 'platform'];
            for (const field of required) {
                if (!body[field]) {
                    return new Response(
                        JSON.stringify({ error: `Missing required field: ${field}` }),
                        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                }
            }

            // Validate platform
            const validPlatforms = ['twitter', 'telegram', 'discord', 'github', 'farcaster'];
            if (!validPlatforms.includes(body.platform)) {
                return new Response(
                    JSON.stringify({ error: `Invalid platform. Must be one of: ${validPlatforms.join(', ')}` }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Check if social ID already linked
            const { data: existing } = await supabase
                .from('identity_mappings')
                .select('id')
                .eq('social_id', body.socialId)
                .eq('platform', body.platform)
                .single();

            if (existing) {
                return new Response(
                    JSON.stringify({ error: 'Social ID already linked to a wallet' }),
                    { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Insert new identity mapping
            const { data, error } = await supabase
                .from('identity_mappings')
                .insert({
                    social_id: body.socialId,
                    wallet_address: body.walletAddress.toLowerCase(),
                    platform: body.platform,
                    display_name: body.displayName || body.socialId,
                    avatar_url: body.avatarUrl,
                    verified: false, // Will be verified separately
                    verification_proof: body.verificationProof
                })
                .select()
                .single();

            if (error) throw error;

            return new Response(
                JSON.stringify({
                    success: true,
                    message: 'Identity linked successfully',
                    data: {
                        id: data.id,
                        socialId: data.social_id,
                        walletAddress: data.wallet_address,
                        platform: data.platform,
                        verified: data.verified
                    }
                }),
                { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (req.method === 'DELETE') {
            const id = url.pathname.split('/').pop();

            if (!id) {
                return new Response(
                    JSON.stringify({ error: 'Identity ID required' }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            const { error } = await supabase
                .from('identity_mappings')
                .delete()
                .eq('id', id);

            if (error) throw error;

            return new Response(
                JSON.stringify({ success: true, message: 'Identity unlinked' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify({ error: 'Method not allowed' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (e: any) {
        console.error('Identity API error:', e);
        return new Response(
            JSON.stringify({ error: e.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
