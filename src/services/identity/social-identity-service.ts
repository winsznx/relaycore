import { supabase } from '../../lib/supabase.js';
import { ethers } from 'ethers';

/**
 * Social Identity Resolution Service
 * 
 * Maps social identities (Twitter, Telegram, Discord) to wallet addresses
 * Enables agent-to-human payments via social handles
 */

export type Platform = 'twitter' | 'telegram' | 'discord' | 'github';

export interface IdentityMapping {
    id: string;
    socialId: string;
    walletAddress: string;
    platform: Platform;
    platformUserId: string;
    verified: boolean;
    verificationProof: string;
    createdAt: Date;
    lastVerified: Date;
}

export interface VerificationChallenge {
    challengeId: string;
    message: string;
    expiresAt: Date;
}

export class SocialIdentityService {
    /**
     * Generate verification challenge for linking social account to wallet
     */
    async generateChallenge(params: {
        socialId: string;
        platform: Platform;
        walletAddress: string;
    }): Promise<VerificationChallenge> {
        const challengeId = ethers.hexlify(ethers.randomBytes(16));
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        const message = `Link ${params.platform} account ${params.socialId} to wallet ${params.walletAddress}\n\nChallenge: ${challengeId}\nExpires: ${expiresAt.toISOString()}`;

        // Store challenge in database
        await supabase.from('verification_challenges').insert({
            challenge_id: challengeId,
            social_id: params.socialId,
            platform: params.platform,
            wallet_address: params.walletAddress,
            message,
            expires_at: expiresAt.toISOString(),
            status: 'pending',
        });

        return {
            challengeId,
            message,
            expiresAt,
        };
    }

    /**
     * Verify signature and create identity mapping
     */
    async verifyAndLink(params: {
        challengeId: string;
        signature: string;
    }): Promise<IdentityMapping> {
        // Get challenge from database
        const { data: challenge, error } = await supabase
            .from('verification_challenges')
            .select('*')
            .eq('challenge_id', params.challengeId)
            .eq('status', 'pending')
            .single();

        if (error || !challenge) {
            throw new Error('Challenge not found or expired');
        }

        // Check expiration
        if (new Date(challenge.expires_at) < new Date()) {
            throw new Error('Challenge expired');
        }

        // Verify signature
        const recoveredAddress = ethers.verifyMessage(challenge.message, params.signature);

        if (recoveredAddress.toLowerCase() !== challenge.wallet_address.toLowerCase()) {
            throw new Error('Invalid signature');
        }

        // Create identity mapping
        const { data: mapping, error: mappingError } = await supabase
            .from('identity_mappings')
            .insert({
                social_id: challenge.social_id,
                wallet_address: challenge.wallet_address,
                platform: challenge.platform,
                platform_user_id: challenge.social_id,
                verified: true,
                verification_proof: params.signature,
                last_verified: new Date().toISOString(),
            })
            .select()
            .single();

        if (mappingError) {
            throw new Error(`Failed to create mapping: ${mappingError.message}`);
        }

        // Mark challenge as completed
        await supabase
            .from('verification_challenges')
            .update({ status: 'completed' })
            .eq('challenge_id', params.challengeId);

        console.log(`Linked ${challenge.platform} account ${challenge.social_id} to ${challenge.wallet_address}`);

        return {
            id: mapping.id,
            socialId: mapping.social_id,
            walletAddress: mapping.wallet_address,
            platform: mapping.platform,
            platformUserId: mapping.platform_user_id,
            verified: mapping.verified,
            verificationProof: mapping.verification_proof,
            createdAt: new Date(mapping.created_at),
            lastVerified: new Date(mapping.last_verified),
        };
    }

    /**
     * Resolve wallet address from social ID
     */
    async resolveWallet(socialId: string, platform?: Platform): Promise<string | null> {
        let query = supabase
            .from('identity_mappings')
            .select('wallet_address')
            .eq('social_id', socialId)
            .eq('verified', true);

        if (platform) {
            query = query.eq('platform', platform);
        }

        const { data, error } = await query.single();

        if (error || !data) {
            return null;
        }

        return data.wallet_address;
    }

    /**
     * Resolve social ID from wallet address
     */
    async resolveSocial(walletAddress: string, platform?: Platform): Promise<string | null> {
        let query = supabase
            .from('identity_mappings')
            .select('social_id')
            .eq('wallet_address', walletAddress.toLowerCase())
            .eq('verified', true);

        if (platform) {
            query = query.eq('platform', platform);
        }

        const { data, error } = await query.single();

        if (error || !data) {
            return null;
        }

        return data.social_id;
    }

    /**
     * Get all mappings for a wallet
     */
    async getMappings(walletAddress: string): Promise<IdentityMapping[]> {
        const { data, error } = await supabase
            .from('identity_mappings')
            .select('*')
            .eq('wallet_address', walletAddress.toLowerCase())
            .eq('verified', true);

        if (error || !data) {
            return [];
        }

        return data.map((m) => ({
            id: m.id,
            socialId: m.social_id,
            walletAddress: m.wallet_address,
            platform: m.platform,
            platformUserId: m.platform_user_id,
            verified: m.verified,
            verificationProof: m.verification_proof,
            createdAt: new Date(m.created_at),
            lastVerified: new Date(m.last_verified),
        }));
    }

    /**
     * Unlink social account from wallet
     */
    async unlink(socialId: string, walletAddress: string): Promise<void> {
        const { error } = await supabase
            .from('identity_mappings')
            .delete()
            .eq('social_id', socialId)
            .eq('wallet_address', walletAddress.toLowerCase());

        if (error) {
            throw new Error(`Failed to unlink: ${error.message}`);
        }

        console.log(`Unlinked ${socialId} from ${walletAddress}`);
    }

    /**
     * Pay to social ID (resolves wallet and sends payment)
     */
    async payToSocial(params: {
        fromAddress: string;
        toSocialId: string;
        platform: Platform;
        amount: string;
        signer: any; // ethers.Signer
    }): Promise<{ txHash: string; toWallet: string }> {
        // Resolve wallet address
        const toWallet = await this.resolveWallet(params.toSocialId, params.platform);

        if (!toWallet) {
            throw new Error(`No wallet found for ${params.platform} account: ${params.toSocialId}`);
        }

        // Send payment using x402
        const { facilitatorService } = await import('../x402/facilitator-service.js');

        const paymentRequirements = facilitatorService.generatePaymentRequirements({
            merchantAddress: toWallet,
            amount: params.amount,
            resourceUrl: `social://${params.platform}/${params.toSocialId}`,
            description: `Payment to @${params.toSocialId} on ${params.platform}`,
        });

        const facilitator = facilitatorService.getFacilitator();
        const paymentHeader = await facilitator.generatePaymentHeader({
            to: toWallet,
            value: params.amount,
            signer: params.signer,
        });

        const result = await facilitatorService.settlePayment({
            paymentHeader,
            paymentRequirements,
        });

        console.log(`Paid ${params.amount} to @${params.toSocialId} (${toWallet})`);

        return {
            txHash: result.txHash || '',
            toWallet,
        };
    }
}

// Singleton instance
export const socialIdentityService = new SocialIdentityService();
