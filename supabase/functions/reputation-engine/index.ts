import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { ReputationEngine } from "../_shared/reputation-engine.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const engine = new ReputationEngine();
        const url = new URL(req.url);
        const serviceId = url.searchParams.get('serviceId');

        // If specific service ID provided, calculate just that one
        if (serviceId) {
            const score = await engine.calculateReputation(serviceId);
            return new Response(
                JSON.stringify({
                    success: true,
                    data: score
                }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            );
        }

        // Otherwise, batch update all reputations (called by cron)
        if (req.method === 'POST') {
            const body = await req.json().catch(() => ({}));

            if (body.action === 'invalidate' && body.serviceId) {
                await engine.invalidateCache(body.serviceId);
                return new Response(
                    JSON.stringify({ success: true, message: 'Cache invalidated' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Batch update
            await engine.updateAllReputations();
            return new Response(
                JSON.stringify({
                    success: true,
                    message: 'All reputations updated'
                }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            );
        }

        return new Response(
            JSON.stringify({
                error: 'Invalid request. Use GET with ?serviceId=xxx or POST for batch update'
            }),
            {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );

    } catch (e: any) {
        console.error('Reputation engine error:', e);
        return new Response(
            JSON.stringify({ error: e.message }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );
    }
});
