import { ethers } from 'ethers';
import { getProvider } from './provider';
import logger from '../../lib/logger';

/**
 * Gains Network / Fulcrom Finance Integration
 * 
 * Fulcrom is a fork of Gains Network deployed on Cronos
 * Docs: https://gains-network.gitbook.io/docs-home/
 * 
 * Uses the gTrade architecture with:
 * - Trading contract for opening/closing positions
 * - Storage contract for position data
 * - Price aggregator for oracle prices
 */

// Fulcrom Contract Addresses (Cronos Testnet)
const FULCROM_TRADING = process.env.VITE_FULCROM_TRADING || '0x0000000000000000000000000000000000000001';
const FULCROM_STORAGE = process.env.VITE_FULCROM_STORAGE || '0x0000000000000000000000000000000000000002';
const FULCROM_CALLBACKS = process.env.VITE_FULCROM_CALLBACKS || '0x0000000000000000000000000000000000000003';

// Minimal ABI for Fulcrom Trading
const TRADING_ABI = [
    'function openTrade(tuple(address trader, uint256 pairIndex, uint256 index, uint256 initialPosToken, uint256 positionSizeDai, uint256 openPrice, bool buy, uint256 leverage, uint256 tp, uint256 sl) t, uint8 orderType, uint256 slippageP, address referrer) external',
    'function closeTradeMarket(uint256 pairIndex, uint256 index) external',
    'function updateTp(uint256 pairIndex, uint256 index, uint256 newTp) external',
    'function updateSl(uint256 pairIndex, uint256 index, uint256 newSl) external',
];

const STORAGE_ABI = [
    'function openTrades(address trader, uint256 pairIndex, uint256 index) external view returns (tuple(address trader, uint256 pairIndex, uint256 index, uint256 initialPosToken, uint256 positionSizeDai, uint256 openPrice, bool buy, uint256 leverage, uint256 tp, uint256 sl))',
    'function openTradesCount(address trader, uint256 pairIndex) external view returns (uint256)',
    'function getPendingOrderIds(address trader) external view returns (uint256[] memory)',
];

interface FulcrumTrade {
    trader: string;
    pairIndex: bigint;
    index: bigint;
    initialPosToken: bigint;
    positionSizeDai: bigint;
    openPrice: bigint;
    buy: boolean;
    leverage: bigint;
    tp: bigint; // take profit
    sl: bigint; // stop loss
}

export class FulcrumIntegration {
    private provider: ethers.Provider;
    private trading: ethers.Contract;
    private storage: ethers.Contract;

    constructor() {
        this.provider = getProvider();
        this.trading = new ethers.Contract(FULCROM_TRADING, TRADING_ABI, this.provider);
        this.storage = new ethers.Contract(FULCROM_STORAGE, STORAGE_ABI, this.provider);
    }

    /**
     * Open a leveraged position on Fulcrom
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
            logger.info('Opening Fulcrom position', {
                pair: params.pair,
                side: params.isLong ? 'LONG' : 'SHORT',
                size: params.sizeUsd,
            });

            const pairIndex = this.getPairIndex(params.pair);
            const tradeIndex = await this.getNextTradeIndex(params.userAddress, pairIndex);

            // Fulcrom uses 10 decimals for prices
            const openPrice = Math.floor(params.currentPrice * 1e10);
            const slippageP = Math.floor(params.acceptableSlippage * 1e10); // Slippage in percentage with 10 decimals

            // Calculate TP/SL if provided
            const tp = params.takeProfit ? Math.floor(params.takeProfit * 1e10) : 0;
            const sl = params.stopLoss ? Math.floor(params.stopLoss * 1e10) : 0;

            const trade: FulcrumTrade = {
                trader: params.userAddress,
                pairIndex: BigInt(pairIndex),
                index: BigInt(tradeIndex),
                initialPosToken: 0n, // Will be set by contract
                positionSizeDai: ethers.parseUnits(params.sizeUsd.toString(), 18), // DAI has 18 decimals
                openPrice: BigInt(openPrice),
                buy: params.isLong,
                leverage: BigInt(params.leverage),
                tp: BigInt(tp),
                sl: BigInt(sl),
            };

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

            const tradingWithSigner = this.trading.connect(signer) as any;

            // Order type: 0 = Market, 1 = Limit
            const orderType = 0;
            const referrer = ethers.ZeroAddress;

            const tx = await tradingWithSigner.openTrade(
                trade,
                orderType,
                slippageP,
                referrer
            );

            const receipt = await tx.wait();
            const positionKey = this.generatePositionKey(params.userAddress, pairIndex, tradeIndex);

            logger.info('Fulcrom position opened', {
                txHash: receipt.hash,
                positionKey,
            });

            return {
                txHash: receipt.hash,
                positionKey,
            };
        } catch (error: any) {
            logger.error('Fulcrom position open failed', error, { pair: params.pair });
            throw new Error(`Fulcrom position failed: ${error.message}`);
        }
    }

    /**
     * Close a position on Fulcrom
     */
    async closePosition(params: {
        positionKey: string;
        userAddress: string;
        privateKey?: string;
    }): Promise<{ txHash: string }> {
        try {
            logger.info('Closing Fulcrom position', { positionKey: params.positionKey });

            const { pairIndex, index } = this.parsePositionKey(params.positionKey);

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

            const tradingWithSigner = this.trading.connect(signer) as any;

            const tx = await tradingWithSigner.closeTradeMarket(pairIndex, index);
            const receipt = await tx.wait();

            logger.info('Fulcrom position closed', { txHash: receipt.hash });

            return { txHash: receipt.hash };
        } catch (error: any) {
            logger.error('Fulcrom position close failed', error);
            throw new Error(`Fulcrom close failed: ${error.message}`);
        }
    }

