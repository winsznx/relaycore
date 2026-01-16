/**
 * Register Relay Core Agent - Standalone Script
 * 
 * Registers the main Relay Core agent on IdentityRegistry
 * by minting an NFT with metadata.
 * 
 * Usage:
 *   NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/register-agent.ts
 */

import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const IDENTITY_REGISTRY = process.env.IDENTITY_REGISTRY_ADDRESS || '0x4b697D8ABC0e3dA0086011222755d9029DBB9C43';

// Agent metadata - PerpAI Quote Agent
const AGENT_METADATA = {
    name: "PerpAI Quote",
    description: "AI-powered perpetuals trading quote aggregator for Cronos DEXes",
    version: "1.0.0",
    agent_type: "trading",
    capabilities: ["quote", "venue_ranking", "funding_rates"],
    pricing: {
        quote: "5000", // 0.005 USDC
        trade: "50000" // 0.05 USDC
    },
    endpoints: {
        quote: "/api/agents/relaycore.perp-ai-quote/invoke",
        trade: "/api/agents/relaycore.perp-ai-trade/invoke"
    }
};

// For now, use a data URI. In production, upload to IPFS
const AGENT_URI = `data:application/json,${encodeURIComponent(JSON.stringify(AGENT_METADATA))}`;

async function main() {
    const provider = new ethers.JsonRpcProvider('https://evm-t3.cronos.org');
    const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider);

    console.log("=".repeat(60));
    console.log("RELAY CORE - AGENT REGISTRATION");
    console.log("=".repeat(60));
    console.log("\nRegistering agent with account:", deployer.address);
    console.log("IdentityRegistry:", IDENTITY_REGISTRY);

    // Load contract ABI
    const currentFile = new URL(import.meta.url).pathname;
    const scriptsDir = path.dirname(currentFile);
    const artifactPath = path.join(scriptsDir, '..', 'artifacts', 'contracts', 'IdentityRegistry.sol', 'IdentityRegistry.json');
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

    const identityRegistry = new ethers.Contract(IDENTITY_REGISTRY, artifact.abi, deployer);

    // Check current agent count
    const currentCount = await identityRegistry.totalAgents();
    console.log("\nCurrent registered agents:", currentCount.toString());

    // Register the agent
    console.log("\n[REGISTER] Registering PerpAI Quote Agent...");
    console.log("   Name:", AGENT_METADATA.name);
    console.log("   Type:", AGENT_METADATA.agent_type);

    const tx = await identityRegistry.registerAgent(
        AGENT_URI,
        deployer.address // Agent wallet address
    );

    console.log("\n[PENDING] Waiting for confirmation...");
    console.log("   TX Hash:", tx.hash);

    const receipt = await tx.wait();

    // Parse event to get agent ID
    const iface = new ethers.Interface(artifact.abi);
    let agentId = null;

    for (const log of receipt.logs) {
        try {
            const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
            if (parsed?.name === 'AgentRegistered') {
                agentId = parsed.args.agentId;
                break;
            }
        } catch (e) {
            // Skip logs that don't match our ABI
        }
    }

    console.log("\n" + "=".repeat(60));
    console.log("[OK] AGENT REGISTERED SUCCESSFULLY!");
    console.log("=".repeat(60));
    console.log(`\n  Agent ID: ${agentId}`);
    console.log(`  Owner: ${deployer.address}`);
    console.log(`  TX: https://explorer.cronos.org/testnet/tx/${tx.hash}`);

    // Get new total
    const newCount = await identityRegistry.totalAgents();
    console.log(`\n[STATS] Total registered agents: ${newCount.toString()}`);

    console.log("\n[ENV] Add to your .env file:");
    console.log(`RELAY_CORE_AGENT_ID=${agentId}`);

    // Verify agent is active
    const isActive = await identityRegistry.isAgentActive(agentId);
    console.log(`\n[CHECK] Agent active: ${isActive}`);
}

main().catch(console.error);
