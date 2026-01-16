/**
 * Deploy EscrowSession from compiled bytecode
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const CRONOS_TESTNET_RPC = 'https://evm-t3.cronos.org';
const USDC_ADDRESS = '0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0';
const PRIVATE_KEY = '8705dd8483d25411408a37fdb0348f765de34f8ae9056e122f8cc7d379c66c9b';

async function main() {
    // Read compiled artifacts
    const bytecode = '0x' + fs.readFileSync(
        path.join(__dirname, '../build/contracts_EscrowSession_flat_sol_EscrowSession.bin'),
        'utf8'
    ).trim();

    const abi = JSON.parse(fs.readFileSync(
        path.join(__dirname, '../build/contracts_EscrowSession_flat_sol_EscrowSession.abi'),
        'utf8'
    ));

    console.log('Bytecode length:', bytecode.length);
    console.log('ABI functions:', abi.filter(x => x.type === 'function').map(x => x.name).join(', '));

    const provider = new ethers.JsonRpcProvider(CRONOS_TESTNET_RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log('');
    console.log('Deploying EscrowSession...');
    console.log('Deployer:', wallet.address);
    console.log('Network: Cronos Testnet');
    console.log('USDC Address:', USDC_ADDRESS);

    const balance = await provider.getBalance(wallet.address);
    console.log('Balance:', ethers.formatEther(balance), 'TCRO');

    if (balance === 0n) {
        console.error('No balance! Get testnet CRO from https://cronos.org/faucet');
        process.exit(1);
    }

    const factory = new ethers.ContractFactory(abi, bytecode, wallet);

    console.log('');
    console.log('Sending deployment transaction...');

    const contract = await factory.deploy(USDC_ADDRESS, {
        gasLimit: 5000000
    });

    console.log('Tx Hash:', contract.deploymentTransaction()?.hash);
    console.log('Waiting for confirmation...');

    await contract.waitForDeployment();
    const address = await contract.getAddress();

    console.log('');
    console.log('='.repeat(60));
    console.log('  EscrowSession Deployed Successfully!');
    console.log('='.repeat(60));
    console.log('');
    console.log('  Contract Address:', address);
    console.log('  Payment Token:', USDC_ADDRESS);
    console.log('');
    console.log('  Add to .env:');
    console.log(`  ESCROW_CONTRACT_ADDRESS=${address}`);
    console.log('');
    console.log('  Cronoscan:');
    console.log(`  https://testnet.cronoscan.com/address/${address}`);
    console.log('');
    console.log('='.repeat(60));
}

main().catch(err => {
    console.error('Deployment failed:', err.message);
    process.exit(1);
});
