export default function DocsEIP3009Guide() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-4">EIP-3009 Guide</h1>
                <p className="text-lg text-gray-600">
                    Implementing gasless token transfers with transferWithAuthorization.
                </p>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">What is EIP-3009?</h2>
                <p className="text-gray-700">
                    EIP-3009 enables token transfers to be initiated by signing a message instead of sending a transaction.
                    This allows a third party (the facilitator) to pay the gas fee while you authorize the transfer.
                </p>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Authorization Structure</h2>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`interface TransferAuthorization {
  from: string;        // Your wallet address
  to: string;          // Recipient address
  value: bigint;       // Amount in smallest unit (e.g., 1 USDC = 1000000)
  validAfter: number;  // Unix timestamp (0 for immediate)
  validBefore: number; // Unix timestamp (expiry)
  nonce: string;       // Random 32-byte hex string
}`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Signing the Authorization</h2>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`import { ethers } from 'ethers';

async function signTransferAuthorization(
  signer: ethers.Signer,
  tokenAddress: string,
  authorization: TransferAuthorization
) {
  const domain = {
    name: 'USD Coin',
    version: '2',
    chainId: 338, // Cronos testnet
    verifyingContract: tokenAddress
  };

  const types = {
    TransferWithAuthorization: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' }
    ]
  };

  const signature = await signer.signTypedData(
    domain,
    types,
    authorization
  );

  return signature;
}`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Submitting to Facilitator</h2>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`async function submitToFacilitator(
  authorization: TransferAuthorization,
  signature: string
) {
  const response = await fetch(
    'https://facilitator.cronoslabs.org/v2/x402/execute',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        authorization,
        signature,
        network: 'cronos-testnet'
      })
    }
  );

  const result = await response.json();
  return result.txHash; // Transaction hash
}`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Complete Example</h2>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`import { ethers } from 'ethers';

async function executeGaslessPayment(
  signer: ethers.Signer,
  recipientAddress: string,
  amountUSDC: string
) {
  // 1. Generate random nonce
  const nonce = ethers.hexlify(ethers.randomBytes(32));
  
  // 2. Create authorization
  const authorization = {
    from: await signer.getAddress(),
    to: recipientAddress,
    value: ethers.parseUnits(amountUSDC, 6), // USDC has 6 decimals
    validAfter: 0,
    validBefore: Math.floor(Date.now() / 1000) + 300, // 5 min expiry
    nonce
  };
  
  // 3. Sign authorization
  const signature = await signTransferAuthorization(
    signer,
    '0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0', // USDC.e testnet
    authorization
  );
  
  // 4. Submit to facilitator
  const txHash = await submitToFacilitator(authorization, signature);
  
  console.log('Payment executed:', txHash);
  return txHash;
}`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Security Considerations</h2>
                <ul className="space-y-3 text-gray-700">
                    <li className="flex items-start gap-3">
                        <span className="text-gray-400">•</span>
                        <span><strong>Nonce Uniqueness:</strong> Always use a random nonce to prevent replay attacks</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="text-gray-400">•</span>
                        <span><strong>Expiry Time:</strong> Set reasonable validBefore to limit authorization window</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="text-gray-400">•</span>
                        <span><strong>Amount Verification:</strong> Always verify the exact amount before signing</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="text-gray-400">•</span>
                        <span><strong>Recipient Check:</strong> Confirm recipient address is correct</span>
                    </li>
                </ul>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Supported Tokens</h2>
                <div className="space-y-4">
                    <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-2">USDC.e (Testnet)</h3>
                        <p className="text-sm text-gray-600">0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0</p>
                    </div>
                    <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-2">USDC.e (Mainnet)</h3>
                        <p className="text-sm text-gray-600">0xf951eC28187D9E5Ca673Da8FE6757E6f0Be5F77C</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
