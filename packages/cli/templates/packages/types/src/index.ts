export interface AgentConfig {
    name: string;
    description: string;
    version: string;
    capabilities: string[];
}

export interface ServiceConfig {
    id: string;
    name: string;
    endpoint: string;
    pricing?: {
        amount: number;
        currency: string;
    };
}

export interface RelayCoreConfig {
    agent: AgentConfig;
    services: ServiceConfig[];
    network: {
        environment: 'testnet' | 'mainnet';
    };
}
