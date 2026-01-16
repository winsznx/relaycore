export default function DocsX402Guide() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-4">x402 Payments Guide</h1>
                <p className="text-lg text-gray-600">
                    Implementing HTTP 402 Payment Required protocol in your application.
                </p>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">What is x402?</h2>
                <p className="text-gray-700">
                    HTTP 402 Payment Required is a standard status code that enables pay-per-use API endpoints.
                    Cronos x402 extends this with blockchain-based payments and gasless execution.
                </p>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Server Implementation</h2>
                <p className="text-gray-700">Create middleware to protect your endpoints:</p>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`import type { Request, Response, NextFunction } from 'express';

export function x402PaymentMiddleware(
  amountUSDC: string,
  network: 'testnet' | 'mainnet'
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const paymentHeader = req.headers['x-payment'];
    
    if (!paymentHeader) {
      // Return 402 with payment requirements
      return res.status(402).json({
        scheme: 'exact',
        network: network === 'testnet' ? 'cronos-testnet' : 'cronos',
        payTo: process.env.PAYMENT_RECIPIENT_ADDRESS,
        asset: network === 'testnet' 
          ? '0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0'
          : '0xf951eC28187D9E5Ca673Da8FE6757E6f0Be5F77C',
        maxAmountRequired: amountUSDC,
        maxTimeoutSeconds: 300
      });
    }
    
    // Verify payment with facilitator
    const isValid = await verifyPayment(paymentHeader);
    if (!isValid) {
      return res.status(402).json({ error: 'Invalid payment' });
    }
    
    next();
  };
}`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Client Implementation</h2>
                <p className="text-gray-700">Handle 402 responses automatically:</p>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`async function fetchWithPayment(url: string, options: RequestInit) {
  const response = await fetch(url, options);
  
  if (response.status === 402) {
    const requirements = await response.json();
    
    // Sign payment authorization
    const payment = await signPaymentAuthorization(requirements);
    
    // Submit to facilitator
    const proof = await submitToFacilitator(payment);
    
    // Retry with payment proof
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'X-Payment': proof
      }
    });
  }
  
  return response;
}`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Payment Verification</h2>
                <p className="text-gray-700">Verify payments with the Cronos Facilitator:</p>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`async function verifyPayment(paymentProof: string): Promise<boolean> {
  const facilitatorUrl = 'https://facilitator.cronoslabs.org/v2/x402';
  
  const response = await fetch(\`\${facilitatorUrl}/verify\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ proof: paymentProof })
  });
  
  const result = await response.json();
  return result.valid === true;
}`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Configuration</h2>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-sm text-gray-700 mb-3">Environment variables needed:</p>
                    <pre className="bg-white border border-gray-200 rounded p-3 text-xs">
                        <code>{`PAYMENT_RECIPIENT_ADDRESS=0xYourWalletAddress
CRONOS_NETWORK=testnet
X402_FACILITATOR_URL=https://facilitator.cronoslabs.org/v2/x402`}</code>
                    </pre>
                </div>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Best Practices</h2>
                <ul className="space-y-3 text-gray-700">
                    <li className="flex items-start gap-3">
                        <span className="text-gray-400">•</span>
                        <span>Set appropriate timeout values (300 seconds recommended)</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="text-gray-400">•</span>
                        <span>Use exact payment scheme for predictable costs</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="text-gray-400">•</span>
                        <span>Always verify payments server-side before processing requests</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="text-gray-400">•</span>
                        <span>Cache payment proofs to avoid repeated authorizations</span>
                    </li>
                </ul>
            </div>
        </div>
    );
}
