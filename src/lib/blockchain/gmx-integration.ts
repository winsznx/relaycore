import { ethers } from 'ethers';
import { getProvider } from './provider';
import logger from '../../lib/logger';

/**
 * GMX V2 Integration for Cronos
 * 
 * GMX is a decentralized perpetual exchange
 * Docs: https://gmxio.gitbook.io/gmx/
 * 
 * Note: GMX V2 uses a different architecture than V1
 * Positions are managed through the Exchange Router contract
 */

// GMX V2 Contract Addresses (Cronos - if deployed, otherwise use testnet)
const GMX_EXCHANGE_ROUTER = process.env.VITE_GMX_EXCHANGE_ROUTER || '0x0000000000000000000000000000000000000000';
const GMX_READER = process.env.VITE_GMX_READER || '0x0000000000000000000000000000000000000000';

// Minimal ABI for GMX V2 Exchange Router
const EXCHANGE_ROUTER_ABI = [
    'function createIncreaseOrder(address[] memory path, address indexToken, uint256 amountIn, uint256 minOut, uint256 sizeDelta, bool isLong, uint256 triggerPrice, bool triggerAboveThreshold, uint256 executionFee) external payable',
    'function createDecreaseOrder(address indexToken, uint256 sizeDelta, address collateralToken, uint256 collateralDelta, bool isLong, uint256 triggerPrice, bool triggerAboveThreshold) external payable',
];

const READER_ABI = [
    'function getPosition(address account, address collateralToken, address indexToken, bool isLong) external view returns (uint256, uint256, uint256, uint256, uint256, uint256, bool, uint256)',
];

interface GMXPosition {
    size: bigint;
    collateral: bigint;
    averagePrice: bigint;
    entryFundingRate: bigint;
    reserveAmount: bigint;
    realisedPnl: bigint;
    hasProfit: boolean;
    lastIncreasedTime: bigint;
}

export class GMXIntegration {
    private provider: ethers.Provider;
    private exchangeRouter: ethers.Contract;
    private reader: ethers.Contract;

    constructor() {
        this.provider = getProvider();
        this.exchangeRouter = new ethers.Contract(GMX_EXCHANGE_ROUTER, EXCHANGE_ROUTER_ABI, this.provider);
        this.reader = new ethers.Contract(GMX_READER, READER_ABI, this.provider);
    }

    /**
     * Open a leveraged position on GMX
     */
    async openPosition(params: {
        pair: string;
        isLong: boolean;
        collateralUsd: number;
        sizeUsd: number;
        leverage: number;
        acceptableSlippage: number;
        currentPrice: number;
        userAddress: string;
        privateKey?: string;
        stopLoss?: number;
        takeProfit?: number;
    }): Promise<{ txHash: string; positionKey: string }> {
        try {
            logger.info('Opening GMX position', {
                pair: params.pair,
                side: params.isLong ? 'LONG' : 'SHORT',
                size: params.sizeUsd,
            });

            // GMX requires execution fee (typically 0.0003 ETH on mainnet)
            const executionFee = ethers.parseEther('0.001'); // Higher for testnet

            // Calculate trigger price with slippage
            const slippageMultiplier = params.isLong
                ? 1 + params.acceptableSlippage / 100
                : 1 - params.acceptableSlippage / 100;
            const triggerPrice = Math.floor(params.currentPrice * slippageMultiplier * 1e30); // GMX uses 30 decimals

            // Get signer (browser environment)
            let signer;
            if (params.privateKey) {
                signer = new ethers.Wallet(params.privateKey, this.provider);
            } else {
                // For browser, we need to use window.ethereum
                if (typeof window !== 'undefined' && (window as any).ethereum) {
                    const browserProvider = new ethers.BrowserProvider((window as any).ethereum);
                    signer = await browserProvider.getSigner(params.userAddress);
                } else {
                    throw new Error('No wallet provider available');
                }
            }

            const routerWithSigner = this.exchangeRouter.connect(signer) as any;

            // Create increase order (market order)
            const tx = await routerWithSigner.createIncreaseOrder(
                [], // path (empty for market order)
                this.getIndexToken(params.pair),
                ethers.parseUnits(params.collateralUsd.toString(), 30), // amountIn
                0, // minOut (0 for market order)
                ethers.parseUnits(params.sizeUsd.toString(), 30), // sizeDelta
                params.isLong,
                triggerPrice,
                params.isLong, // triggerAboveThreshold
                executionFee,
                { value: executionFee }
            );

            const receipt = await tx.wait();
            const positionKey = this.generatePositionKey(params.userAddress, params.pair, params.isLong);

            logger.info('GMX position opened', {
                txHash: receipt.hash,
                positionKey,
            });

            return {
                txHash: receipt.hash,
                positionKey,
            };
        } catch (error: any) {
            logger.error('GMX position open failed', error, { pair: params.pair });
            throw new Error(`GMX position failed: ${error.message}`);
        }
    }

