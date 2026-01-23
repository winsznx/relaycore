/**
 * Direct Escrow Refund Script
 * 
 * Refunds session 2 by calling the contract directly
 */

import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load from mcp-server/.env
dotenv.config({ path: path.join(__dirname, '../mcp-server/.env') });

const ESCROW_CONTRACT_ADDRESS = '0x9D340a67ddD4Fcf5eC590b7B67e1fE8d020F7D61';
const RPC_URL = 'https://evm-t3.cronos.org';
const PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY!;

const ESCROW_ABI = [
    'function refund(uint256 sessionId) external',
    'function getSession(uint256 sessionId) external view returns (address, address, uint256, uint256, uint256, uint256, uint256, bool)',
    'function remainingBalance(uint256 sessionId) public view returns (uint256)'
];

async function refundSession(sessionId: number) {
    console.log('🔄 Refunding escrow session', sessionId);
    console.log('Contract:', ESCROW_CONTRACT_ADDRESS);

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const contract = new ethers.Contract(ESCROW_CONTRACT_ADDRESS, ESCROW_ABI, wallet);

    console.log('Wallet:', wallet.address);

    try {
        // Get session state
        console.log('\n📊 Checking session state...');
        const session = await contract.getSession(sessionId);
        const remaining = await contract.remainingBalance(sessionId);

        console.log('Owner:', session[0]);
        console.log('Escrow Agent:', session[1]);
        console.log('Deposited:', ethers.formatUnits(session[2], 6), 'USDC');
        console.log('Released:', ethers.formatUnits(session[3], 6), 'USDC');
        console.log('Remaining:', ethers.formatUnits(remaining, 6), 'USDC');
        console.log('Active:', session[7]);

        if (remaining === 0n) {
            console.log('\n❌ No balance to refund');
            return;
        }

        // Call refund
        console.log('\n💸 Calling refund...');
        const tx = await contract.refund(sessionId);
        console.log('Transaction sent:', tx.hash);

        console.log('⏳ Waiting for confirmation...');
        const receipt = await tx.wait();

        console.log('\n✅ Refund successful!');
        console.log('Transaction:', `https://explorer.cronos.org/testnet/tx/${receipt.hash}`);
        console.log('Amount refunded:', ethers.formatUnits(remaining, 6), 'USDC');

    } catch (error) {
        console.error('\n❌ Refund failed:', error);

        if (error instanceof Error) {
            console.error('Error message:', error.message);

            // Parse common errors
            if (error.message.includes('Not authorized')) {
                console.error('\n⚠️  Authorization issue:');
                console.error('- Your wallet:', wallet.address);
                console.error('- Session owner:', session[0]);
                console.error('- Escrow agent:', session[1]);
                console.error('\nYou must be either the owner or escrow agent to refund.');
            } else if (error.message.includes('No balance')) {
                console.error('\n⚠️  No balance to refund');
            }
        }
    }
}

// Run refund for session 2
const sessionId = parseInt(process.argv[2] || '2');
refundSession(sessionId)
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
