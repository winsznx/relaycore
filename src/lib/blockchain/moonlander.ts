/**
 * Moonlander Perpetual DEX Integration
 * 
 * Real contract integration for opening/closing perpetual positions on Moonlander.
 * This is the primary DEX for PerpAI on Cronos.
 */

import { ethers } from 'ethers';
import { getProvider, getSigner } from './provider';

// Moonlander Perpetual Contract ABI
const MOONLANDER_PERP_ABI = [
    // Position Management
    'function openPosition(address token, bool isLong, uint256 collateralDelta, uint256 sizeDelta, uint256 acceptablePrice) external returns (bytes32)',
    'function closePosition(bytes32 positionKey, uint256 sizeDelta, uint256 acceptablePrice) external returns (uint256)',
    'function addCollateral(bytes32 positionKey, uint256 collateralDelta) external',
    'function removeCollateral(bytes32 positionKey, uint256 collateralDelta) external',

    // Position Queries
    'function getPosition(address account, address token, bool isLong) external view returns (uint256 size, uint256 collateral, uint256 averagePrice, uint256 entryFundingRate, uint256 reserveAmount, int256 realisedPnl, uint256 lastIncreasedTime)',
    'function getPositionKey(address account, address indexToken, bool isLong) external pure returns (bytes32)',
    'function getMaxPrice(address token) external view returns (uint256)',
    'function getMinPrice(address token) external view returns (uint256)',

    // Market Data
    'function maxLeverage() external view returns (uint256)',
    'function liquidationFee() external view returns (uint256)',
    'function getUtilisation() external view returns (uint256)',

    // Events
    'event IncreasePosition(bytes32 key, address account, address indexToken, uint256 collateralDelta, uint256 sizeDelta, bool isLong, uint256 price, uint256 fee)',
    'event DecreasePosition(bytes32 key, address account, address indexToken, uint256 collateralDelta, uint256 sizeDelta, bool isLong, uint256 price, uint256 fee)',
    'event LiquidatePosition(bytes32 key, address account, address indexToken, bool isLong, uint256 size, uint256 collateral, uint256 reserveAmount, int256 realisedPnl, uint256 markPrice)'
];

// Token addresses on Cronos
const TOKENS: Record<string, string> = {
    'BTC': '0x062E66477Faf219F25D27dCED647BF57C3107d52', // WBTC on Cronos
    'ETH': '0xe44Fd7fCb2b1581822D0c862B68222998a0c299a', // WETH on Cronos
    'CRO': '0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23', // WCRO
    'USDC': '0xc21223249CA28397B4B6541dfFaEcC539BfF0c59'
};

// Contract addresses
const MOONLANDER_ADDRESS = process.env.VITE_MOONLANDER_ADDRESS || '0xE6F6351fb66f3a35313fEEFF9116698665FBEeC9';

export interface OpenPositionParams {
    pair: string;
    isLong: boolean;
    collateralUsd: number;
    sizeUsd: number;
    leverage: number;
    acceptableSlippage: number; // in %
    currentPrice: number;
    userAddress: string;
    privateKey?: string;
    stopLoss?: number;
    takeProfit?: number;
}

export interface ClosePositionParams {
    positionKey: string;
    sizeUsd: number;
    acceptableSlippage: number;
    currentPrice: number;
}

export interface Position {
    key: string;
    account: string;
    token: string;
    isLong: boolean;
    size: number;
    collateral: number;
    averagePrice: number;
    entryFundingRate: number;
    realisedPnl: number;
    lastIncreasedTime: Date;
    unrealisedPnl?: number;
    liquidationPrice?: number;
}

export interface TradeResult {
    txHash: string;
    positionKey: string;
    status: 'success' | 'failed' | 'pending';
    entryPrice?: number;
    size?: number;
    fee?: number;
    timestamp: number;
}

export class MoonlanderIntegration {
    private contract: ethers.Contract;
    private provider: ethers.JsonRpcProvider;

    constructor() {
        this.provider = getProvider();
        this.contract = new ethers.Contract(
            MOONLANDER_ADDRESS,
            MOONLANDER_PERP_ABI,
            this.provider
        );
    }

    /**
     * Get token address from pair string
     */
    private getTokenAddress(pair: string): string {
        const token = pair.split('-')[0].toUpperCase();
        const address = TOKENS[token];
        if (!address) {
            throw new Error(`Unknown token: ${token}`);
        }
        return address;
    }

    /**
     * Calculate acceptable price with slippage
     */
    private calculateAcceptablePrice(
        currentPrice: number,
        slippage: number,
        isLong: boolean,
        isOpening: boolean
    ): bigint {
        const slippageMultiplier = isOpening
            ? (isLong ? 1 + slippage / 100 : 1 - slippage / 100)
            : (isLong ? 1 - slippage / 100 : 1 + slippage / 100);

        // Price in 30 decimals (GMX-style)
        return ethers.parseUnits(
            (currentPrice * slippageMultiplier).toFixed(8),
            30
        );
    }

