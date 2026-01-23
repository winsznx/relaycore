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
    ESCROW_CONTRACT: process.env.ESCROW_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000',
    ESCROW_CONTRACT_DEPLOY_BLOCK: parseInt(process.env.ESCROW_CONTRACT_DEPLOY_BLOCK || '0'),

    // USDC Token (Testnet)
    USDC_ADDRESS: process.env.USDC_ADDRESS || '0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0',

    // Cron Schedules
    CRON_PAYMENT_INDEXER: '*/5 * * * *',      // Every 5 minutes
    CRON_AGENT_INDEXER: '*/15 * * * *',       // Every 15 minutes
    CRON_REPUTATION_CALC: '0 1 * * *',        // Daily at 1:00 AM
    CRON_TRADE_INDEXER: '*/10 * * * *',       // Every 10 minutes
    CRON_ESCROW_INDEXER: '*/2 * * * *',       // Every 2 minutes (high priority)
    CRON_HANDOFF_INDEXER: '*/1 * * * *',      // Every 1 minute (for pending tx cleanup)

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

// Escrow Session Contract ABI (matches EscrowSession.sol)
export const ESCROW_ABI = [
    // Events
    'event SessionCreated(uint256 indexed sessionId, address indexed owner, address escrowAgent, uint256 maxSpend, uint256 expiry)',
    'event FundsDeposited(uint256 indexed sessionId, address indexed depositor, uint256 amount)',
    'event PaymentReleased(uint256 indexed sessionId, address indexed agent, uint256 amount, bytes32 executionId)',
    'event SessionRefunded(uint256 indexed sessionId, address indexed owner, uint256 amount)',
    'event SessionClosed(uint256 indexed sessionId)',
    'event AgentAuthorized(uint256 indexed sessionId, address indexed agent)',
    'event AgentRevoked(uint256 indexed sessionId, address indexed agent)',

    // View Functions
    'function sessions(uint256) view returns (address owner, address escrowAgent, uint256 deposited, uint256 released, uint256 maxSpend, uint256 expiry, bool active)',
    'function authorizedAgents(uint256, address) view returns (bool)',
    'function agentSpend(uint256, address) view returns (uint256)',
    'function remainingBalance(uint256 sessionId) view returns (uint256)',
    'function getSession(uint256 sessionId) view returns (address owner, address escrowAgent, uint256 deposited, uint256 released, uint256 remaining, uint256 maxSpend, uint256 expiry, bool active)',
    'function isAgentAuthorized(uint256 sessionId, address agent) view returns (bool)',
    'function getAgentSpend(uint256 sessionId, address agent) view returns (uint256)',
    'function sessionCounter() view returns (uint256)',
    'function paymentToken() view returns (address)',
];

