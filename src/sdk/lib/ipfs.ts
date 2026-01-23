/**
 * IPFS Metadata Service (SDK Version)
 */

export interface AgentMetadata {
    name: string;
    description: string;
    image?: string;
    external_url?: string;
    attributes: {
        trait_type: string;
        value: string | number;
    }[];
    service_type: string;
    endpoint: string;
    price_per_request: string;
    version: string;
    created_at: string;
}

export async function uploadAgentMetadataToIPFS(
    metadata: AgentMetadata,
    apiBaseUrl: string
): Promise<string> {
    try {
        const response = await fetch(`${apiBaseUrl}/api/ipfs/upload-metadata`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(metadata),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'IPFS upload failed');
        }

        const result = await response.json();
        return result.ipfsUri;
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to upload to IPFS: ${message}`);
    }
}

export function buildAgentMetadata(params: {
    name: string;
    description: string;
    serviceType: string;
    endpoint: string;
    pricePerRequest: string;
    imageUri?: string;
}): AgentMetadata {
    return {
        name: params.name,
        description: params.description,
        image: params.imageUri,
        external_url: 'https://relaycore.xyz',
        attributes: [
            { trait_type: 'Service Type', value: params.serviceType },
            { trait_type: 'Network', value: 'Cronos Testnet' },
            { trait_type: 'Protocol', value: 'x402' },
        ],
        service_type: params.serviceType,
        endpoint: params.endpoint,
        price_per_request: params.pricePerRequest,
        version: '1.0.0',
        created_at: new Date().toISOString(),
    };
}
