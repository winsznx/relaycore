/**
 * Cronos SDK Configuration
 * 
 * Environment-based configuration for the Cronos Developer Platform SDK.
 * All configuration is read from environment variables.
 */

declare const process: { env: Record<string, string | undefined> };

import { type CronosNetwork, type CronosConfig } from './index';

export function getCronosConfigFromEnv(): CronosConfig {
    const apiKey = process.env.DEVELOPER_PLATFORM_API_KEY;

    if (!apiKey) {
        throw new Error(
            'DEVELOPER_PLATFORM_API_KEY is required. ' +
            'Obtain one from https://developer.crypto.com/'
        );
    }

    const defaultNetwork = (process.env.CRONOS_DEFAULT_NETWORK || 'cronos-evm-testnet') as CronosNetwork;

    const validNetworks: CronosNetwork[] = [
        'cronos-evm-mainnet',
        'cronos-evm-testnet',
        'cronos-zkevm-mainnet',
        'cronos-zkevm-testnet'
    ];

    if (!validNetworks.includes(defaultNetwork)) {
        throw new Error(
            `Invalid CRONOS_DEFAULT_NETWORK: ${defaultNetwork}. ` +
            `Must be one of: ${validNetworks.join(', ')}`
        );
    }

    return {
        apiKey,
        defaultNetwork,
        provider: process.env.CRONOS_RPC_URL
    };
}

export const EXPLORER_API_KEYS = {
    cronosEvm: {
        testnet: process.env.CRONOS_EXPLORER_API_KEY_TESTNET || process.env.CRONOS_EXPLORER_API_KEY,
        mainnet: process.env.CRONOS_EXPLORER_API_KEY_MAINNET || process.env.CRONOS_EXPLORER_API_KEY
    },
    cronosZkEvm: {
        testnet: process.env.CRONOS_ZKEVM_API_KEY,
        mainnet: process.env.CRONOS_ZKEVM_API_KEY
    }
};
