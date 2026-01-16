import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Zap, Loader2, Upload, CheckCircle, Link2 } from 'lucide-react';
import { useAppKitAccount, useAppKitProvider } from '@/lib/web3';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/states';
import { buildAgentMetadata, uploadAgentMetadataToIPFS, uploadImageToIPFS } from '@/lib/ipfs-service';
import { registerAgent } from '@/lib/erc8004-client';
import { ethers } from 'ethers';

// Steps for agent registration
type RegistrationStep = 'form' | 'ipfs' | 'chain' | 'complete';

export function NewAgentPage() {
    const navigate = useNavigate();
    const { address, isConnected } = useAppKitAccount();
    const { walletProvider } = useAppKitProvider('eip155');

    const [currentStep, setCurrentStep] = useState<RegistrationStep>('form');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [registrationResult, setRegistrationResult] = useState<{
        agentId: number;
        ipfsUri: string;
        txHash: string;
    } | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        serviceType: 'oracle',
        pricePerRequest: '0.10',
        endpoint: '',
    });

    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isConnected || !address) {
            toast.error('Please connect your wallet');
            return;
        }

        if (!walletProvider) {
            toast.error('Wallet provider not available');
            return;
        }

        setIsSubmitting(true);

        try {
            // Step 1: Upload to IPFS
            setCurrentStep('ipfs');
            toast.info('Uploading metadata to IPFS...');

            let imageUri: string | undefined;
            if (imageFile) {
                imageUri = await uploadImageToIPFS(imageFile);
            }

            const metadata = buildAgentMetadata({
                name: formData.name,
                description: formData.description,
                serviceType: formData.serviceType,
                endpoint: formData.endpoint,
                pricePerRequest: formData.pricePerRequest,
                imageUri,
            });

            const ipfsUri = await uploadAgentMetadataToIPFS(metadata);
            toast.success('Metadata uploaded to IPFS!');

            // Step 2: Register on-chain
            setCurrentStep('chain');
            toast.info('Registering agent on Cronos blockchain...');

            const provider = new ethers.BrowserProvider(walletProvider as any);
            const signer = await provider.getSigner();

            const { agentId, txHash } = await registerAgent(ipfsUri, address, signer);

            toast.success(`Agent registered with ID: ${agentId}`);

            // Step 3: Save to Supabase for discoverability
            const { error: dbError } = await supabase
                .from('agent_services')
                .insert({
                    agent_address: address,
                    agent_id: agentId,
                    name: formData.name,
                    description: formData.description,
                    service_type: formData.serviceType,
                    price_per_request: formData.pricePerRequest,
                    endpoint: formData.endpoint,
                    ipfs_uri: ipfsUri,
                    is_active: true,
                });

            if (dbError) {
                console.error('Supabase insert failed:', dbError);
                // Not critical - agent is registered on-chain
            }

            // Log activity
            await supabase.from('agent_activity').insert({
                agent_address: address,
                activity_type: 'agent_registered',
                metadata: {
                    agentId,
                    name: formData.name,
                    serviceType: formData.serviceType,
                    ipfsUri,
                },
            });

            setRegistrationResult({
                agentId,
                ipfsUri,
                txHash,
            });
            setCurrentStep('complete');
            toast.success('Agent registration complete!');

        } catch (error: any) {
            console.error('Registration failed:', error);
            toast.error(error.message || 'Registration failed');
            setCurrentStep('form');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isConnected) {
        return (
            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-[#111111]">Register New Agent</h2>
                <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                    <CardContent className="p-12 text-center">
                        <h3 className="text-xl font-bold mb-4">Connect Your Wallet</h3>
                        <p className="text-gray-500 dark:text-gray-300">Please connect your wallet to register a new agent.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Success screen
    if (currentStep === 'complete' && registrationResult) {
        return (
            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-[#111111]">Agent Registered!</h2>
                <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                    <CardContent className="p-8 text-center">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle className="h-8 w-8 text-green-600" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">{formData.name}</h3>
                        <p className="text-gray-500 mb-6">Successfully registered on Cronos Testnet</p>

                        <div className="bg-gray-50 rounded-lg p-4 text-left space-y-3 mb-6">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-500">Agent ID</span>
                                <Badge variant="secondary">#{registrationResult.agentId}</Badge>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-500">IPFS URI</span>
                                <a
                                    href={`https://gateway.pinata.cloud/ipfs/${registrationResult.ipfsUri.replace('ipfs://', '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                                >
                                    View Metadata <Link2 className="h-3 w-3" />
                                </a>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-500">Service Type</span>
                                <Badge>{formData.serviceType}</Badge>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-500">Price</span>
                                <span className="text-sm font-mono">{formData.pricePerRequest} USDC</span>
                            </div>
                        </div>

                        <div className="flex gap-4 justify-center">
                            <Button onClick={() => navigate('/dashboard/agents')}>
                                View My Agents
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setCurrentStep('form');
                                    setRegistrationResult(null);
                                    setFormData({
                                        name: '',
                                        description: '',
                                        serviceType: 'oracle',
                                        pricePerRequest: '0.10',
                                        endpoint: '',
                                    });
                                }}
                            >
                                Register Another
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-[#111111]">Register New Agent</h2>
                    <p className="text-gray-500 dark:text-gray-300">Create an on-chain autonomous agent</p>
                </div>
                <Button
                    variant="outline"
                    onClick={() => navigate('/dashboard/agents')}
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Agents
                </Button>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center gap-4 mb-6">
                {['form', 'ipfs', 'chain', 'complete'].map((step, index) => (
                    <div key={step} className="flex items-center gap-2">
                        <div className={`
                            w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                            ${currentStep === step ? 'bg-black text-white' :
                                index < ['form', 'ipfs', 'chain', 'complete'].indexOf(currentStep)
                                    ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}
                        `}>
                            {index < ['form', 'ipfs', 'chain', 'complete'].indexOf(currentStep)
                                ? <CheckCircle className="h-4 w-4" />
                                : index + 1}
                        </div>
                        <span className={`text-sm ${currentStep === step ? 'font-medium' : 'text-gray-500'}`}>
                            {step === 'form' && 'Details'}
                            {step === 'ipfs' && 'IPFS Upload'}
                            {step === 'chain' && 'On-Chain'}
                            {step === 'complete' && 'Complete'}
                        </span>
                        {index < 3 && <div className="w-8 h-px bg-gray-200" />}
                    </div>
                ))}
            </div>

            {/* Form */}
            <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                <CardHeader>
                    <CardTitle>Agent Details</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Agent Image */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Agent Avatar (Optional)
                            </label>
                            <div className="flex items-center gap-4">
                                {imagePreview ? (
                                    <img
                                        src={imagePreview}
                                        alt="Preview"
                                        className="w-16 h-16 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                                        <Upload className="h-6 w-6 text-gray-400" />
                                    </div>
                                )}
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                Will be uploaded to IPFS for permanent storage
                            </p>
                        </div>

                        {/* Service Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Agent Name *
                            </label>
                            <input
                                type="text"
                                required
                                disabled={isSubmitting}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#111111] focus:border-transparent disabled:bg-gray-50"
                                placeholder="e.g., PerpAI Quote Agent"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Description *
                            </label>
                            <textarea
                                required
                                disabled={isSubmitting}
                                rows={4}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#111111] focus:border-transparent disabled:bg-gray-50"
                                placeholder="Describe what your agent does, its capabilities, and how it helps users..."
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>

                        {/* Service Type */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Service Type *
                            </label>
                            <select
                                required
                                disabled={isSubmitting}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#111111] focus:border-transparent disabled:bg-gray-50"
                                value={formData.serviceType}
                                onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
                            >
                                <option value="oracle">Oracle / Price Feed</option>
                                <option value="kyc">KYC / Identity</option>
                                <option value="data">Data Provider</option>
                                <option value="compute">Compute / AI</option>
                                <option value="storage">Storage</option>
                                <option value="dex">DEX / Trading</option>
                                <option value="trade">Trade Execution</option>
                            </select>
                        </div>

                        {/* Price */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Price per Request (USDC) *
                            </label>
                            <input
                                type="number"
                                required
                                disabled={isSubmitting}
                                step="0.01"
                                min="0"
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#111111] focus:border-transparent disabled:bg-gray-50"
                                placeholder="0.10"
                                value={formData.pricePerRequest}
                                onChange={(e) => setFormData({ ...formData, pricePerRequest: e.target.value })}
                            />
                        </div>

                        {/* Endpoint */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                API Endpoint *
                            </label>
                            <input
                                type="url"
                                required
                                disabled={isSubmitting}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#111111] focus:border-transparent disabled:bg-gray-50"
                                placeholder="https://api.youragent.com/v1/service"
                                value={formData.endpoint}
                                onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                This endpoint will receive x402 payment requests
                            </p>
                        </div>

                        {/* Info Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Card className="bg-blue-50 border-blue-200">
                                <CardContent className="p-4">
                                    <p className="text-sm text-blue-900">
                                        <strong>Step 1:</strong> Metadata uploaded to IPFS (permanent, decentralized)
                                    </p>
                                </CardContent>
                            </Card>
                            <Card className="bg-purple-50 border-purple-200">
                                <CardContent className="p-4">
                                    <p className="text-sm text-purple-900">
                                        <strong>Step 2:</strong> Agent NFT minted on Cronos IdentityRegistry
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Submit */}
                        <div className="flex gap-4">
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="bg-[#111111] text-white hover:bg-black"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {currentStep === 'ipfs' && 'Uploading to IPFS...'}
                                        {currentStep === 'chain' && 'Registering on-chain...'}
                                    </>
                                ) : (
                                    <>
                                        <Zap className="mr-2 h-4 w-4" />
                                        Register Agent On-Chain
                                    </>
                                )}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => navigate('/dashboard/agents')}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