    /**
     * Close a position on GMX
     */
    async closePosition(params: {
        positionKey: string;
        sizeUsd: number;
        acceptableSlippage: number;
        currentPrice: number;
        userAddress: string;
        privateKey?: string;
    }): Promise<{ txHash: string }> {
        try {
            logger.info('Closing GMX position', { positionKey: params.positionKey });

            const executionFee = ethers.parseEther('0.001');

            // Parse position key to get token and direction
            const { indexToken, isLong } = this.parsePositionKey(params.positionKey);

            const slippageMultiplier = isLong
                ? 1 - params.acceptableSlippage / 100
                : 1 + params.acceptableSlippage / 100;
            const triggerPrice = Math.floor(params.currentPrice * slippageMultiplier * 1e30);

            let signer;
            if (params.privateKey) {
                signer = new ethers.Wallet(params.privateKey, this.provider);
            } else {
                if (typeof window !== 'undefined' && (window as any).ethereum) {
                    const browserProvider = new ethers.BrowserProvider((window as any).ethereum);
                    signer = await browserProvider.getSigner(params.userAddress);
                } else {
                    throw new Error('No wallet provider available');
                }
            }

            const routerWithSigner = this.exchangeRouter.connect(signer) as any;

            const tx = await routerWithSigner.createDecreaseOrder(
                indexToken,
                ethers.parseUnits(params.sizeUsd.toString(), 30), // sizeDelta
                indexToken, // collateralToken (same as index for simplicity)
                0, // collateralDelta (0 to close entire position)
                isLong,
                triggerPrice,
                !isLong, // triggerAboveThreshold (opposite of position direction)
                { value: executionFee }
            );

            const receipt = await tx.wait();

            logger.info('GMX position closed', { txHash: receipt.hash });

            return { txHash: receipt.hash };
        } catch (error: any) {
            logger.error('GMX position close failed', error);
            throw new Error(`GMX close failed: ${error.message}`);
        }
    }

    /**
     * Get current position details
     */
    async getPosition(
        userAddress: string,
        pair: string,
        isLong: boolean
    ): Promise<GMXPosition | null> {
        try {
            const indexToken = this.getIndexToken(pair);
            const collateralToken = indexToken; // Using same token for simplicity

            const position = await this.reader.getPosition(
                userAddress,
                collateralToken,
                indexToken,
                isLong
            );

            // Position returns [size, collateral, averagePrice, entryFundingRate, reserveAmount, realisedPnl, hasProfit, lastIncreasedTime]
            if (position[0] === 0n) {
                return null; // No position
            }

            return {
                size: position[0],
                collateral: position[1],
                averagePrice: position[2],
                entryFundingRate: position[3],
                reserveAmount: position[4],
                realisedPnl: position[5],
                hasProfit: position[6],
                lastIncreasedTime: position[7],
            };
        } catch (error) {
            logger.error('GMX get position failed', error as Error);
            return null;
        }
    }

    /**
     * Get index token address for a trading pair
     */
    private getIndexToken(pair: string): string {
        const tokenMap: Record<string, string> = {
            'BTC-USD': '0x062E66477Faf219F25D27dCED647BF57C3107d52', // WBTC on Cronos
            'ETH-USD': '0xe44Fd7fCb2b1581822D0c862B68222998a0c299a', // WETH on Cronos
            'CRO-USD': '0x5C7F8A570d578ED60E9aE2ed85db5aD1b0b3e6e7', // WCRO on Cronos
        };

        return tokenMap[pair] || tokenMap['ETH-USD'];
    }

    /**
     * Generate a unique position key
     */
    private generatePositionKey(userAddress: string, pair: string, isLong: boolean): string {
        return `${userAddress}-${pair}-${isLong ? 'LONG' : 'SHORT'}`;
    }

    /**
     * Parse position key back to components
     */
    private parsePositionKey(key: string): { indexToken: string; isLong: boolean } {
        const parts = key.split('-');
        const pair = `${parts[1]}-${parts[2]}`;
        const isLong = parts[3] === 'LONG';
        return {
            indexToken: this.getIndexToken(pair),
            isLong,
        };
    }
}

export const gmxIntegration = new GMXIntegration();