    /**
     * Get current position details
     */
    async getPosition(
        userAddress: string,
        pair: string,
        isLong: boolean
    ): Promise<FulcrumTrade | null> {
        try {
            const pairIndex = this.getPairIndex(pair);
            const tradesCount = await this.storage.openTradesCount(userAddress, pairIndex);

            // Find the matching trade (buy/sell direction)
            for (let i = 0; i < Number(tradesCount); i++) {
                const trade = await this.storage.openTrades(userAddress, pairIndex, i);

                if (trade.buy === isLong && trade.positionSizeDai > 0n) {
                    return {
                        trader: trade.trader,
                        pairIndex: trade.pairIndex,
                        index: trade.index,
                        initialPosToken: trade.initialPosToken,
                        positionSizeDai: trade.positionSizeDai,
                        openPrice: trade.openPrice,
                        buy: trade.buy,
                        leverage: trade.leverage,
                        tp: trade.tp,
                        sl: trade.sl,
                    };
                }
            }

            return null; // No matching position found
        } catch (error) {
            logger.error('Fulcrom get position failed', error as Error);
            return null;
        }
    }

    /**
     * Update stop loss for an open position
     */
    async updateStopLoss(params: {
        positionKey: string;
        newStopLoss: number;
        userAddress: string;
        privateKey?: string;
    }): Promise<{ txHash: string }> {
        const { pairIndex, index } = this.parsePositionKey(params.positionKey);
        const newSl = Math.floor(params.newStopLoss * 1e10);

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

        const tradingWithSigner = this.trading.connect(signer) as any;
        const tx = await tradingWithSigner.updateSl(pairIndex, index, newSl);
        const receipt = await tx.wait();

        return { txHash: receipt.hash };
    }

    /**
     * Update take profit for an open position
     */
    async updateTakeProfit(params: {
        positionKey: string;
        newTakeProfit: number;
        userAddress: string;
        privateKey?: string;
    }): Promise<{ txHash: string }> {
        const { pairIndex, index } = this.parsePositionKey(params.positionKey);
        const newTp = Math.floor(params.newTakeProfit * 1e10);

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

        const tradingWithSigner = this.trading.connect(signer) as any;
        const tx = await tradingWithSigner.updateTp(pairIndex, index, newTp);
        const receipt = await tx.wait();

        return { txHash: receipt.hash };
    }

    /**
     * Get next trade index for a user
     */
    private async getNextTradeIndex(userAddress: string, pairIndex: number): Promise<number> {
        const count = await this.storage.openTradesCount(userAddress, pairIndex);
        return Number(count);
    }

    /**
     * Map trading pair to Fulcrom pair index
     */
    private getPairIndex(pair: string): number {
        const pairMap: Record<string, number> = {
            'BTC-USD': 0,
            'ETH-USD': 1,
            'CRO-USD': 2,
        };

        return pairMap[pair] ?? 1; // Default to ETH
    }

    /**
     * Generate a unique position key
     */
    private generatePositionKey(userAddress: string, pairIndex: number, index: number): string {
        return `${userAddress}-${pairIndex}-${index}`;
    }

    /**
     * Parse position key back to components
     */
    private parsePositionKey(key: string): { pairIndex: number; index: number } {
        const parts = key.split('-');
        return {
            pairIndex: parseInt(parts[1]),
            index: parseInt(parts[2]),
        };
    }
}

export const fulcrumIntegration = new FulcrumIntegration();
