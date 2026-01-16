/**
 * IPFS Metadata Service (Frontend)
 * 
 * SECURITY: This module calls backend API routes instead of using Pinata keys directly.
 * All sensitive credentials are kept server-side only.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

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

/**
 * Upload agent metadata to IPFS via backend API
 * Returns the IPFS URI (ipfs://...) for use as agentURI
 */
export async function uploadAgentMetadataToIPFS(
    metadata: AgentMetadata
): Promise<string> {
    try {
        const response = await fetch(`${API_BASE}/api/ipfs/upload-metadata`, {
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

        if (result.warning) {
            console.warn('IPFS upload warning:', result.warning);
        }

        return result.ipfsUri;
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('IPFS upload failed:', message);
        throw new Error(`Failed to upload to IPFS: ${message}`);
    }
}

/**
 * Upload an image file to IPFS via backend API
 */
export async function uploadImageToIPFS(file: File): Promise<string> {
    try {
        // Convert file to base64
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

        const response = await fetch(`${API_BASE}/api/ipfs/upload-image`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                imageData: base64,
                fileName: file.name,
            }),
        });

        if (!response.ok) {
            throw new Error('Image upload failed');
        }

        const result = await response.json();
        return result.ipfsUri;
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Image upload failed:', message);
        throw new Error(`Failed to upload image: ${message}`);
    }
}

/**
 * Convert IPFS URI to HTTP gateway URL for display
 */
export function ipfsToHttp(ipfsUri: string): string {
    if (!ipfsUri.startsWith('ipfs://')) return ipfsUri;
    const cid = ipfsUri.replace('ipfs://', '');
    return `https://gateway.pinata.cloud/ipfs/${cid}`;
}

/**
 * Fetch metadata from IPFS
 */
export async function fetchMetadataFromIPFS(ipfsUri: string): Promise<AgentMetadata> {
    const httpUrl = ipfsToHttp(ipfsUri);
    const response = await fetch(httpUrl);
    if (!response.ok) {
        throw new Error('Failed to fetch IPFS metadata');
    }
    return response.json();
}

/**
 * Build standard agent metadata object
 */
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
