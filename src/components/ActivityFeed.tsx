import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import {
    ArrowUpRight,
    DollarSign,
    Star,
    Activity,
    Bot,
    Wallet
} from 'lucide-react';

interface ActivityItem {
    id: string;
    type: 'payment' | 'trade' | 'reputation' | 'agent';
    title: string;
    description: string;
    amount?: string;
    address?: string;
    timestamp: string;
    status: 'success' | 'pending' | 'failed';
}

export function ActivityFeed() {
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Load initial activities
        loadActivities();

        // Set up real-time subscription
        const channel = supabase
            .channel('activity-feed')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'payments' },
                (payload) => {
                    const newActivity: ActivityItem = {
                        id: payload.new.id,
                        type: 'payment',
                        title: 'Payment Processed',
                        description: `${formatAddress(payload.new.from_address)} → ${formatAddress(payload.new.to_address)}`,
                        amount: formatAmount(payload.new.amount),
                        address: payload.new.from_address,
                        timestamp: payload.new.created_at,
                        status: payload.new.status === 'verified' ? 'success' : 'pending'
                    };
                    setActivities(prev => [newActivity, ...prev.slice(0, 19)]);
                }
            )
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'trades' },
                (payload) => {
                    const newActivity: ActivityItem = {
                        id: payload.new.id,
                        type: 'trade',
                        title: `${payload.new.side.toUpperCase()} ${payload.new.pair}`,
                        description: `${payload.new.leverage}x leverage on ${payload.new.venue_name || 'DEX'}`,
                        amount: `$${payload.new.size_usd}`,
                        address: payload.new.user_address,
                        timestamp: payload.new.created_at,
                        status: payload.new.status === 'open' ? 'success' : 'pending'
                    };
                    setActivities(prev => [newActivity, ...prev.slice(0, 19)]);
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'agent_reputation' },
                (payload) => {
                    const newData = payload.new as Record<string, any>;
                    const newActivity: ActivityItem = {
                        id: newData.id || crypto.randomUUID(),
                        type: 'reputation',
                        title: 'Reputation Updated',
                        description: `Score: ${newData.reputation_score?.toFixed(1) || 0}`,
                        address: newData.agent_address,
                        timestamp: newData.updated_at || new Date().toISOString(),
                        status: 'success'
                    };
                    setActivities(prev => [newActivity, ...prev.slice(0, 19)]);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    async function loadActivities() {
        setLoading(true);

        try {
            // Load recent payments
            const { data: payments } = await supabase
                .from('payments')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(5);

            // Load recent trades
            const { data: trades } = await supabase
                .from('trades')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(5);

            // Load recent agent activity
            const { data: agentActivity } = await supabase
                .from('agent_activity')
                .select('*')
                .order('timestamp', { ascending: false })
                .limit(5);

            const allActivities: ActivityItem[] = [];

            payments?.forEach(p => {
                allActivities.push({
                    id: p.id,
                    type: 'payment',
                    title: 'Payment Processed',
                    description: `${formatAddress(p.from_address)} → ${formatAddress(p.to_address)}`,
                    amount: formatAmount(p.amount),
                    address: p.from_address,
                    timestamp: p.created_at,
                    status: p.status === 'verified' ? 'success' : 'pending'
                });
            });

            trades?.forEach(t => {
                allActivities.push({
                    id: t.id,
                    type: 'trade',
                    title: `${t.side?.toUpperCase() || 'TRADE'} ${t.pair}`,
                    description: `${t.leverage}x leverage`,
                    amount: `$${t.size_usd}`,
                    address: t.user_address,
                    timestamp: t.created_at,
                    status: t.status === 'open' ? 'success' : 'pending'
                });
            });

            agentActivity?.forEach(a => {
                allActivities.push({
                    id: a.id,
                    type: 'agent',
                    title: formatActivityType(a.activity_type),
                    description: a.metadata?.description || 'Agent activity',
                    address: a.agent_address,
                    timestamp: a.timestamp,
                    status: 'success'
                });
            });

            // Sort by timestamp
            allActivities.sort((a, b) =>
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );

            setActivities(allActivities.slice(0, 20));
        } catch (error) {
            console.error('Failed to load activities:', error);
        } finally {
            setLoading(false);
        }
    }

    const getIcon = (type: string) => {
        switch (type) {
            case 'payment': return <DollarSign className="h-4 w-4" />;
            case 'trade': return <ArrowUpRight className="h-4 w-4" />;
            case 'reputation': return <Star className="h-4 w-4" />;
            case 'agent': return <Bot className="h-4 w-4" />;
            default: return <Activity className="h-4 w-4" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'success': return 'bg-green-500';
            case 'pending': return 'bg-yellow-500';
            case 'failed': return 'bg-red-500';
            default: return 'bg-gray-500';
        }
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Activity className="h-5 w-5" />
                        <h3 className="font-semibold">Live Activity Feed</h3>
                    </div>
                    <div className="animate-pulse space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-16 bg-gray-100 rounded-lg" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Activity className="h-5 w-5" />
                        <h3 className="font-semibold">Live Activity Feed</h3>
                    </div>
                    <Badge variant="outline" className="animate-pulse">
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                        Live
                    </Badge>
                </div>

                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {activities.length === 0 ? (
                        <div className="text-center py-8">
                            <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>No activity yet</p>
                            <p className="text-sm">Transactions will appear here in real-time</p>
                        </div>
                    ) : (
                        activities.map((activity) => (
                            <div
                                key={activity.id}
                                className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                                <div className={`p-2 rounded-full ${getStatusColor(activity.status)} text-white`}>
                                    {getIcon(activity.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <p className="font-medium text-sm truncate">{activity.title}</p>
                                        {activity.amount && (
                                            <span className="font-semibold text-sm">{activity.amount}</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500 truncate">{activity.description}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        {activity.address && (
                                            <span className="text-xs text-gray-400 flex items-center gap-1">
                                                <Wallet className="h-3 w-3" />
                                                {formatAddress(activity.address)}
                                            </span>
                                        )}
                                        <span className="text-xs text-gray-400 dark:text-gray-400">
                                            {formatTimestamp(activity.timestamp)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

// Helper functions
function formatAddress(address: string): string {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatAmount(amount: string | number): string {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;

    if (isNaN(num)) return '0.00 USDC';

    // Convert from smallest unit (USDC has 6 decimals)
    const usdcAmount = num / 1e6;

    if (usdcAmount >= 1000000) return `${(usdcAmount / 1000000).toFixed(2)}M USDC`;
    if (usdcAmount >= 1000) return `${(usdcAmount / 1000).toFixed(2)}K USDC`;

    return `${usdcAmount.toFixed(2)} USDC`;
}

function formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
}

function formatActivityType(type: string): string {
    return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default ActivityFeed;
