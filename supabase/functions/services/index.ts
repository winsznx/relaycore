import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Services API Edge Function
 * 
 * Endpoints:
 * GET - List all services with optional filtering
 * POST - Register a new service
 */
serve(async (req) => {
    // Handle CORS preflight
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
            // Query parameters
            const category = url.searchParams.get('category');
            const minReputation = url.searchParams.get('minReputation');
            const maxPrice = url.searchParams.get('maxPrice');
            const ownerAddress = url.searchParams.get('owner');
            const limit = parseInt(url.searchParams.get('limit') || '50');
            const offset = parseInt(url.searchParams.get('offset') || '0');

            // Build query
            let query = supabase
                .from('services')
                .select(`
                    *,
                    reputations (
                        reputation_score,
                        success_rate,
                        total_payments,
                        avg_latency_ms,
                        unique_payers
                    )
                `)
                .eq('is_active', true);

            // Apply filters
            if (category) {
                query = query.eq('category', category);
            }
            if (maxPrice) {
                query = query.lte('price_per_call', parseFloat(maxPrice));
            }
            if (ownerAddress) {
                query = query.eq('owner_address', ownerAddress.toLowerCase());
            }
            if (minReputation) {
                query = query.gte('reputations.reputation_score', parseFloat(minReputation));
            }

            // Pagination and ordering
            query = query
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            const { data, error, count } = await query;

            if (error) throw error;

            // Get total count for pagination
            const { count: totalCount } = await supabase
                .from('services')
                .select('id', { count: 'exact', head: true })
                .eq('is_active', true);

            return new Response(
                JSON.stringify({
                    success: true,
                    data,
                    pagination: {
                        total: totalCount || 0,
                        limit,
                        offset,
                        hasMore: (offset + limit) < (totalCount || 0)
                    }
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (req.method === 'POST') {
            const body = await req.json();

            // Validate required fields
            const required = ['name', 'category', 'owner_address'];
            for (const field of required) {
                if (!body[field]) {
                    return new Response(
                        JSON.stringify({ error: `Missing required field: ${field}` }),
                        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                }
            }

            // Insert service
            const { data: service, error: serviceError } = await supabase
                .from('services')
                .insert({
                    owner_address: body.owner_address.toLowerCase(),
                    name: body.name,
                    description: body.description || '',
                    category: body.category,
                    endpoint_url: body.endpoint_url || '',
                    price_per_call: body.price_per_call || 0,
                    currency: body.currency || 'USDC',
                    logo_url: body.logo_url,
                    documentation_url: body.documentation_url,
                    metadata: body.metadata || {},
                    is_active: true
                })
                .select()
                .single();

            if (serviceError) throw serviceError;

            // Initialize reputation entry
            await supabase
                .from('reputations')
                .insert({
                    service_id: service.id,
                    total_payments: 0,
                    successful_payments: 0,
                    failed_payments: 0,
                    reputation_score: 0,
                    success_rate: 0
                });

            return new Response(
                JSON.stringify({
                    success: true,
                    data: service,
                    message: 'Service registered successfully'
                }),
                { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify({ error: 'Method not allowed' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (e: any) {
        console.error('Services API error:', e);
        return new Response(
            JSON.stringify({ error: e.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
