export default function DocsDeployment() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-4">Contract Deployment Guide</h1>
                <p className="text-lg text-gray-600">
                    Deploy ERC-8004 registries to Cronos zkEVM testnet and mainnet.
                </p>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Prerequisites</h2>
                <ul className="space-y-2 text-gray-700">
                    <li className="flex items-start gap-2">
                        <span className="text-gray-400">•</span>
                        <span>Node.js 18 or higher</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-gray-400">•</span>
                        <span>Hardhat or Foundry</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-gray-400">•</span>
                        <span>TCRO for gas fees (get from faucet)</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-gray-400">•</span>
                        <span>Private key with funds</span>
                    </li>
                </ul>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Setup Hardhat</h2>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npm install @openzeppelin/contracts

npx hardhat init`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Configure Network</h2>
                <p className="text-gray-700">Update hardhat.config.ts:</p>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  networks: {
    cronosZkevmTestnet: {
      url: "https://testnet-zkevm.cronos.org",
      chainId: 240,
      accounts: [process.env.PRIVATE_KEY!]
    },
    cronosZkevmMainnet: {
      url: "https://mainnet.zkevm.cronos.org",
      chainId: 388,
      accounts: [process.env.PRIVATE_KEY!]
    }
  }
};

export default config;`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Deployment Script</h2>
                <p className="text-gray-700">Create scripts/deploy.ts:</p>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`import { ethers } from "hardhat";

async function main() {
  console.log("Deploying contracts to Cronos zkEVM...");

  // Deploy Identity Registry
  const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
  const identityRegistry = await IdentityRegistry.deploy();
  await identityRegistry.waitForDeployment();
  console.log("IdentityRegistry deployed to:", await identityRegistry.getAddress());

  // Deploy Reputation Registry
  const ReputationRegistry = await ethers.getContractFactory("ReputationRegistry");
  const reputationRegistry = await ReputationRegistry.deploy();
  await reputationRegistry.waitForDeployment();
  console.log("ReputationRegistry deployed to:", await reputationRegistry.getAddress());

  // Deploy Validation Registry
  const ValidationRegistry = await ethers.getContractFactory("ValidationRegistry");
  const validationRegistry = await ValidationRegistry.deploy();
  await validationRegistry.waitForDeployment();
  console.log("ValidationRegistry deployed to:", await validationRegistry.getAddress());

  // Save addresses to .env
  console.log(\`
Add these to your .env file:
IDENTITY_REGISTRY_ADDRESS=\${await identityRegistry.getAddress()}
REPUTATION_REGISTRY_ADDRESS=\${await reputationRegistry.getAddress()}
VALIDATION_REGISTRY_ADDRESS=\${await validationRegistry.getAddress()}
  \`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Deploy to Testnet</h2>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`# Set private key
export PRIVATE_KEY="your_private_key_here"

# Deploy
npx hardhat run scripts/deploy.ts --network cronosZkevmTestnet

# Verify contracts (optional)
npx hardhat verify --network cronosZkevmTestnet DEPLOYED_ADDRESS`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Get Testnet Funds</h2>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-sm text-gray-700 mb-2">Cronos zkEVM Testnet Faucet:</p>
                    <a
                        href="https://faucet.cronos.org"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline"
                    >
                        https://faucet.cronos.org
                    </a>
                </div>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Verify Deployment</h2>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider(
  'https://testnet-zkevm.cronos.org'
);

// Check Identity Registry
const identityRegistry = new ethers.Contract(
  IDENTITY_REGISTRY_ADDRESS,
  IdentityRegistryABI,
  provider
);

const totalAgents = await identityRegistry.totalAgents();
console.log('Total agents:', totalAgents.toString());

// Register test agent
const signer = new ethers.Wallet(privateKey, provider);
const tx = await identityRegistry.connect(signer).registerAgent(
  "Test Agent",
  "https://test.example.com"
);

await tx.wait();
console.log('Test agent registered successfully!');`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Production Checklist</h2>
                <ul className="space-y-3 text-gray-700">
                    <li className="flex items-start gap-3">
                        <span className="text-green-600">[Y]</span>
                        <span>Test all contract functions on testnet</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="text-green-600">[Y]</span>
                        <span>Verify contract source code on block explorer</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="text-green-600">[Y]</span>
                        <span>Set up monitoring for contract events</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="text-green-600">[Y]</span>
                        <span>Configure authorized validators</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="text-green-600">[Y]</span>
                        <span>Update frontend with contract addresses</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="text-green-600">[Y]</span>
                        <span>Deploy to mainnet with sufficient gas</span>
                    </li>
                </ul>
            </div>
        </div>
    );
}
