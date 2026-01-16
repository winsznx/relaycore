/**
 * Agent Feedback Component
 * 
 * Allows users to submit feedback for agents after using their services.
 * Integrates with ReputationRegistry on Cronos Testnet.
 */

import { useState } from 'react';
import { useAppKitAccount } from '@reown/appkit/react';
import { ethers } from 'ethers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Star,
    Send,
    CheckCircle,
    AlertCircle,
    ThumbsUp,
    ThumbsDown,
    Loader2
} from 'lucide-react';

// Contract addresses
const REPUTATION_REGISTRY = import.meta.env.VITE_REPUTATION_REGISTRY_ADDRESS || '0xdaFC2fA590C5Ba88155a009660dC3b14A3651a67';

// Minimal ABI for feedback
const REPUTATION_ABI = [
    "function giveFeedback(uint256 agentId, uint8 score, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash) external",
    "function getAverageScore(uint256 agentId) view returns (uint8)",
    "function getTotalFeedbackCount(uint256 agentId) view returns (uint256)"
];

interface FeedbackFormProps {
    agentId: number;
    agentName: string;
    endpoint?: string;
    onSuccess?: () => void;
}

export function FeedbackForm({ agentId, agentName, endpoint = '/api/agent', onSuccess }: FeedbackFormProps) {
    const { address, isConnected } = useAppKitAccount();
    const [score, setScore] = useState<number>(80);
    const [tag, setTag] = useState<string>('trade');
    const [comment, setComment] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const scoreLabels: Record<number, { label: string; color: string }> = {
        20: { label: 'Poor', color: 'text-red-500' },
        40: { label: 'Fair', color: 'text-orange-500' },
        60: { label: 'Good', color: 'text-yellow-500' },
        80: { label: 'Great', color: 'text-green-500' },
        100: { label: 'Excellent', color: 'text-emerald-500' }
    };

    const tags = ['trade', 'oracle', 'analysis', 'quote', 'execution'];

    const submitFeedback = async () => {
        if (!isConnected || !address) {
            setError('Please connect your wallet first');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Get provider and signer
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            const signer = await provider.getSigner();

            // Connect to contract
            const contract = new ethers.Contract(REPUTATION_REGISTRY, REPUTATION_ABI, signer);

            // Create feedback hash from comment
            const feedbackHash = comment
                ? ethers.keccak256(ethers.toUtf8Bytes(comment))
                : ethers.ZeroHash;

            // Submit feedback
            const tx = await contract.giveFeedback(
                agentId,
                score,
                tag,           // tag1
                '',            // tag2 (optional)
                endpoint,      // endpoint
                '',            // feedbackURI (could be IPFS)
                feedbackHash   // feedbackHash
            );

            await tx.wait();
            setSuccess(true);
            onSuccess?.();
        } catch (err: any) {
            console.error('Feedback error:', err);
            setError(err.reason || err.message || 'Failed to submit feedback');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <Card className="border-0 shadow-sm ring-1 ring-green-200 bg-green-50">
                <CardContent className="p-6 text-center">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                    <h3 className="font-semibold text-green-800">Thank you!</h3>
                    <p className="text-sm text-green-600">
                        Your feedback has been recorded on-chain.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-0 shadow-sm ring-1 ring-gray-100">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold">
                    Rate {agentName}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Score Slider */}
                <div>
                    <label className="text-sm text-gray-600 mb-2 block">
                        How was your experience?
                    </label>
                    <div className="flex items-center gap-4">
                        <ThumbsDown className="w-5 h-5 text-red-400" />
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="20"
                            value={score}
                            onChange={(e) => setScore(Number(e.target.value))}
                            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <ThumbsUp className="w-5 h-5 text-green-400" />
                    </div>
                    <div className="text-center mt-2">
                        <span className={`text-lg font-bold ${scoreLabels[score]?.color || 'text-gray-700'}`}>
                            {score}/100 - {scoreLabels[score]?.label || 'Rate'}
                        </span>
                    </div>
                </div>

                {/* Tag Selection */}
                <div>
                    <label className="text-sm text-gray-600 mb-2 block">
                        Service Category
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {tags.map((t) => (
                            <button
                                key={t}
                                onClick={() => setTag(t)}
                                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${tag === t
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Comment */}
                <div>
                    <label className="text-sm text-gray-600 mb-2 block">
                        Comment (optional)
                    </label>
                    <Input
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Share your experience..."
                        className="w-full"
                    />
                </div>

                {/* Error */}
                {error && (
                    <div className="flex items-center gap-2 text-red-600 text-sm">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                    </div>
                )}

                {/* Submit Button */}
                <Button
                    onClick={submitFeedback}
                    disabled={loading || !isConnected}
                    className="w-full"
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Submitting...
                        </>
                    ) : (
                        <>
                            <Send className="w-4 h-4 mr-2" />
                            Submit Feedback
                        </>
                    )}
                </Button>

                {!isConnected && (
                    <p className="text-xs text-gray-500 text-center">
                        Connect your wallet to submit feedback
                    </p>
                )}

                <p className="text-xs text-gray-400 text-center">
                    Feedback is stored on Cronos Testnet
                </p>
            </CardContent>
        </Card>
    );
}

/**
 * Quick star rating for inline use
 */
interface QuickRatingProps {
    agentId: number;
    onRate?: (score: number) => void;
}

export function QuickRating({ agentId: _agentId, onRate }: QuickRatingProps) {
    const [hoveredStar, setHoveredStar] = useState<number>(0);
    const [selectedStar, setSelectedStar] = useState<number>(0);

    const handleClick = (star: number) => {
        const score = star * 20; // Convert 1-5 stars to 0-100 scale
        setSelectedStar(star);
        onRate?.(score);
    };

    return (
        <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    onClick={() => handleClick(star)}
                    onMouseEnter={() => setHoveredStar(star)}
                    onMouseLeave={() => setHoveredStar(0)}
                    className="p-0.5 transition-transform hover:scale-110"
                >
                    <Star
                        className={`w-5 h-5 ${star <= (hoveredStar || selectedStar)
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300'
                            }`}
                    />
                </button>
            ))}
        </div>
    );
}

export default FeedbackForm;
