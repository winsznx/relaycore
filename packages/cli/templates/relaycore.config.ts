import { defineConfig } from '@relaycore/sdk';

export default defineConfig({
    agent: {
        name: 'My RelayCore Agent',
        description: 'An AI agent built with RelayCore',
        version: '0.1.0',
        capabilities: [
            'chat',
            'task-execution',
        ],
    },
    services: [],
    network: {
        environment: process.env.RELAYCORE_ENVIRONMENT || 'testnet',
    },
});
