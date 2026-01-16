/**
 * Indexer Configuration Constants
 */

export const INDEXER_CONFIG = {
    // Cronos Network
    CRONOS_TESTNET_RPC: process.env.CRONOS_RPC_URL || 'https://evm-t3.cronos.org',
    CRONOS_MAINNET_RPC: 'https://evm.cronos.org',
    CHAIN_ID_TESTNET: 338,
    CHAIN_ID_MAINNET: 25,

    // Contract Addresses (Testnet)
    IDENTITY_REGISTRY: process.env.IDENTITY_REGISTRY_ADDRESS || '0x4b697D8ABC0e3dA0086011222755d9029DBB9C43',
    REPUTATION_REGISTRY: process.env.REPUTATION_REGISTRY_ADDRESS || '0xdaFC2fA590C5Ba88155a009660dC3b14A3651a67',
    VALIDATION_REGISTRY: process.env.VALIDATION_REGISTRY_ADDRESS || '0x0483d030a1B1dA819dA08e2b73b01eFD28c67322',

    // USDC Token (Testnet)
    USDC_ADDRESS: process.env.USDC_ADDRESS || '0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0',

    // Cron Schedules
    CRON_PAYMENT_INDEXER: '*/5 * * * *',      // Every 5 minutes
    CRON_AGENT_INDEXER: '*/15 * * * *',       // Every 15 minutes
    CRON_REPUTATION_CALC: '0 1 * * *',        // Daily at 1:00 AM
    CRON_TRADE_INDEXER: '*/10 * * * *',       // Every 10 minutes

    // Indexer Settings
    BATCH_SIZE: 100,
    BLOCK_CONFIRMATIONS: 6,
    MAX_BLOCKS_PER_RUN: 1000,
    RETRY_DELAY_MS: 5000,
    MAX_RETRIES: 3,
} as const;

export const CONTRACT_ABIS: Record<string, string[]> = {
    IDENTITY_REGISTRY: [
        'event AgentRegistered(uint256 indexed agentId, address indexed owner, string agentURI)',
        'event AgentDeactivated(uint256 indexed agentId)',
        'event AgentReactivated(uint256 indexed agentId)',
        'event AgentURIUpdated(uint256 indexed agentId, string newURI)',
        'function getAgent(uint256 agentId) view returns (address owner, string memory agentURI, bool isActive)',
        'function totalAgents() view returns (uint256)',
    ],
    REPUTATION_REGISTRY: [
        'event FeedbackSubmitted(address indexed subject, address indexed submitter, string tag, uint8 score, string comment)',
        'event FeedbackRevoked(address indexed subject, address indexed submitter, string tag)',
        'function getAverageScore(address subject, string tag) view returns (uint256)',
        'function getFeedbackCount(address subject, string tag) view returns (uint256)',
    ],
    ERC20: [
        'event Transfer(address indexed from, address indexed to, uint256 value)',
        'function balanceOf(address owner) view returns (uint256)',
        'function decimals() view returns (uint8)',
    ],
};

