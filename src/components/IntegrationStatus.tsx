import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    CheckCircle2,
    XCircle,
    Loader2,
    Database,
    Activity,
    Zap,
    TrendingUp,
    Server,
    Wifi
} from 'lucide-react';

interface IntegrationHealth {
    name: string;
    status: 'connected' | 'disconnected' | 'checking';
    latency?: number;
    lastChecked: string;
    icon: any;
    description: string;
}

export function IntegrationStatus() {
    const [integrations, setIntegrations] = useState<IntegrationHealth[]>([
        { name: 'Supabase', status: 'checking', icon: Database, description: 'Database & Auth', lastChecked: '' },
        { name: 'Pyth Oracle', status: 'checking', icon: TrendingUp, description: 'Price Feeds', lastChecked: '' },
        { name: 'GraphQL API', status: 'checking', icon: Server, description: 'Agent Queries', lastChecked: '' },
        { name: 'Cronos RPC', status: 'checking', icon: Zap, description: 'Blockchain', lastChecked: '' },
        { name: 'Indexers', status: 'checking', icon: Activity, description: 'Event Processing', lastChecked: '' },
    ]);

    useEffect(() => {
        checkAllIntegrations();
        const interval = setInterval(checkAllIntegrations, 30000); // Check every 30s
        return () => clearInterval(interval);
    }, []);

    async function checkAllIntegrations() {
        // Parallel checks
        checkSupabase();
        checkPyth();
        checkCronosRPC();

        // Sequential check (Indexers depend on GraphQL)
        const gqlSuccess = await checkGraphQL();
        checkIndexers(gqlSuccess);
    }

    async function checkSupabase() {
        const start = Date.now();
        try {
            const response = await fetch(import.meta.env.VITE_SUPABASE_URL + '/rest/v1/', {
                headers: {
                    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
                }
            });
            const latency = Date.now() - start;
            updateIntegration('Supabase', response.ok ? 'connected' : 'disconnected', latency);
        } catch {
            updateIntegration('Supabase', 'disconnected');
        }
    }

    async function checkPyth() {
        const start = Date.now();
        try {
            const response = await fetch('https://hermes.pyth.network/api/latest_vaas?ids[]=0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43');
            const latency = Date.now() - start;
            updateIntegration('Pyth Oracle', response.ok ? 'connected' : 'disconnected', latency);
        } catch {
            updateIntegration('Pyth Oracle', 'disconnected');
        }
    }

    async function checkGraphQL(): Promise<boolean> {
        const start = Date.now();
        try {
            // Use relative path for proxy support
            const response = await fetch('/graphql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': 'rk_test'
                },
                body: JSON.stringify({ query: '{ __typename }' })
            });
            const latency = Date.now() - start;
            const isConnected = response.status !== 0 && response.status < 500;
            updateIntegration('GraphQL API', isConnected ? 'connected' : 'disconnected', latency);
            return isConnected;
        } catch {
            updateIntegration('GraphQL API', 'disconnected');
            return false;
        }
    }

    async function checkCronosRPC() {
        const start = Date.now();
        try {
            const response = await fetch('/api/health/rpc');
            const latency = Date.now() - start;
            const data = await response.json();
            updateIntegration('Cronos RPC', data.status === 'connected' ? 'connected' : 'disconnected', latency);
        } catch {
            updateIntegration('Cronos RPC', 'disconnected');
        }
    }

    function checkIndexers(gqlSuccess: boolean) {
        // If GraphQL is up, Indexers are likely up (running in same process or monitored via GraphQL)
        updateIntegration('Indexers', gqlSuccess ? 'connected' : 'disconnected');
    }

    function updateIntegration(name: string, status: 'connected' | 'disconnected' | 'checking', latency?: number) {
        setIntegrations(prev => prev.map(i =>
            i.name === name
                ? { ...i, status, latency, lastChecked: new Date().toISOString() }
                : i
        ));
    }

    const connectedCount = integrations.filter(i => i.status === 'connected').length;
    const totalCount = integrations.length;

    return (
        <Card>
            <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Wifi className="h-5 w-5" />
                        <h3 className="font-semibold">Integration Status</h3>
                    </div>
                    <Badge
                        variant={connectedCount === totalCount ? 'default' : 'destructive'}
                        className={connectedCount === totalCount ? 'bg-green-500' : ''}
                    >
                        {connectedCount}/{totalCount} Connected
                    </Badge>
                </div>

                <div className="space-y-3">
                    {integrations.map((integration) => (
                        <div
                            key={integration.name}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${integration.status === 'connected' ? 'bg-green-100 text-green-600' :
                                    integration.status === 'disconnected' ? 'bg-red-100 text-red-600' :
                                        'bg-yellow-100 text-yellow-600'
                                    }`}>
                                    <integration.icon className="h-4 w-4" />
                                </div>
                                <div>
                                    <p className="font-medium text-sm">{integration.name}</p>
                                    <p className="text-xs">{integration.description}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {integration.latency && integration.status === 'connected' && (
                                    <span className="text-xs text-gray-400 dark:text-gray-400">
                                        {integration.latency}ms
                                    </span>
                                )}
                                {integration.status === 'connected' && (
                                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                                )}
                                {integration.status === 'disconnected' && (
                                    <XCircle className="h-5 w-5 text-red-500" />
                                )}
                                {integration.status === 'checking' && (
                                    <Loader2 className="h-5 w-5 text-yellow-500 animate-spin" />
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between text-sm">
                        <span>Auto-refreshing every 30s</span>
                        <button
                            onClick={checkAllIntegrations}
                            className="text-blue-500 hover:text-blue-600 font-medium"
                        >
                            Refresh Now
                        </button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export default IntegrationStatus;
