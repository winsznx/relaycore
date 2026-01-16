/**
 * Identity Resolution Service
 * 
 * Resolves social handles (@username) to wallet addresses
 * per ARCHITECTURE.md specification
 */

import { supabase } from '../../lib/supabase';

export interface IdentityMapping {
    id: string;
    socialId: string;
    walletAddress: string;
    platform: string;
    verified: boolean;
    createdAt: string;
}

export interface LinkIdentityRequest {
    socialId: string;
    walletAddress: string;
    platform: 'twitter' | 'telegram' | 'farcaster' | 'discord';
    signature?: string;
}

export class IdentityService {
    /**
     * Resolve a social ID to wallet address
     */
    async resolve(socialId: string): Promise<IdentityMapping | null> {
        const { data, error } = await supabase
            .from('identity_mappings')
            .select('*')
            .eq('social_id', socialId.toLowerCase())
            .single();

        if (error || !data) {
            return null;
        }

        return {
            id: data.id,
            socialId: data.social_id,
            walletAddress: data.wallet_address,
            platform: data.platform,
            verified: data.verified,
            createdAt: data.created_at,
        };
    }

    /**
     * Reverse lookup - find social IDs for a wallet
     */
    async getWalletIdentities(walletAddress: string): Promise<IdentityMapping[]> {
        const { data, error } = await supabase
            .from('identity_mappings')
            .select('*')
            .eq('wallet_address', walletAddress.toLowerCase());

        if (error || !data) {
            return [];
        }

        return data.map(d => ({
            id: d.id,
            socialId: d.social_id,
            walletAddress: d.wallet_address,
            platform: d.platform,
            verified: d.verified,
            createdAt: d.created_at,
        }));
    }

    /**
     * Link a social ID to a wallet address
     */
    async link(request: LinkIdentityRequest): Promise<IdentityMapping> {
        const { data, error } = await supabase
            .from('identity_mappings')
            .upsert({
                social_id: request.socialId.toLowerCase(),
                wallet_address: request.walletAddress.toLowerCase(),
                platform: request.platform,
                verified: false,
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'social_id',
            })
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to link identity: ${error.message}`);
        }

        return {
            id: data.id,
            socialId: data.social_id,
            walletAddress: data.wallet_address,
            platform: data.platform,
            verified: data.verified,
            createdAt: data.created_at,
        };
    }

    /**
     * Verify identity ownership (requires signature)
     */
    async verify(socialId: string, _signature: string): Promise<boolean> {
        // TODO: Implement signature verification
        // For now, auto-verify
        const { error } = await supabase
            .from('identity_mappings')
            .update({ verified: true, updated_at: new Date().toISOString() })
            .eq('social_id', socialId.toLowerCase());

        return !error;
    }

    /**
     * Unlink identity
     */
    async unlink(socialId: string, walletAddress: string): Promise<boolean> {
        const { error } = await supabase
            .from('identity_mappings')
            .delete()
            .eq('social_id', socialId.toLowerCase())
            .eq('wallet_address', walletAddress.toLowerCase());

        return !error;
    }
}

export const identityService = new IdentityService();
