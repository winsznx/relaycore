'use client';

import { useEffect, useState } from 'react';

export default function Home() {
    const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');

    useEffect(() => {
        setTimeout(() => setStatus('connected'), 1000);
    }, []);

    return (
        <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
            <h1>RelayCore Agent Dashboard</h1>

            <div style={{ marginTop: '2rem' }}>
                <h2>Agent Status</h2>
                <p>Status: <strong>{status}</strong></p>
            </div>

            <div style={{ marginTop: '2rem' }}>
                <h2>Quick Start</h2>
                <ol>
                    <li>Configure your agent in <code>relaycore.config.ts</code></li>
                    <li>Add tools to <code>apps/agent-server/src/index.ts</code></li>
                    <li>Test your agent with Claude Desktop or other MCP clients</li>
                </ol>
            </div>

            <div style={{ marginTop: '2rem' }}>
                <h2>Resources</h2>
                <ul>
                    <li><a href="https://docs.relaycore.io">Documentation</a></li>
                    <li><a href="https://discord.gg/relaycore">Discord Community</a></li>
                    <li><a href="https://github.com/relaycore">GitHub</a></li>
                </ul>
            </div>
        </main>
    );
}
