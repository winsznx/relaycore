import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function RWAGuide() {
    return (
        <div className="space-y-8 max-w-4xl">
            {/* Header */}
            <div>
                <div className="flex items-center gap-3 mb-4">
                    <Badge variant="outline" className="text-blue-600 border-blue-200">New Feature</Badge>
                </div>
                <h1 className="text-4xl font-bold mb-4">RWA State Machines</h1>
                <p className="text-xl text-gray-600">
                    Manage Real-World Asset lifecycles with x402 payment enforcement and multi-agent coordination.
                </p>
            </div>

            {/* Overview */}
            <Card>
                <CardHeader>
                    <CardTitle>Overview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-gray-600">
                    <p>
                        Relay Core provides a comprehensive system for managing Real-World Assets (RWAs) through
                        deterministic state machines. This system ensures that every state transition is:
                    </p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li><strong>Verifiable:</strong> Recorded on-chain with cryptographic proofs.</li>
                        <li><strong>Paid For:</strong> Enforced by the x402 protocol (payment before transition).</li>
                        <li><strong>Coordinated:</strong> Requires specific agent roles for each step.</li>
                    </ul>
                </CardContent>
            </Card>

            {/* Lifecycle States */}
            <section>
                <h2 className="text-2xl font-bold mb-4">Lifecycle States</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        { state: 'Created', desc: 'Initial state when RWA is registered.' },
                        { state: 'Verified', desc: 'Asset details verified by an Auditor agent.' },
                        { state: 'Escrowed', desc: 'Funds or legal title locked in escrow.' },
                        { state: 'In Process', desc: 'Active execution (shipping, manufacturing).' },
                        { state: 'Fulfilled', desc: 'Condition met, ready for settlement.' },
                        { state: 'Settled', desc: 'Final payment released, transaction complete.' },
                        { state: 'Disputed', desc: 'Issue raised, requires manual intervention.' }
                    ].map((item) => (
                        <Card key={item.state}>
                            <CardContent className="pt-6">
                                <h3 className="font-semibold text-lg mb-2">{item.state}</h3>
                                <p className="text-sm text-gray-500">{item.desc}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </section>

            {/* Integration Steps */}
            <section className="space-y-4">
                <h2 className="text-2xl font-bold">Integration Guide</h2>

                <h3 className="text-lg font-semibold">1. Create an RWA</h3>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                    <code>{`import { createRWASDK } from '@relay-core/sdk';

const rwa = createRWASDK({ apiUrl: 'https://relay.api' });

const asset = await rwa.create('rwa_123', {
    type: 'invoice',
    amount: '1000'
});`}</code>
                </pre>

                <h3 className="text-lg font-semibold">2. Trigger Transition (x402)</h3>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                    <code>{`// Triggers x402 payment challenge
await rwa.transition({
    rwaId: 'rwa_123',
    toState: 'verified',
    agentAddress: '0xAgentAddress...',
    agentRole: 'verifier',
    signer: walletSigner
});`}</code>
                </pre>
            </section>
        </div>
    );
}
