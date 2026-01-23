import { useState, useCallback, useMemo } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { BrowserProvider } from 'ethers';
import {
    createConsumerSDK,
    type ServiceQuery,
    type DiscoveredService,
    type ServiceCallResult,
} from './consumer-sdk';
import {
    createProviderSDK,
    type ServiceRegistration,
    type RegisteredService,
    type ProviderReputation,
} from './provider-sdk';

/**
 * React hook for Service Consumer SDK
 * 
 * Provides easy access to service discovery and calling functionality
 * with automatic wallet integration via wagmi.
 */
export function useConsumerSDK(config?: { apiUrl?: string }) {
    const { address } = useAccount();
    const { data: walletClient } = useWalletClient();

    const sdk = useMemo(() => {
        const instance = createConsumerSDK({
            apiUrl: config?.apiUrl,
            network: 'mainnet',
        });
        return instance;
    }, [config?.apiUrl]);

    // Connect signer when wallet is available
    const connectSigner = useCallback(async () => {
        if (walletClient) {
            const provider = new BrowserProvider(walletClient.transport);
            const signer = await provider.getSigner();
            sdk.connectSigner(signer);
            return true;
        }
        return false;
    }, [walletClient, sdk]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Discover services matching criteria
     */
    const discoverServices = useCallback(async (
        query: ServiceQuery
    ): Promise<DiscoveredService[]> => {
        setLoading(true);
        setError(null);
        try {
            return await sdk.discoverServices(query);
        } catch (err) {
            setError((err as Error).message);
            return [];
        } finally {
            setLoading(false);
        }
    }, [sdk]);

    /**
     * Get a single service
     */
    const getService = useCallback(async (
        serviceId: string
    ): Promise<DiscoveredService | null> => {
        setLoading(true);
        setError(null);
        try {
            return await sdk.getService(serviceId);
        } catch (err) {
            setError((err as Error).message);
            return null;
        } finally {
            setLoading(false);
        }
    }, [sdk]);

    /**
     * Call a service with automatic payment
     */
    const callService = useCallback(async <T = unknown>(params: {
        serviceId: string;
        endpoint?: string;
        method?: 'GET' | 'POST';
        body?: unknown;
    }): Promise<ServiceCallResult<T>> => {
        setLoading(true);
        setError(null);
        try {
            await connectSigner();
            return await sdk.callService<T>(params);
        } catch (err) {
            setError((err as Error).message);
            return {
                success: false,
                error: (err as Error).message,
                latencyMs: 0,
            };
        } finally {
            setLoading(false);
        }
    }, [sdk, connectSigner]);

    /**
     * Find compatible services by type
     */
    const findCompatible = useCallback(async (params: {
        inputType?: string;
        outputType?: string;
        tags?: string[];
    }): Promise<DiscoveredService[]> => {
        setLoading(true);
        setError(null);
        try {
            return await sdk.findCompatibleServices(params);
        } catch (err) {
            setError((err as Error).message);
            return [];
        } finally {
            setLoading(false);
        }
    }, [sdk]);

    return {
        sdk,
        address,
        loading,
        error,
        discoverServices,
        getService,
        callService,
        findCompatible,
        connectSigner,
    };
}

/**
 * React hook for Service Provider SDK
 * 
 * Provides easy access to service registration and management
 * with automatic wallet integration via wagmi.
 */
export function useProviderSDK(config?: { apiUrl?: string }) {
    const { address } = useAccount();
    const { data: walletClient } = useWalletClient();

    const sdk = useMemo(() => {
        if (!address) return null;
        return createProviderSDK(address, {
            apiUrl: config?.apiUrl,
        });
    }, [address, config?.apiUrl]);

    // Connect signer when wallet is available
    const connectSigner = useCallback(async () => {
        if (walletClient && sdk) {
            const provider = new BrowserProvider(walletClient.transport);
            const signer = await provider.getSigner();
            sdk.connectSigner(signer);
            return true;
        }
        return false;
    }, [walletClient, sdk]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Register a new service
     */
    const registerService = useCallback(async (
        service: ServiceRegistration
    ): Promise<RegisteredService | null> => {
        if (!sdk) {
            setError('Wallet not connected');
            return null;
        }

        setLoading(true);
        setError(null);
        try {
            return await sdk.registerService(service);
        } catch (err) {
            setError((err as Error).message);
            return null;
        } finally {
            setLoading(false);
        }
    }, [sdk]);

    /**
     * Get provider reputation
     */
    const getReputation = useCallback(async (): Promise<ProviderReputation | null> => {
        if (!sdk) {
            setError('Wallet not connected');
            return null;
        }

        setLoading(true);
        setError(null);
        try {
            return await sdk.getReputation();
        } catch (err) {
            setError((err as Error).message);
            return null;
        } finally {
            setLoading(false);
        }
    }, [sdk]);

    /**
     * Get all services for this provider
     */
    const getMyServices = useCallback(async (): Promise<RegisteredService[]> => {
        if (!sdk) {
            setError('Wallet not connected');
            return [];
        }

        setLoading(true);
        setError(null);
        try {
            return await sdk.getMyServices();
        } catch (err) {
            setError((err as Error).message);
            return [];
        } finally {
            setLoading(false);
        }
    }, [sdk]);

    return {
        sdk,
        address,
        loading,
        error,
        registerService,
        getReputation,
        getMyServices,
        connectSigner,
    };
}
