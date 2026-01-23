import { useState } from 'react';
import { X, Wallet, Clock, AlertTriangle, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAppKitAccount, useAppKitProvider } from '@reown/appkit/react';
import { BrowserProvider, Contract, ethers } from 'ethers';

interface CreateSessionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const USDC_ADDRESS = import.meta.env.VITE_USDC_ADDRESS || '0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0';
const CHAIN_ID = import.meta.env.VITE_CHAIN_ID || 338; // Cronos Testnet

// Extended USDC ABI with EIP-3009 methods
const USDC_ABI = [
    'function approve(address spender, uint256 amount) returns (bool)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'function balanceOf(address account) view returns (uint256)',
    'function nonces(address owner) view returns (uint256)',
    'function DOMAIN_SEPARATOR() view returns (bytes32)',
    'function name() view returns (string)',
    'function version() view returns (string)'
];

// EIP-3009 TransferWithAuthorization type hash
const TRANSFER_WITH_AUTHORIZATION_TYPEHASH = ethers.keccak256(
    ethers.toUtf8Bytes('TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)')
);

export function CreateSessionModal({ isOpen, onClose, onSuccess }: CreateSessionModalProps) {
    const { address } = useAppKitAccount();
    const { walletProvider } = useAppKitProvider('eip155');
    const [maxSpend, setMaxSpend] = useState('');
    const [duration, setDuration] = useState('7');
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<'form' | 'payment' | 'activating'>('form');
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [paymentRequest, setPaymentRequest] = useState<any>(null);

    const handleCreateSession = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!address) {
            alert('Please connect your wallet first');
            return;
        }

        setLoading(true);
        try {
            // Step 1: Create session (pending_payment status)
            const apiUrl = import.meta.env.VITE_API_URL || 'https://api.relaycore.xyz';
            const response = await fetch(`${apiUrl}/api/sessions/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ownerAddress: address,
                    maxSpend: parseFloat(maxSpend),
                    durationHours: parseInt(duration) * 24,
                    authorizedAgents: []
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to create session');
            }

            const result = await response.json();
            setSessionId(result.session.session_id);
            setPaymentRequest(result.paymentRequest);
            setStep('payment');
            setLoading(false);
        } catch (err) {
            console.error('Session creation failed:', err);
            alert(`Failed to create session: ${err instanceof Error ? err.message : 'Unknown error'}`);
            setLoading(false);
        }
    };

    /**
     * Sign EIP-3009 TransferWithAuthorization (gasless payment)
     */
    const signEIP3009Authorization = async (
        signer: ethers.Signer,
        usdcContract: Contract,
        to: string,
        value: bigint
    ): Promise<{ signature: string; nonce: string; validAfter: number; validBefore: number }> => {
        const from = await signer.getAddress();
        const validAfter = 0;
        const validBefore = Math.floor(Date.now() / 1000) + 3600; // 1 hour validity
        const nonce = ethers.hexlify(ethers.randomBytes(32));

        // Get domain separator from contract or construct it
        let domainSeparator: string;
        try {
            domainSeparator = await usdcContract.DOMAIN_SEPARATOR();
        } catch {
            // Construct domain separator if not available
            const name = await usdcContract.name().catch(() => 'USD Coin');
            const version = await usdcContract.version().catch(() => '1');
            domainSeparator = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
                    [
                        ethers.keccak256(ethers.toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')),
                        ethers.keccak256(ethers.toUtf8Bytes(name)),
                        ethers.keccak256(ethers.toUtf8Bytes(version)),
                        CHAIN_ID,
                        USDC_ADDRESS
                    ]
                )
            );
        }

        // Construct the struct hash
        const structHash = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
                ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256', 'bytes32'],
                [TRANSFER_WITH_AUTHORIZATION_TYPEHASH, from, to, value, validAfter, validBefore, nonce]
            )
        );

        // Construct the digest
        const digest = ethers.keccak256(
            ethers.concat([
                ethers.toUtf8Bytes('\x19\x01'),
                domainSeparator,
                structHash
            ])
        );

        // Sign the digest
        const signature = await signer.signMessage(ethers.getBytes(digest));

        return { signature, nonce, validAfter, validBefore };
    };

    const handlePayment = async () => {
        if (!walletProvider || !paymentRequest || !sessionId) return;

        setLoading(true);
        try {
            const provider = new BrowserProvider(walletProvider);
            const signer = await provider.getSigner();
            const usdcContract = new Contract(USDC_ADDRESS, USDC_ABI, signer);

            // Check balance
            const balance = await usdcContract.balanceOf(address);
            const requiredAmount = BigInt(Math.floor(parseFloat(paymentRequest.amount) * 1e6));

            if (balance < requiredAmount) {
                throw new Error(`Insufficient USDC balance. Need ${paymentRequest.amount} USDC`);
            }

            // Check if x402 payment requirements are available (EIP-3009 gasless flow)
            const hasX402Requirements = paymentRequest.paymentRequirements || paymentRequest.x402PaymentRequirements;

            let txHash: string;

            if (hasX402Requirements) {
                // ===== GASLESS x402/EIP-3009 FLOW =====
                console.log('Using gasless x402/EIP-3009 payment flow');
                setStep('activating');

                try {
                    // Sign EIP-3009 authorization (no gas required from user!)
                    const authData = await signEIP3009Authorization(
                        signer,
                        usdcContract,
                        paymentRequest.payTo,
                        requiredAmount
                    );

                    // Send signed authorization to backend for Facilitator settlement
                    const apiUrl = import.meta.env.VITE_API_URL || 'https://api.relaycore.xyz';
                    const settleResponse = await fetch(`${apiUrl}/api/sessions/${sessionId}/settle-x402`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            from: address,
                            to: paymentRequest.payTo,
                            value: requiredAmount.toString(),
                            validAfter: authData.validAfter,
                            validBefore: authData.validBefore,
                            nonce: authData.nonce,
                            signature: authData.signature,
                            amount: paymentRequest.amount
                        })
                    });

                    if (!settleResponse.ok) {
                        const error = await settleResponse.json();
                        throw new Error(error.message || 'Facilitator settlement failed');
                    }

                    const settleResult = await settleResponse.json();
                    txHash = settleResult.txHash;

                    console.log('x402 payment settled via Facilitator', { txHash });

                } catch (x402Error) {
                    console.warn('x402 flow failed, falling back to direct transfer:', x402Error);
                    // Fall back to direct transfer if x402 fails
                    const tx = await usdcContract.transfer(paymentRequest.payTo, requiredAmount);
                    const receipt = await tx.wait();
                    txHash = receipt.hash;
                }
            } else {
                // ===== FALLBACK: Direct transfer (user pays gas) =====
                console.log('Using direct transfer flow (user pays gas)');
                const tx = await usdcContract.transfer(paymentRequest.payTo, requiredAmount);
                setStep('activating');
                const receipt = await tx.wait();
                txHash = receipt.hash;
            }

            // Activate session with transaction hash
            const apiUrl = import.meta.env.VITE_API_URL || 'https://api.relaycore.xyz';
            const activateResponse = await fetch(`${apiUrl}/api/sessions/${sessionId}/activate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    txHash,
                    amount: paymentRequest.amount
                })
            });

            if (!activateResponse.ok) {
                const error = await activateResponse.json();
                throw new Error(error.message || 'Failed to activate session');
            }

            alert(`Session activated successfully! Session ID: ${sessionId}`);
            onSuccess();
            onClose();

            // Reset form
            setMaxSpend('');
            setDuration('7');
            setStep('form');
            setSessionId(null);
            setPaymentRequest(null);
        } catch (err) {
            console.error('Payment failed:', err);
            alert(`Payment failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
            setStep('payment'); // Go back to payment step on error
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
            >
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Create x402 Session</h2>
                        <p className="text-sm text-gray-500 mt-1">
                            {step === 'form' && 'Set up a gasless payment session'}
                            {step === 'payment' && 'Pay to activate session'}
                            {step === 'activating' && 'Activating session...'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg" disabled={loading}>
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {step === 'form' && (
                    <form onSubmit={handleCreateSession} className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Wallet Address
                            </label>
                            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                                <Wallet className="w-4 h-4 text-gray-400" />
                                <span className="font-mono text-sm text-gray-600">
                                    {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected'}
                                </span>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Max Spend (USDC)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={maxSpend}
                                onChange={(e) => setMaxSpend(e.target.value)}
                                placeholder="10.00"
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Duration (Days)
                            </label>
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-gray-400" />
                                <select
                                    value={duration}
                                    onChange={(e) => setDuration(e.target.value)}
                                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                >
                                    <option value="1">1 Day</option>
                                    <option value="7">7 Days</option>
                                    <option value="30">30 Days</option>
                                    <option value="90">90 Days</option>
                                </select>
                            </div>
                        </div>

                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                            <h4 className="font-semibold text-orange-900 text-sm mb-2">Payment Required</h4>
                            <p className="text-xs text-orange-800">
                                You'll need to pay {maxSpend || '0'} USDC to Relay to activate this session. This amount will be held in escrow and used to pay agents on your behalf.
                            </p>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading || !address || !maxSpend}
                                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Creating...' : 'Continue to Payment'}
                            </button>
                        </div>
                    </form>
                )}

                {step === 'payment' && paymentRequest && (
                    <div className="p-6 space-y-4">
                        {/* x402 Gasless Badge */}
                        {(paymentRequest.paymentRequirements || paymentRequest.x402PaymentRequirements) && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                <div className="flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-green-600" />
                                    <span className="text-sm font-semibold text-green-800">Gasless Payment (x402/EIP-3009)</span>
                                </div>
                                <p className="text-xs text-green-700 mt-1">
                                    You only need to sign a message - no gas fees required! The Facilitator will settle your payment on-chain.
                                </p>
                            </div>
                        )}

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <h4 className="font-semibold text-blue-900 text-sm mb-2">Payment Details</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-blue-700">Amount:</span>
                                    <span className="font-semibold text-blue-900">{paymentRequest.amount} USDC</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-blue-700">Pay To:</span>
                                    <span className="font-mono text-xs text-blue-900">
                                        {paymentRequest.payTo.slice(0, 6)}...{paymentRequest.payTo.slice(-4)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-blue-700">Session ID:</span>
                                    <span className="font-semibold text-blue-900">#{sessionId}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-blue-700">Method:</span>
                                    <span className="font-semibold text-blue-900">
                                        {(paymentRequest.paymentRequirements || paymentRequest.x402PaymentRequirements) ? 'x402 (Gasless)' : 'Direct Transfer'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
                                <p className="text-xs text-yellow-800">
                                    {(paymentRequest.paymentRequirements || paymentRequest.x402PaymentRequirements)
                                        ? 'You will be asked to sign a message. This authorizes the transfer without requiring you to pay gas fees.'
                                        : 'Make sure you have enough USDC and CRO for gas in your wallet.'}
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button
                                type="button"
                                onClick={() => {
                                    setStep('form');
                                    setSessionId(null);
                                    setPaymentRequest(null);
                                }}
                                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                                disabled={loading}
                            >
                                Back
                            </button>
                            <button
                                onClick={handlePayment}
                                disabled={loading}
                                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {(paymentRequest.paymentRequirements || paymentRequest.x402PaymentRequirements) && <Zap className="w-4 h-4" />}
                                {loading ? 'Processing...' : (paymentRequest.paymentRequirements || paymentRequest.x402PaymentRequirements) ? 'Sign & Activate' : 'Pay & Activate'}
                            </button>
                        </div>
                    </div>
                )}

                {step === 'activating' && (
                    <div className="p-6">
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
                            <p className="text-gray-700 font-medium">Verifying payment on-chain...</p>
                            <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
}
