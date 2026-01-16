import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { ethers } from 'npm:ethers';

// Helper: decode service ID from bytes32
function decodeServiceId(bytes32: string): string {
    try {
        return ethers.decodeBytes32String(bytes32);
    } catch {
        return bytes32;
    }
}

// Configuration
const CRONOS_RPC_URLS = [
    Deno.env.get('CRONOS_RPC_PRIMARY') || "https://evm.cronos.org",
    Deno.env.get('CRONOS_RPC_FALLBACK_1'),
    Deno.env.get('CRONOS_RPC_FALLBACK_2')
].filter(Boolean) as string[];

const X402_CONTRACT_ADDRESS = Deno.env.get('X402_FACILITATOR_ADDRESS');
const MAX_BLOCKS_PER_RUN = 500; // conservative batch for Edge Function

// x402 Facilitator contract ABI (from SDK)
const X402_ABI = [
    'event PaymentExecuted(address indexed payer, address indexed receiver, uint256 amount, bytes32 indexed serviceId, uint256 timestamp)',
    'event PaymentFailed(address indexed payer, address indexed receiver, uint256 amount, bytes32 indexed serviceId, string reason)',
    'event ServiceRegistered(bytes32 indexed serviceId, address indexed owner, string name)'
];

// Multi-RPC provider with automatic failover
class MultiRpcProvider {
    private providers: ethers.JsonRpcProvider[];
    private currentIndex: number = 0;

    constructor(urls: string[]) {
        this.providers = urls.map(url => new ethers.JsonRpcProvider(url));
    }

    async getProvider(): Promise<ethers.JsonRpcProvider> {
        const provider = this.providers[this.currentIndex];
        try {
            await provider.getBlockNumber();
            return provider;
        } catch (error) {
            console.error('RPC provider failed', error, { index: this.currentIndex });
            this.currentIndex = (this.currentIndex + 1) % this.providers.length;
            return this.getProvider();
        }
    }
}

// Main indexer class
export class CronosIndexer {
    private provider: MultiRpcProvider;
    private contract: ethers.Contract | null = null;
    private supabase: any;
    private lastProcessedBlock: number = 0;

    constructor() {
        this.provider = new MultiRpcProvider(CRONOS_RPC_URLS);
        this.supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
    }

    async initialize() {
        if (!X402_CONTRACT_ADDRESS) {
            throw new Error("X402_FACILITATOR_ADDRESS not set");
        }
        const activeProvider = await this.provider.getProvider();
        this.contract = new ethers.Contract(
            X402_CONTRACT_ADDRESS,
            X402_ABI,
            activeProvider
        );

        // Load last processed block from database
        const { data } = await this.supabase
            .from('indexer_state')
            .select('last_block')
            .single();

        if (data) {
            this.lastProcessedBlock = data.last_block;
        } else {
            // Default to current block - 100 on first run if not configured, or 0
            this.lastProcessedBlock = (await activeProvider.getBlockNumber()) - 100;
        }

        console.log('Indexer initialized', { startBlock: this.lastProcessedBlock });
    }

    // Historical sync (batch processing)
    async syncBatch(): Promise<{ processed: number, toBlock: number }> {
        if (!this.contract) throw new Error("Indexer not initialized");

        const activeProvider = await this.provider.getProvider();
        const currentBlock = await activeProvider.getBlockNumber();

        const fromBlock = this.lastProcessedBlock + 1;
        const toBlock = Math.min(fromBlock + MAX_BLOCKS_PER_RUN, currentBlock);

        if (fromBlock > toBlock) {
            return { processed: 0, toBlock: this.lastProcessedBlock };
        }

        console.log('Starting batch sync', { fromBlock, toBlock });

        try {
            // @ts-ignore
            const events = await this.contract.queryFilter('PaymentExecuted', fromBlock, toBlock);

            if (events.length === 0) {
                console.log('No events in batch', { fromBlock, toBlock });
                // Update even if no events
                await this.updateLastProcessedBlock(toBlock);
                return { processed: 0, toBlock };
            }

            // Process events in parallel
            const payments = await Promise.all(
                events.map(async (event: any) => {
                    const receipt = await event.getTransactionReceipt();
                    const block = await event.getBlock();

                    return {
                        tx_hash: event.transactionHash,
                        block_number: event.blockNumber,
                        block_timestamp: new Date(block.timestamp * 1000).toISOString(),
                        payer_address: event.args[0].toLowerCase(),
                        receiver_address: event.args[1].toLowerCase(),
                        service_id: decodeServiceId(event.args[3]),
                        amount: ethers.formatUnits(event.args[2], 6),
                        currency: 'USDC',
                        gas_used: receipt.gasUsed.toString(),
                        gas_price: ethers.formatUnits(receipt.gasPrice || 0, 'gwei'),
                        status: 'success',
                        confirmed_at: new Date(block.timestamp * 1000).toISOString()
                    };
                })
            );

            // Batch insert
            // Simple retry loop
            let retries = 3;
            while (retries > 0) {
                const { error } = await this.supabase
                    .from('payments')
                    .insert(payments);
                if (!error) break;
                retries--;
                await new Promise(r => setTimeout(r, 1000));
            }

            // Update last processed block
            await this.updateLastProcessedBlock(toBlock);

            console.log('Batch synced', { fromBlock, toBlock, count: payments.length });
            return { processed: payments.length, toBlock };
        } catch (error) {
            console.error('Batch sync failed', error, { fromBlock, toBlock });
            throw error;
        }
    }

    // Helper: update last processed block
    private async updateLastProcessedBlock(blockNumber: number) {
        await this.supabase
            .from('indexer_state')
            .upsert({ id: 1, last_block: blockNumber, updated_at: new Date().toISOString() });

        this.lastProcessedBlock = blockNumber;
    }
}

// Serve function (Triggered by Cron or HTTP)
serve(async (req) => {
    try {
        const indexer = new CronosIndexer();
        await indexer.initialize();
        const result = await indexer.syncBatch();
        return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
});
