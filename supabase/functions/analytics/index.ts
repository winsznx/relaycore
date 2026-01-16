import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Analytics Edge Function
 * 
 * Provides aggregated statistics for the dashboard and reports
 */
serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'GET') {
        return new Response(
            JSON.stringify({ error: 'Method not allowed' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        const url = new URL(req.url);
        const type = url.searchParams.get('type') || 'overview';
        const days = parseInt(url.searchParams.get('days') || '30');
        const serviceId = url.searchParams.get('serviceId');
        const userAddress = url.searchParams.get('userAddress');

        // Calculate date range
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startDateStr = startDate.toISOString();

        switch (type) {
            case 'overview': {
                // Platform-wide overview stats
                const [
                    { count: totalPayments },
                    { count: totalServices },
                    { count: totalTrades },
                    { data: dailyStats },
                    { data: topServices },
                    { data: recentPayments }
                ] = await Promise.all([
                    supabase.from('payments').select('id', { count: 'exact', head: true }),
                    supabase.from('services').select('id', { count: 'exact', head: true }).eq('is_active', true),
                    supabase.from('trades').select('id', { count: 'exact', head: true }),
                    supabase.from('daily_stats')
                        .select('*')
                        .order('date', { ascending: false })
                        .limit(days),
                    supabase.from('services')
                        .select('id, name, category, reputations(reputation_score, success_rate, total_payments)')
                        .eq('is_active', true)
                        .order('reputations(reputation_score)', { ascending: false })
                        .limit(5),
                    supabase.from('payments')
                        .select('*')
                        .order('created_at', { ascending: false })
                        .limit(10)
                ]);

                // Calculate aggregates from daily stats
                const totals = (dailyStats || []).reduce((acc: any, day: any) => ({
                    totalVolumeUsd: acc.totalVolumeUsd + (parseFloat(day.total_volume_usd) || 0),
                    totalPaymentsInPeriod: acc.totalPaymentsInPeriod + (day.total_payments || 0),
                    totalTradesInPeriod: acc.totalTradesInPeriod + (day.total_trades || 0),
                    avgLatency: acc.avgLatency + (day.avg_latency_ms || 0)
                }), { totalVolumeUsd: 0, totalPaymentsInPeriod: 0, totalTradesInPeriod: 0, avgLatency: 0 });

                return new Response(
                    JSON.stringify({
                        success: true,
                        data: {
                            summary: {
                                totalPayments: totalPayments || 0,
                                totalServices: totalServices || 0,
                                totalTrades: totalTrades || 0,
                                totalVolumeUsd: totals.totalVolumeUsd,
                                avgLatencyMs: dailyStats?.length
                                    ? Math.round(totals.avgLatency / dailyStats.length)
                                    : 0
                            },
                            periodDays: days,
                            periodStats: {
                                payments: totals.totalPaymentsInPeriod,
                                trades: totals.totalTradesInPeriod,
                                volume: totals.totalVolumeUsd
                            },
                            dailyStats: dailyStats || [],
                            topServices: topServices || [],
                            recentPayments: recentPayments || []
                        }
                    }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            case 'service': {
                if (!serviceId) {
                    return new Response(
                        JSON.stringify({ error: 'serviceId required for service analytics' }),
                        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                }

                // Service-specific analytics
                const [
                    { data: service },
                    { data: payments },
                    { count: uniquePayers }
                ] = await Promise.all([
                    supabase.from('services')
                        .select('*, reputations(*)')
                        .eq('id', serviceId)
                        .single(),
                    supabase.from('payments')
                        .select('*')
                        .eq('service_id', serviceId)
                        .gte('created_at', startDateStr)
                        .order('created_at', { ascending: false }),
                    supabase.from('payments')
                        .select('payer_address', { count: 'exact', head: true })
                        .eq('service_id', serviceId)
                ]);

                const successful = (payments || []).filter((p: any) => p.status === 'success').length;
                const failed = (payments || []).filter((p: any) => p.status === 'failed').length;
                const totalVolume = (payments || []).reduce((sum: number, p: any) => sum + parseFloat(p.amount || 0), 0);

                return new Response(
                    JSON.stringify({
                        success: true,
                        data: {
                            service,
                            period: { days, startDate: startDateStr },
                            metrics: {
                                totalPayments: payments?.length || 0,
                                successfulPayments: successful,
                                failedPayments: failed,
                                successRate: payments?.length ? (successful / payments.length * 100).toFixed(2) : 0,
                                totalVolumeUsd: totalVolume,
                                uniquePayers: uniquePayers || 0
                            },
                            recentPayments: (payments || []).slice(0, 20)
                        }
                    }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            case 'user': {
                if (!userAddress) {
                    return new Response(
                        JSON.stringify({ error: 'userAddress required for user analytics' }),
                        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                }

                const addr = userAddress.toLowerCase();

                // User-specific analytics
                const [
                    { data: trades },
                    { data: payments },
                    { data: services },
                    { data: agents }
                ] = await Promise.all([
                    supabase.from('trades')
                        .select('*, dex_venues(name)')
                        .eq('user_address', addr)
                        .order('created_at', { ascending: false }),
                    supabase.from('payments')
                        .select('*')
                        .or(`payer_address.eq.${addr},receiver_address.eq.${addr}`)
                        .order('created_at', { ascending: false })
                        .limit(50),
                    supabase.from('services')
                        .select('*, reputations(*)')
                        .eq('owner_address', addr),
                    supabase.from('agents')
                        .select('*')
                        .eq('owner_address', addr)
                ]);

                // Calculate trade PnL
                const closedTrades = (trades || []).filter((t: any) => t.status === 'closed');
                const totalPnl = closedTrades.reduce((sum: number, t: any) => sum + parseFloat(t.pnl_usd || 0), 0);
                const winRate = closedTrades.length
                    ? closedTrades.filter((t: any) => parseFloat(t.pnl_usd || 0) > 0).length / closedTrades.length * 100
                    : 0;

                return new Response(
                    JSON.stringify({
                        success: true,
                        data: {
                            userAddress: addr,
                            trading: {
                                totalTrades: trades?.length || 0,
                                openPositions: (trades || []).filter((t: any) => t.status === 'open').length,
                                closedTrades: closedTrades.length,
                                totalPnlUsd: totalPnl,
                                winRate: winRate.toFixed(2)
                            },
                            payments: {
                                asPayer: (payments || []).filter((p: any) => p.payer_address === addr).length,
                                asReceiver: (payments || []).filter((p: any) => p.receiver_address === addr).length
                            },
                            services: {
                                registered: services?.length || 0,
                                services: services || []
                            },
                            agents: {
                                deployed: agents?.length || 0,
                                active: (agents || []).filter((a: any) => a.status === 'active').length,
                                agents: agents || []
                            },
                            recentTrades: (trades || []).slice(0, 10)
                        }
                    }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            case 'venues': {
                // DEX venue analytics
                const [
                    { data: venues },
                    { data: recentTrades }
                ] = await Promise.all([
                    supabase.from('dex_venues')
                        .select('*, reputations(*)')
                        .eq('is_active', true),
                    supabase.from('trades')
                        .select('venue_id, side, size_usd, pnl_usd, status')
                        .gte('created_at', startDateStr)
                ]);

                // Aggregate trades by venue
                const venueStats = (venues || []).map((venue: any) => {
                    const venueTrades = (recentTrades || []).filter((t: any) => t.venue_id === venue.id);
                    const totalVolume = venueTrades.reduce((sum: number, t: any) => sum + parseFloat(t.size_usd || 0), 0);

                    return {
                        ...venue,
                        periodStats: {
                            trades: venueTrades.length,
                            volumeUsd: totalVolume,
                            longs: venueTrades.filter((t: any) => t.side === 'long').length,
                            shorts: venueTrades.filter((t: any) => t.side === 'short').length
                        }
                    };
                });

                return new Response(
                    JSON.stringify({
                        success: true,
                        data: {
                            venues: venueStats,
                            period: { days, startDate: startDateStr }
                        }
                    }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            default:
                return new Response(
                    JSON.stringify({ error: 'Invalid analytics type. Use: overview, service, user, venues' }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
        }

    } catch (e: any) {
        console.error('Analytics API error:', e);
        return new Response(
            JSON.stringify({ error: e.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
