import { ethers } from 'ethers';

const IDENTITY_REGISTRY_ABI = [
    'function registerAgent(string memory agentURI, address walletAddress) external returns (uint256)',
    'event AgentRegistered(uint256 indexed agentId, address indexed owner, string agentURI, address walletAddress)',
];

export async function registerAgent(
    agentURI: string,
    walletAddress: string,
    signer: ethers.Signer,
    contractAddress: string
): Promise<{ agentId: number; txHash: string }> {
    try {
        if (!contractAddress) {
            throw new Error('Identity Registry address not configured');
        }

        const identityRegistry = new ethers.Contract(
            contractAddress,
            IDENTITY_REGISTRY_ABI,
            signer
        );

        const tx = await identityRegistry.registerAgent(agentURI, walletAddress);
        const receipt = await tx.wait();

        // Extract agentId from event
        const event = receipt.logs.find((log: any) => {
            try {
                const parsed = identityRegistry.interface.parseLog(log);
                return parsed?.name === 'AgentRegistered';
            } catch {
                return false;
            }
        });

        if (event) {
            const parsed = identityRegistry.interface.parseLog(event);
            return {
                agentId: Number(parsed?.args.agentId),
                txHash: receipt.hash,
            };
        }

        throw new Error('AgentRegistered event not found');
    } catch (error: any) {
        console.error('Failed to register agent:', error);
        throw new Error(`Agent registration failed: ${error.message}`);
    }
}
