export default function DocsRegisterExample() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Register an Agent Example</h1>
        <p className="text-lg text-gray-600">
          Step-by-step guide to registering your AI agent on-chain.
        </p>
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Step 1: Prepare Agent Metadata</h2>
        <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
          <code className="text-sm text-gray-800">{`const agentMetadata = {
  name: "My Trading Agent",
  endpoint: "https://api.myagent.com",
  description: "AI-powered trading assistant",
  capabilities: ["trading", "market-analysis", "portfolio-management"]
};`}</code>
        </pre>
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Step 2: Connect to Identity Registry</h2>
        <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
          <code className="text-sm text-gray-800">{`import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider(
  'https://testnet-zkevm.cronos.org'
);

const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const identityRegistry = new ethers.Contract(
  process.env.IDENTITY_REGISTRY_ADDRESS,
  IdentityRegistryABI,
  signer
);`}</code>
        </pre>
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Step 3: Register Agent</h2>
        <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
          <code className="text-sm text-gray-800">{`async function registerAgent() {
  console.log('Registering agent...');
  
  const tx = await identityRegistry.registerAgent(
    agentMetadata.name,
    agentMetadata.endpoint
  );
  
  console.log('Transaction sent:', tx.hash);
  
  const receipt = await tx.wait();
  console.log('Transaction confirmed!');
  
  // Extract agent ID from event
  const event = receipt.logs.find(
    log => log.topics[0] === ethers.id('AgentRegistered(uint256,address,string,string)')
  );
  
  const agentId = ethers.toNumber(event.topics[1]);
  console.log('Agent registered with ID:', agentId);
  
  return agentId;
}

const agentId = await registerAgent();`}</code>
        </pre>
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Step 4: Verify Registration</h2>
        <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
          <code className="text-sm text-gray-800">{`async function verifyRegistration(agentId) {
  const metadata = await identityRegistry.getAgentMetadata(agentId);
  
  console.log('Agent Details:');
  console.log('- Name:', metadata.name);
  console.log('- Endpoint:', metadata.endpoint);
  console.log('- Owner:', metadata.owner);
  console.log('- Registered:', new Date(metadata.registeredAt * 1000));
  console.log('- Active:', metadata.active);
  
  return metadata;
}

await verifyRegistration(agentId);`}</code>
        </pre>
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Step 5: Update Agent Endpoint</h2>
        <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
          <code className="text-sm text-gray-800">{`async function updateEndpoint(agentId, newEndpoint) {
  const tx = await identityRegistry.updateEndpoint(
    agentId,
    newEndpoint
  );
  
  await tx.wait();
  console.log('Endpoint updated to:', newEndpoint);
}

await updateEndpoint(agentId, 'https://api-v2.myagent.com');`}</code>
        </pre>
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Complete Registration Script</h2>
        <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
          <code className="text-sm text-gray-800">{`import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  // Setup
  const provider = new ethers.JsonRpcProvider(
    'https://testnet-zkevm.cronos.org'
  );
  
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  
  const identityRegistry = new ethers.Contract(
    process.env.IDENTITY_REGISTRY_ADDRESS!,
    [
      'function registerAgent(string name, string endpoint) returns (uint256)',
      'function getAgentMetadata(uint256 tokenId) view returns (tuple(string name, string endpoint, address owner, uint256 registeredAt, bool active))',
      'event AgentRegistered(uint256 indexed tokenId, address indexed owner, string name, string endpoint)'
    ],
    signer
  );
  
  // Register
  console.log('Registering agent...');
  const tx = await identityRegistry.registerAgent(
    "My Trading Agent",
    "https://api.myagent.com"
  );
  
  const receipt = await tx.wait();
  
  // Get agent ID from event
  const iface = new ethers.Interface([
    'event AgentRegistered(uint256 indexed tokenId, address indexed owner, string name, string endpoint)'
  ]);
  
  const log = receipt.logs.find(
    (log: any) => {
      try {
        iface.parseLog(log);
        return true;
      } catch {
        return false;
      }
    }
  );
  
  const parsed = iface.parseLog(log!);
  const agentId = parsed!.args[0];
  
  console.log('[OK] Agent registered successfully!');
  console.log('Agent ID:', agentId.toString());
  console.log('Transaction:', receipt.hash);
  
  // Verify
  const metadata = await identityRegistry.getAgentMetadata(agentId);
  console.log('\\nAgent Details:');
  console.log('- Name:', metadata.name);
  console.log('- Endpoint:', metadata.endpoint);
  console.log('- Owner:', metadata.owner);
  
  // Save to .env
  console.log(\`\\nAdd to .env:\\nRELAY_CORE_AGENT_ID=\${agentId}\`);
}

main().catch(console.error);`}</code>
        </pre>
      </div>
    </div>
  );
}
