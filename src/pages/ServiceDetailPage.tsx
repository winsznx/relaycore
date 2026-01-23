import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ServiceDetails } from '@/components/ServiceDetails';
import { X, Zap, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppKitAccount } from '@reown/appkit/react';

interface ServiceDetail {
    id: string;
    name: string;
    description?: string;
    endpointUrl: string;
    pricePerCall?: string;
    ownerAddress: string;
}

/**
 * Service Detail Page
 *
 * Wrapper page that displays detailed service information
 * including metrics, schema, and graph data.
 */
export function ServiceDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { address, isConnected } = useAppKitAccount();

    const [showCallModal, setShowCallModal] = useState(false);
    const [selectedService, setSelectedService] = useState<ServiceDetail | null>(null);
    const [callStatus, setCallStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [callResult, setCallResult] = useState<any>(null);
    const [callError, setCallError] = useState<string | null>(null);
    const [inputPayload, setInputPayload] = useState('{}');
    const [useSession, setUseSession] = useState(true);
    const [sessionId, setSessionId] = useState('');

    if (!id) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-gray-500">Service ID not provided</p>
            </div>
        );
    }

    const handleCallService = async () => {
        if (!selectedService || !isConnected) return;

        setCallStatus('loading');
        setCallError(null);
        setCallResult(null);

        try {
            let payload: any;
            try {
                payload = JSON.parse(inputPayload);
            } catch {
                throw new Error('Invalid JSON payload');
            }

            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };

            // Use session-based payment if session ID provided
            if (useSession && sessionId) {
                headers['x-session-id'] = sessionId;
            }

            // Call the service endpoint
            const response = await fetch(`/api/services/${selectedService.id}/call`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    input: payload,
                    userAddress: address,
                }),
            });

            if (response.status === 402) {
                // Payment required - show payment modal
                const paymentInfo = await response.json();
                throw new Error(`Payment required: ${paymentInfo.message || 'Please use a session with funds or pay directly'}`);
            }

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || error.error || 'Service call failed');
            }

            const result = await response.json();
            setCallResult(result);
            setCallStatus('success');
        } catch (error) {
            setCallError(error instanceof Error ? error.message : 'Unknown error');
            setCallStatus('error');
        }
    };

    return (
        <>
            <ServiceDetails
                serviceId={id}
                onBack={() => navigate('/marketplace')}
                onCallService={(service) => {
                    setSelectedService(service);
                    setShowCallModal(true);
                    setCallStatus('idle');
                    setCallResult(null);
                    setCallError(null);
                }}
            />

            {/* Call Service Modal */}
            <AnimatePresence>
                {showCallModal && selectedService && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
                        >
                            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900">Call {selectedService.name}</h2>
                                    <p className="text-sm text-gray-500 mt-1">
                                        Price: ${parseFloat(selectedService.pricePerCall || '0').toFixed(4)} per call
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowCallModal(false)}
                                    className="p-2 hover:bg-gray-100 rounded-lg"
                                >
                                    <X className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>

                            <div className="p-6 flex-1 overflow-y-auto space-y-4">
                                {!isConnected ? (
                                    <div className="text-center py-8">
                                        <AlertCircle className="w-12 h-12 text-orange-500 mx-auto mb-4" />
                                        <p className="text-gray-700 mb-4">Please connect your wallet to call this service</p>
                                        <appkit-button />
                                    </div>
                                ) : callStatus === 'success' ? (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-green-600">
                                            <CheckCircle className="w-5 h-5" />
                                            <span className="font-medium">Service called successfully!</span>
                                        </div>
                                        <div className="bg-gray-50 rounded-lg p-4">
                                            <h4 className="text-sm font-medium text-gray-700 mb-2">Response:</h4>
                                            <pre className="text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap">
                                                {JSON.stringify(callResult, null, 2)}
                                            </pre>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setCallStatus('idle');
                                                setCallResult(null);
                                            }}
                                            className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                                        >
                                            Call Again
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        {/* Payment Method */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Payment Method
                                            </label>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setUseSession(true)}
                                                    className={`flex-1 py-2 px-4 rounded-lg border transition ${
                                                        useSession
                                                            ? 'bg-orange-50 border-orange-500 text-orange-700'
                                                            : 'border-gray-200 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    Session Budget
                                                </button>
                                                <button
                                                    onClick={() => setUseSession(false)}
                                                    className={`flex-1 py-2 px-4 rounded-lg border transition ${
                                                        !useSession
                                                            ? 'bg-orange-50 border-orange-500 text-orange-700'
                                                            : 'border-gray-200 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    Direct x402
                                                </button>
                                            </div>
                                        </div>

                                        {useSession && (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Session ID
                                                </label>
                                                <input
                                                    type="text"
                                                    value={sessionId}
                                                    onChange={(e) => setSessionId(e.target.value)}
                                                    placeholder="Enter your session ID"
                                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                                />
                                                <p className="text-xs text-gray-500 mt-1">
                                                    Get your session ID from the x402 Sessions page
                                                </p>
                                            </div>
                                        )}

                                        {/* Input Payload */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Input Payload (JSON)
                                            </label>
                                            <textarea
                                                value={inputPayload}
                                                onChange={(e) => setInputPayload(e.target.value)}
                                                rows={4}
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg font-mono text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                                placeholder='{"key": "value"}'
                                            />
                                        </div>

                                        {callStatus === 'error' && callError && (
                                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                                <div className="flex items-center gap-2 text-red-700">
                                                    <AlertCircle className="w-5 h-5" />
                                                    <span className="font-medium">Error</span>
                                                </div>
                                                <p className="text-sm text-red-600 mt-1">{callError}</p>
                                            </div>
                                        )}

                                        <button
                                            onClick={handleCallService}
                                            disabled={callStatus === 'loading' || (useSession && !sessionId)}
                                            className="w-full py-3 bg-[#111111] text-white rounded-lg hover:bg-[#333333] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                        >
                                            {callStatus === 'loading' ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Calling Service...
                                                </>
                                            ) : (
                                                <>
                                                    <Zap className="w-4 h-4" />
                                                    Call Service
                                                </>
                                            )}
                                        </button>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}

export default ServiceDetailPage;
