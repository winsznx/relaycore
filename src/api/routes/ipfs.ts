/**
 * IPFS API Routes
 * 
 * Backend routes for IPFS operations - keeps Pinata API keys secure
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import logger from '../../lib/logger.js';

const router = Router();

// Backend-only Pinata credentials (not exposed to client)
const PINATA_JWT = process.env.PINATA_JWT || '';
const PINATA_API_KEY = process.env.PINATA_API_KEY || '';
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY || '';

interface AgentMetadata {
    name: string;
    description: string;
    image?: string;
    external_url?: string;
    attributes: { trait_type: string; value: string | number }[];
    service_type: string;
    endpoint: string;
    price_per_request: string;
    version: string;
    created_at: string;
}

/**
 * POST /api/ipfs/upload-metadata
 * Upload agent metadata JSON to IPFS
 */
router.post('/upload-metadata', async (req: Request, res: Response) => {
    try {
        const metadata: AgentMetadata = req.body;

        // Validate required fields
        if (!metadata.name || !metadata.description) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: name, description'
            });
        }

        // Check if credentials are configured
        if (!PINATA_JWT && !PINATA_API_KEY) {
            // Generate placeholder for demo
            const hash = Buffer.from(JSON.stringify(metadata)).toString('base64').slice(0, 46);
            return res.json({
                success: true,
                ipfsUri: `ipfs://bafybeie${hash.replace(/[^a-z0-9]/gi, 'x')}`,
                warning: 'Using placeholder - Pinata not configured'
            });
        }

        const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(PINATA_JWT
                    ? { 'Authorization': `Bearer ${PINATA_JWT}` }
                    : {
                        'pinata_api_key': PINATA_API_KEY,
                        'pinata_secret_api_key': PINATA_SECRET_KEY
                    }
                ),
            },
            body: JSON.stringify({
                pinataContent: metadata,
                pinataMetadata: {
                    name: `relaycore-agent-${metadata.name.toLowerCase().replace(/\s+/g, '-')}`,
                },
                pinataOptions: {
                    cidVersion: 1,
                },
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            logger.error('Pinata upload failed', { error });
            return res.status(500).json({
                success: false,
                error: 'IPFS upload failed'
            });
        }

        const result = await response.json();

        logger.info('Metadata uploaded to IPFS', {
            cid: result.IpfsHash,
            name: metadata.name
        });

        res.json({
            success: true,
            ipfsUri: `ipfs://${result.IpfsHash}`,
            cid: result.IpfsHash
        });
    } catch (error) {
        logger.error('IPFS metadata upload error', error as Error);
        res.status(500).json({
            success: false,
            error: 'Failed to upload metadata'
        });
    }
});

/**
 * POST /api/ipfs/upload-image
 * Upload image file to IPFS
 * Expects multipart/form-data with 'file' field
 */
router.post('/upload-image', async (req: Request, res: Response) => {
    try {
        // For file uploads, the frontend should send the file as base64
        // or use a separate multer middleware
        const { imageData, fileName } = req.body;

        if (!imageData) {
            return res.status(400).json({
                success: false,
                error: 'No image data provided'
            });
        }

        if (!PINATA_JWT && !PINATA_API_KEY) {
            return res.json({
                success: true,
                ipfsUri: 'ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
                warning: 'Using placeholder - Pinata not configured'
            });
        }

        // Convert base64 to buffer
        const imageBuffer = Buffer.from(imageData, 'base64');
        const blob = new Blob([imageBuffer]);

        const formData = new FormData();
        formData.append('file', blob, fileName || 'agent-image.png');
        formData.append('pinataMetadata', JSON.stringify({
            name: `relaycore-image-${Date.now()}`,
        }));

        const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
            method: 'POST',
            headers: {
                ...(PINATA_JWT
                    ? { 'Authorization': `Bearer ${PINATA_JWT}` }
                    : {
                        'pinata_api_key': PINATA_API_KEY,
                        'pinata_secret_api_key': PINATA_SECRET_KEY
                    }
                ),
            },
            body: formData,
        });

        if (!response.ok) {
            logger.error('Pinata image upload failed');
            return res.status(500).json({
                success: false,
                error: 'Image upload failed'
            });
        }

        const result = await response.json();

        logger.info('Image uploaded to IPFS', { cid: result.IpfsHash });

        res.json({
            success: true,
            ipfsUri: `ipfs://${result.IpfsHash}`,
            cid: result.IpfsHash
        });
    } catch (error) {
        logger.error('IPFS image upload error', error as Error);
        res.status(500).json({
            success: false,
            error: 'Failed to upload image'
        });
    }
});

export default router;