    /**
     * Open a new perpetual position
     */
    async openPosition(params: OpenPositionParams): Promise<TradeResult> {
        try {
            const signer = await getSigner();
            const contractWithSigner = this.contract.connect(signer);

            const token = this.getTokenAddress(params.pair);
            const collateralDelta = ethers.parseUnits(params.collateralUsd.toFixed(6), 6);
            const sizeDelta = ethers.parseUnits(params.sizeUsd.toFixed(6), 30);
            const acceptablePrice = this.calculateAcceptablePrice(
                params.currentPrice,
                params.acceptableSlippage,
                params.isLong,
                true
            );

            console.log(`Opening ${params.isLong ? 'LONG' : 'SHORT'} on Moonlander:`, {
                pair: params.pair,
                size: params.sizeUsd,
                leverage: params.leverage,
                collateral: params.collateralUsd
            });

            const tx = await (contractWithSigner as any).openPosition(
                token,
                params.isLong,
                collateralDelta,
                sizeDelta,
                acceptablePrice
            );

            const receipt = await tx.wait();

            // Parse position key from event logs
            const positionKey = this.parsePositionKeyFromReceipt(receipt);

            return {
                txHash: receipt.hash,
                positionKey: positionKey || '',
                status: receipt.status === 1 ? 'success' : 'failed',
                entryPrice: params.currentPrice,
                size: params.sizeUsd,
                fee: params.sizeUsd * 0.001, // 0.1% fee estimate
                timestamp: Date.now()
            };
        } catch (error: any) {
            console.error('Failed to open position on Moonlander:', error);
            throw new Error(`Open position failed: ${error.message}`);
        }
    }

    /**
     * Close an existing position
     */
    async closePosition(params: ClosePositionParams): Promise<TradeResult> {
        try {
            const signer = await getSigner();
            const contractWithSigner = this.contract.connect(signer);

            const sizeDelta = ethers.parseUnits(params.sizeUsd.toFixed(6), 30);
            const acceptablePrice = ethers.parseUnits(
                params.currentPrice.toFixed(8),
                30
            );

            console.log('Closing position on Moonlander:', params.positionKey);

            const tx = await (contractWithSigner as any).closePosition(
                params.positionKey,
                sizeDelta,
                acceptablePrice
            );

            const receipt = await tx.wait();

            return {
                txHash: receipt.hash,
                positionKey: params.positionKey,
                status: receipt.status === 1 ? 'success' : 'failed',
                timestamp: Date.now()
            };
        } catch (error: any) {
            console.error('Failed to close position:', error);
            throw new Error(`Close position failed: ${error.message}`);
        }
    }

    /**
     * Get position details
     */
    async getPosition(account: string, pair: string, isLong: boolean): Promise<Position | null> {
        try {
            const token = this.getTokenAddress(pair);

            const [size, collateral, averagePrice, entryFundingRate, _reserveAmount, realisedPnl, lastIncreasedTime] =
                await (this.contract as any).getPosition(account, token, isLong);

            if (size === 0n) {
                return null; // No position
            }

            const positionKey = await this.contract.getPositionKey(account, token, isLong);

            return {
                key: positionKey,
                account,
                token,
                isLong,
                size: Number(ethers.formatUnits(size, 30)),
                collateral: Number(ethers.formatUnits(collateral, 6)),
                averagePrice: Number(ethers.formatUnits(averagePrice, 30)),
                entryFundingRate: Number(entryFundingRate),
                realisedPnl: Number(ethers.formatUnits(realisedPnl, 6)),
                lastIncreasedTime: new Date(Number(lastIncreasedTime) * 1000)
            };
        } catch (error) {
            console.error('Failed to get position:', error);
            return null;
        }
    }

    /**
     * Get all positions for an account
     */
    async getAllPositions(account: string): Promise<Position[]> {
        const positions: Position[] = [];

        for (const [tokenSymbol] of Object.entries(TOKENS)) {
            if (tokenSymbol === 'USDC') continue; // Skip stablecoin

            const pair = `${tokenSymbol}-USD`;

            // Check long position
            const longPos = await this.getPosition(account, pair, true);
            if (longPos) positions.push(longPos);

            // Check short position
            const shortPos = await this.getPosition(account, pair, false);
            if (shortPos) positions.push(shortPos);
        }

        return positions;
    }

    /**
     * Calculate unrealised PnL
     */
    calculateUnrealisedPnl(
        position: Position,
        currentPrice: number
    ): number {
        const priceDiff = currentPrice - position.averagePrice;
        const pnl = position.isLong
            ? (priceDiff / position.averagePrice) * position.size
            : (-priceDiff / position.averagePrice) * position.size;

        return pnl;
    }

    /**
     * Calculate liquidation price
     */
    calculateLiquidationPrice(
        position: Position,
        liquidationFee: number = 0.01 // 1%
    ): number {
        const leverage = position.size / position.collateral;
        const liqPercent = (1 / leverage) - liquidationFee;

        return position.isLong
            ? position.averagePrice * (1 - liqPercent)
            : position.averagePrice * (1 + liqPercent);
    }

    /**
     * Parse position key from transaction receipt
     */
    private parsePositionKeyFromReceipt(receipt: ethers.TransactionReceipt): string | null {
        for (const log of receipt.logs) {
            try {
                const parsed = this.contract.interface.parseLog({
                    topics: log.topics as string[],
                    data: log.data
                });

                if (parsed?.name === 'IncreasePosition') {
                    return parsed.args.key;
                }
            } catch {
                continue;
            }
        }
        return null;
    }

    /**
     * Get maximum leverage allowed
     */
    async getMaxLeverage(): Promise<number> {
        try {
            const maxLev = await this.contract.maxLeverage();
            return Number(maxLev) / 10000; // Convert from basis points
        } catch {
            return 50; // Default 50x
        }
    }

    /**
     * Get current token price from contract
     */
    async getTokenPrice(pair: string, isMax: boolean = true): Promise<number> {
        try {
            const token = this.getTokenAddress(pair);
            const price = isMax
                ? await this.contract.getMaxPrice(token)
                : await this.contract.getMinPrice(token);
            return Number(ethers.formatUnits(price, 30));
        } catch {
            return 0;
        }
    }
}

// Export singleton instance
export const moonlanderIntegration = new MoonlanderIntegration();
