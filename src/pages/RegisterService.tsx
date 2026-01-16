import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import { useRegisterService } from '@/lib/hooks';
import { useAccount } from 'wagmi';
import { zauthClient } from '@/services/zauth/zauth-client';

/**
 * Service Registration Page
 * 
 * Allows service providers to register their APIs/services
 * Features:
 * - Endpoint validation
 * - ZAUTH verification
 * - Category selection
 * - Pricing configuration
 */

const CATEGORIES = [
    { value: 'kyc', label: 'KYC/Identity Verification' },
    { value: 'oracle', label: 'Price Oracle' },
    { value: 'data', label: 'Data API' },
    { value: 'compute', label: 'Compute Service' },
    { value: 'storage', label: 'Storage Service' },
    { value: 'ai', label: 'AI/ML Service' },
    { value: 'other', label: 'Other' },
];

export function RegisterService() {
    const navigate = useNavigate();
    const { address, isConnected } = useAccount();
    const { mutate: registerService, isLoading: isRegistering } = useRegisterService();

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        category: '',
        endpointUrl: '',
        pricePerCall: '',
    });

    const [endpointStatus, setEndpointStatus] = useState<{
        checking: boolean;
        verified: boolean;
        message: string;
    } | null>(null);

    const [registrationStatus, setRegistrationStatus] = useState<{
        success: boolean;
        message: string;
    } | null>(null);

    // Validate endpoint with ZAUTH
    const validateEndpoint = async () => {
        if (!formData.endpointUrl) {
            setEndpointStatus({
                checking: false,
                verified: false,
                message: 'Please enter an endpoint URL',
            });
            return;
        }

        setEndpointStatus({ checking: true, verified: false, message: 'Checking endpoint...' });

        try {
            // Check if URL is valid
            new URL(formData.endpointUrl);

            // Check ZAUTH status
            const result = await zauthClient.isEndpointReliable(formData.endpointUrl);

            if (result.reliable) {
                setEndpointStatus({
                    checking: false,
                    verified: true,
                    message: `Endpoint verified! Success rate: ${result.endpoint?.successRate}%`,
                });
            } else {
                setEndpointStatus({
                    checking: false,
                    verified: false,
                    message: `${result.reason || 'Endpoint not verified'}`,
                });
            }
        } catch (error: any) {
            setEndpointStatus({
                checking: false,
                verified: false,
                message: `Invalid URL or verification failed: ${error.message}`,
            });
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!isConnected || !address) {
            setRegistrationStatus({
                success: false,
                message: 'Please connect your wallet first',
            });
            return;
        }

        if (!formData.name || !formData.category) {
            setRegistrationStatus({
                success: false,
                message: 'Please fill in all required fields',
            });
            return;
        }

        try {
            await registerService({
                name: formData.name,
                description: formData.description,
                category: formData.category,
                owner_address: address,
                endpoint_url: formData.endpointUrl || undefined,
                price_per_call: formData.pricePerCall ? parseFloat(formData.pricePerCall) : undefined,
            });

            setRegistrationStatus({
                success: true,
                message: 'Service registered successfully! Redirecting to discovery page...',
            });

            // Redirect after 2 seconds
            setTimeout(() => {
                navigate('/services');
            }, 2000);
        } catch (error: any) {
            setRegistrationStatus({
                success: false,
                message: `Registration failed: ${error.message}`,
            });
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-[#111111]">Register Your Service</h1>
                <p className="text-gray-500 mt-1">
                    Make your API discoverable to AI agents and earn from x402 payments
                </p>
            </div>

            {/* Wallet Connection Alert */}
            {!isConnected && (
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        Please connect your wallet to register a service
                    </AlertDescription>
                </Alert>
            )}

            {/* Registration Form */}
            <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                <CardHeader>
                    <CardTitle>Service Details</CardTitle>
                    <CardDescription>
                        Provide information about your service. Fields marked with * are required.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Service Name */}
                        <div className="space-y-2">
                            <Label htmlFor="name">Service Name *</Label>
                            <Input
                                id="name"
                                placeholder="e.g., KYC Verification API"
                                value={formData.name}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                placeholder="Describe what your service does and its key features..."
                                value={formData.description}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, description: e.target.value })}
                                rows={4}
                            />
                        </div>

                        {/* Category */}
                        <div className="space-y-2">
                            <Label htmlFor="category">Category *</Label>
                            <Select
                                value={formData.category}
                                onValueChange={(value: string) => setFormData({ ...formData, category: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {CATEGORIES.map((cat) => (
                                        <SelectItem key={cat.value} value={cat.value}>
                                            {cat.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Endpoint URL */}
                        <div className="space-y-2">
                            <Label htmlFor="endpointUrl">Endpoint URL</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="endpointUrl"
                                    type="url"
                                    placeholder="https://api.yourservice.com/v1"
                                    value={formData.endpointUrl}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, endpointUrl: e.target.value })}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={validateEndpoint}
                                    disabled={!formData.endpointUrl || endpointStatus?.checking}
                                >
                                    {endpointStatus?.checking ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        'Verify'
                                    )}
                                </Button>
                            </div>
                            {endpointStatus && (
                                <Alert variant={endpointStatus.verified ? 'default' : 'destructive'}>
                                    {endpointStatus.verified ? (
                                        <CheckCircle2 className="h-4 w-4" />
                                    ) : (
                                        <AlertCircle className="h-4 w-4" />
                                    )}
                                    <AlertDescription>{endpointStatus.message}</AlertDescription>
                                </Alert>
                            )}
                            <p className="text-xs">
                                Optional. We'll verify your endpoint with ZAUTH for reliability.
                            </p>
                        </div>

                        {/* Price Per Call */}
                        <div className="space-y-2">
                            <Label htmlFor="pricePerCall">Price Per Call (USDC)</Label>
                            <Input
                                id="pricePerCall"
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.10"
                                value={formData.pricePerCall}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, pricePerCall: e.target.value })}
                            />
                            <p className="text-xs">
                                Optional. Set your pricing for x402 payments.
                            </p>
                        </div>

                        {/* Registration Status */}
                        {registrationStatus && (
                            <Alert variant={registrationStatus.success ? 'default' : 'destructive'}>
                                {registrationStatus.success ? (
                                    <CheckCircle2 className="h-4 w-4" />
                                ) : (
                                    <AlertCircle className="h-4 w-4" />
                                )}
                                <AlertDescription>{registrationStatus.message}</AlertDescription>
                            </Alert>
                        )}

                        {/* Submit Button */}
                        <div className="flex gap-4">
                            <Button
                                type="submit"
                                className="flex-1 bg-[#111111] hover:bg-[#333333]"
                                disabled={!isConnected || isRegistering}
                            >
                                {isRegistering ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Registering...
                                    </>
                                ) : (
                                    'Register Service'
                                )}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => navigate('/services')}
                            >
                                Cancel
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {/* Info Card */}
            <Card className="border-0 shadow-sm ring-1 ring-gray-100 bg-blue-50">
                <CardContent className="p-6">
                    <h3 className="font-semibold text-[#111111] mb-2">How it works</h3>
                    <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-100">
                        <li className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                            <span>Register your service with endpoint and pricing</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                            <span>AI agents discover your service via GraphQL API</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                            <span>Agents pay via x402 and call your endpoint</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                            <span>Your reputation builds automatically based on outcomes</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                            <span>Higher reputation = more discovery = more revenue</span>
                        </li>
                    </ul>
                    <div className="mt-4 pt-4 border-t border-blue-200">
                        <a
                            href="https://github.com/cronos-labs/x402-examples"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                        >
                            <ExternalLink className="h-4 w-4" />
                            View x402 integration examples
                        </a>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default RegisterService;
