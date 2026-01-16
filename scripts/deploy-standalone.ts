/**
 * Relay Core - Standalone Contract Deployment Script
 * 
 * Deploys the three registry contracts to Cronos Testnet (338)
 * Uses ethers directly without hardhat run
 * 
 * Usage:
 *   npx tsx scripts/deploy-standalone.ts
 */

import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

// Cronos Testnet RPCs (with fallbacks)
const RPC_URLS = [
    'https://evm-t3.cronos.org',
    'https://cronos-testnet-3.crypto.org:8545'
];
const CHAIN_ID = 338;

async function getProvider(): Promise<ethers.JsonRpcProvider> {
    for (const rpc of RPC_URLS) {
        try {
            const provider = new ethers.JsonRpcProvider(rpc);
            await provider.getBlockNumber(); // Test connection
            console.log("Using RPC:", rpc);
            return provider;
        } catch (e) {
            console.log("RPC failed, trying next:", rpc);
        }
    }
    throw new Error("All RPC endpoints failed");
}

async function main() {
    // Setup provider and wallet
    const provider = await getProvider();
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY;

    if (!privateKey) {
        console.error('[ERROR] DEPLOYER_PRIVATE_KEY not set in .env');
        process.exit(1);
    }

    const deployer = new ethers.Wallet(privateKey, provider);

    console.log("=".repeat(60));
    console.log("RELAY CORE - CONTRACT DEPLOYMENT");
    console.log("=".repeat(60));
    console.log("\nNetwork: Cronos Testnet (Chain ID:", CHAIN_ID, ")");
    console.log("Deploying with account:", deployer.address);

    const balance = await provider.getBalance(deployer.address);
    console.log("Account balance:", ethers.formatEther(balance), "CRO");

    if (balance === 0n) {
        console.error("\n[ERROR] Deployer has no balance!");
        console.error("Get test CRO from: https://cronos.org/faucet");
        process.exit(1);
    }

    // Load compiled artifacts
    const currentFile = new URL(import.meta.url).pathname;
    const scriptsDir = path.dirname(currentFile);
    const artifactsDir = path.join(scriptsDir, '..', 'artifacts', 'contracts');

    const loadArtifact = (name: string) => {
        const artifactPath = path.join(artifactsDir, `${name}.sol`, `${name}.json`);
        if (!fs.existsSync(artifactPath)) {
            console.error(`[ERROR] Artifact not found: ${artifactPath}`);
            console.error('Run: pnpm compile');
            process.exit(1);
        }
        return JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    };

    const deployedContracts: Record<string, string> = {};

    // 1. Deploy IdentityRegistry
    console.log("\n[DEPLOY] Deploying IdentityRegistry...");
    const identityArtifact = loadArtifact('IdentityRegistry');
    const IdentityFactory = new ethers.ContractFactory(
        identityArtifact.abi,
        identityArtifact.bytecode,
        deployer
    );
    const identityRegistry = await IdentityFactory.deploy();
    await identityRegistry.waitForDeployment();
    const identityAddress = await identityRegistry.getAddress();
    deployedContracts["IdentityRegistry"] = identityAddress;
    console.log("   [OK] IdentityRegistry deployed to:", identityAddress);

    // 2. Deploy ReputationRegistry (linked to IdentityRegistry)
    console.log("\n[DEPLOY] Deploying ReputationRegistry...");
    const reputationArtifact = loadArtifact('ReputationRegistry');
    const ReputationFactory = new ethers.ContractFactory(
        reputationArtifact.abi,
        reputationArtifact.bytecode,
        deployer
    );
    const reputationRegistry = await ReputationFactory.deploy(identityAddress);
    await reputationRegistry.waitForDeployment();
    const reputationAddress = await reputationRegistry.getAddress();
    deployedContracts["ReputationRegistry"] = reputationAddress;
    console.log("   [OK] ReputationRegistry deployed to:", reputationAddress);
    console.log("      Linked to IdentityRegistry:", identityAddress);

    // 3. Deploy ValidationRegistry (also linked to IdentityRegistry)
    console.log("\n[DEPLOY] Deploying ValidationRegistry...");
    const validationArtifact = loadArtifact('ValidationRegistry');
    const ValidationFactory = new ethers.ContractFactory(
        validationArtifact.abi,
        validationArtifact.bytecode,
        deployer
    );
    const validationRegistry = await ValidationFactory.deploy(identityAddress);
    await validationRegistry.waitForDeployment();
    const validationAddress = await validationRegistry.getAddress();
    deployedContracts["ValidationRegistry"] = validationAddress;
    console.log("   [OK] ValidationRegistry deployed to:", validationAddress);
    console.log("      Linked to IdentityRegistry:", identityAddress);

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("DEPLOYMENT COMPLETE!");
    console.log("=".repeat(60));
    console.log("\nDeployed Contract Addresses:");
    console.log("-".repeat(40));
    for (const [name, address] of Object.entries(deployedContracts)) {
        console.log(`  ${name}: ${address}`);
    }

    // Generate .env update
    console.log("\n[ENV] Add these to your .env file:");
    console.log("-".repeat(40));
    console.log(`IDENTITY_REGISTRY_ADDRESS=${deployedContracts["IdentityRegistry"]}`);
    console.log(`REPUTATION_REGISTRY_ADDRESS=${deployedContracts["ReputationRegistry"]}`);
    console.log(`VALIDATION_REGISTRY_ADDRESS=${deployedContracts["ValidationRegistry"]}`);

    // Explorer links
    console.log("\n[EXPLORER] View on Cronos Testnet Explorer:");
    console.log("-".repeat(40));
    console.log(`IdentityRegistry: https://explorer.cronos.org/testnet/address/${identityAddress}`);
    console.log(`ReputationRegistry: https://explorer.cronos.org/testnet/address/${reputationAddress}`);
    console.log(`ValidationRegistry: https://explorer.cronos.org/testnet/address/${validationAddress}`);

    console.log("\n[OK] Deployment completed successfully!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Deployment failed:', error);
        process.exit(1);
    });
