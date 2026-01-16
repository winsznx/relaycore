/**
 * Advanced Trading Features
 * 
 * Provides stop-loss, take-profit, and DCA (Dollar Cost Averaging) functionality
 * for perpetual trading positions.
 */
import { moonlanderIntegration } from './blockchain/moonlander';
import { priceFeedSubscription } from './realtime';

// ============================================
// TYPES
// ============================================

export interface StopLossOrder {
    id: string;
    positionKey: string;
    pair: string;
    side: 'long' | 'short';
    triggerPrice: number;
    sizePercent: number; // 100 = close entire position
    status: 'active' | 'triggered' | 'cancelled';
    createdAt: Date;
}

export interface TakeProfitOrder {
    id: string;
    positionKey: string;
    pair: string;
    side: 'long' | 'short';
    triggerPrice: number;
    sizePercent: number;
    status: 'active' | 'triggered' | 'cancelled';
    createdAt: Date;
}

export interface TrailingStopOrder {
    id: string;
    positionKey: string;
    pair: string;
    side: 'long' | 'short';
    trailingPercent: number; // e.g., 2 = 2%
    highestPrice: number; // For longs
    lowestPrice: number; // For shorts
    currentTriggerPrice: number;
    sizePercent: number;
    status: 'active' | 'triggered' | 'cancelled';
    createdAt: Date;
}

export interface DCAConfig {
    id: string;
    pair: string;
    side: 'long' | 'short';
    totalAmount: number; // Total USD to invest
    numOrders: number; // Number of DCA orders
    interval: 'hourly' | 'daily' | 'weekly';
    leverage: number;
    completedOrders: number;
    status: 'active' | 'completed' | 'paused' | 'cancelled';
    nextExecutionTime: Date;
    createdAt: Date;
}

// ============================================
// STOP LOSS / TAKE PROFIT MANAGER
// ============================================

class OrderManager {
    private stopLossOrders: Map<string, StopLossOrder> = new Map();
    private takeProfitOrders: Map<string, TakeProfitOrder> = new Map();
    private trailingStops: Map<string, TrailingStopOrder> = new Map();
    private priceSubscription: (() => void) | null = null;
    private isMonitoring: boolean = false;

    /**
     * Create a stop-loss order
     */
    createStopLoss(params: {
        positionKey: string;
        pair: string;
        side: 'long' | 'short';
        triggerPrice: number;
        sizePercent?: number;
    }): StopLossOrder {
        const order: StopLossOrder = {
            id: `sl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            positionKey: params.positionKey,
            pair: params.pair,
            side: params.side,
            triggerPrice: params.triggerPrice,
            sizePercent: params.sizePercent || 100,
            status: 'active',
            createdAt: new Date()
        };

        this.stopLossOrders.set(order.id, order);
        this.ensureMonitoring();
        this.persistOrders();

        console.log(`Stop-loss created: ${order.id} at $${params.triggerPrice}`);
        return order;
    }

    /**
     * Create a take-profit order
     */
    createTakeProfit(params: {
        positionKey: string;
        pair: string;
        side: 'long' | 'short';
        triggerPrice: number;
        sizePercent?: number;
    }): TakeProfitOrder {
        const order: TakeProfitOrder = {
            id: `tp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            positionKey: params.positionKey,
            pair: params.pair,
            side: params.side,
            triggerPrice: params.triggerPrice,
            sizePercent: params.sizePercent || 100,
            status: 'active',
            createdAt: new Date()
        };

        this.takeProfitOrders.set(order.id, order);
        this.ensureMonitoring();
        this.persistOrders();

        console.log(`Take-profit created: ${order.id} at $${params.triggerPrice}`);
        return order;
    }

    /**
     * Create a trailing stop order
     */
    createTrailingStop(params: {
        positionKey: string;
        pair: string;
        side: 'long' | 'short';
        trailingPercent: number;
        currentPrice: number;
        sizePercent?: number;
    }): TrailingStopOrder {
        const triggerPrice = params.side === 'long'
            ? params.currentPrice * (1 - params.trailingPercent / 100)
            : params.currentPrice * (1 + params.trailingPercent / 100);

        const order: TrailingStopOrder = {
            id: `ts_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            positionKey: params.positionKey,
            pair: params.pair,
            side: params.side,
            trailingPercent: params.trailingPercent,
            highestPrice: params.side === 'long' ? params.currentPrice : 0,
            lowestPrice: params.side === 'short' ? params.currentPrice : Infinity,
            currentTriggerPrice: triggerPrice,
            sizePercent: params.sizePercent || 100,
            status: 'active',
            createdAt: new Date()
        };

        this.trailingStops.set(order.id, order);
        this.ensureMonitoring();
        this.persistOrders();

        console.log(`Trailing stop created: ${order.id} at ${params.trailingPercent}%`);
        return order;
    }

    /**
     * Cancel an order
     */
    cancelOrder(orderId: string): boolean {
        if (this.stopLossOrders.has(orderId)) {
            const order = this.stopLossOrders.get(orderId)!;
            order.status = 'cancelled';
            this.persistOrders();
            return true;
        }
        if (this.takeProfitOrders.has(orderId)) {
            const order = this.takeProfitOrders.get(orderId)!;
            order.status = 'cancelled';
            this.persistOrders();
            return true;
        }
        if (this.trailingStops.has(orderId)) {
            const order = this.trailingStops.get(orderId)!;
            order.status = 'cancelled';
            this.persistOrders();
            return true;
        }
        return false;
    }

    /**
     * Get all active orders for a position
     */
    getOrdersForPosition(positionKey: string): {
        stopLoss: StopLossOrder[];
        takeProfit: TakeProfitOrder[];
        trailingStop: TrailingStopOrder[];
    } {
        return {
            stopLoss: Array.from(this.stopLossOrders.values())
                .filter(o => o.positionKey === positionKey && o.status === 'active'),
            takeProfit: Array.from(this.takeProfitOrders.values())
                .filter(o => o.positionKey === positionKey && o.status === 'active'),
            trailingStop: Array.from(this.trailingStops.values())
                .filter(o => o.positionKey === positionKey && o.status === 'active')
        };
    }

    /**
     * Start monitoring prices
     */
    private ensureMonitoring(): void {
        if (this.isMonitoring) return;

        const pairs = this.getAllMonitoredPairs();
        if (pairs.length === 0) return;

        this.priceSubscription = priceFeedSubscription.subscribe(pairs, (prices) => {
            this.checkTriggers(prices);
        });

        this.isMonitoring = true;
        console.log('Order monitoring started');
    }

    /**
     * Get all pairs that need monitoring
     */
    private getAllMonitoredPairs(): string[] {
        const pairs = new Set<string>();

        this.stopLossOrders.forEach(o => {
            if (o.status === 'active') pairs.add(o.pair);
        });
        this.takeProfitOrders.forEach(o => {
            if (o.status === 'active') pairs.add(o.pair);
        });
        this.trailingStops.forEach(o => {
            if (o.status === 'active') pairs.add(o.pair);
        });

        return Array.from(pairs);
    }

    /**
     * Check if any orders should trigger
     */
    private async checkTriggers(prices: Record<string, any>): Promise<void> {
        // Check stop-loss orders
        for (const [_id, order] of this.stopLossOrders) {
            if (order.status !== 'active') continue;

            const price = prices[order.pair]?.price;
            if (!price) continue;

            const shouldTrigger = order.side === 'long'
                ? price <= order.triggerPrice
                : price >= order.triggerPrice;

            if (shouldTrigger) {
                await this.executeOrder(order, 'stop-loss', price);
            }
        }

        // Check take-profit orders
        for (const [_id, order] of this.takeProfitOrders) {
            if (order.status !== 'active') continue;

            const price = prices[order.pair]?.price;
            if (!price) continue;

            const shouldTrigger = order.side === 'long'
                ? price >= order.triggerPrice
                : price <= order.triggerPrice;

            if (shouldTrigger) {
                await this.executeOrder(order, 'take-profit', price);
            }
        }

        // Update and check trailing stops
        for (const [_id, order] of this.trailingStops) {
            if (order.status !== 'active') continue;

            const price = prices[order.pair]?.price;
            if (!price) continue;

            // Update highest/lowest and recalculate trigger
            if (order.side === 'long') {
                if (price > order.highestPrice) {
                    order.highestPrice = price;
                    order.currentTriggerPrice = price * (1 - order.trailingPercent / 100);
                }

                if (price <= order.currentTriggerPrice) {
                    await this.executeOrder(order, 'trailing-stop', price);
                }
            } else {
                if (price < order.lowestPrice) {
                    order.lowestPrice = price;
                    order.currentTriggerPrice = price * (1 + order.trailingPercent / 100);
                }

                if (price >= order.currentTriggerPrice) {
                    await this.executeOrder(order, 'trailing-stop', price);
                }
            }
        }
    }

    /**
     * Execute an order (close position)
     */
    private async executeOrder(
        order: StopLossOrder | TakeProfitOrder | TrailingStopOrder,
        type: string,
        currentPrice: number
    ): Promise<void> {
        console.log(`Executing ${type} order: ${order.id} at $${currentPrice}`);

        try {
            // Get position details to calculate size
            // For now, use a placeholder - in production, query the position
            const sizeUsd = 1000 * (order.sizePercent / 100);

            const result = await moonlanderIntegration.closePosition({
                positionKey: order.positionKey,
                sizeUsd,
                acceptableSlippage: 1.0,
                currentPrice
            });

            order.status = 'triggered';
            this.persistOrders();

            console.log(`${type} executed: ${result.txHash}`);
        } catch (error) {
            console.error(`Failed to execute ${type}:`, error);
            // Don't mark as triggered - will retry on next price update
        }
    }

    /**
     * Persist orders to local storage (for browser persistence)
     */
    private persistOrders(): void {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('relay_stop_loss_orders',
                JSON.stringify(Array.from(this.stopLossOrders.values()))
            );
            localStorage.setItem('relay_take_profit_orders',
                JSON.stringify(Array.from(this.takeProfitOrders.values()))
            );
            localStorage.setItem('relay_trailing_stops',
                JSON.stringify(Array.from(this.trailingStops.values()))
            );
        }
    }

    /**
     * Load orders from local storage
     */
    loadPersistedOrders(): void {
        if (typeof localStorage === 'undefined') return;

        try {
            const sl = localStorage.getItem('relay_stop_loss_orders');
            if (sl) {
                const orders = JSON.parse(sl) as StopLossOrder[];
                orders.filter(o => o.status === 'active').forEach(o => {
                    this.stopLossOrders.set(o.id, o);
                });
            }

            const tp = localStorage.getItem('relay_take_profit_orders');
            if (tp) {
                const orders = JSON.parse(tp) as TakeProfitOrder[];
                orders.filter(o => o.status === 'active').forEach(o => {
                    this.takeProfitOrders.set(o.id, o);
                });
            }

            const ts = localStorage.getItem('relay_trailing_stops');
            if (ts) {
                const orders = JSON.parse(ts) as TrailingStopOrder[];
                orders.filter(o => o.status === 'active').forEach(o => {
                    this.trailingStops.set(o.id, o);
                });
            }

            if (this.stopLossOrders.size > 0 || this.takeProfitOrders.size > 0 || this.trailingStops.size > 0) {
                this.ensureMonitoring();
            }
        } catch (error) {
            console.error('Failed to load persisted orders:', error);
        }
    }
}

// ============================================
// DCA (Dollar Cost Averaging) MANAGER
// ============================================

class DCAManager {
    private configs: Map<string, DCAConfig> = new Map();
    private timers: Map<string, NodeJS.Timeout> = new Map();

    /**
     * Create a new DCA configuration
     */
    createDCA(params: {
        pair: string;
        side: 'long' | 'short';
        totalAmount: number;
        numOrders: number;
        interval: 'hourly' | 'daily' | 'weekly';
        leverage: number;
    }): DCAConfig {
        const intervalMs = {
            hourly: 60 * 60 * 1000,
            daily: 24 * 60 * 60 * 1000,
            weekly: 7 * 24 * 60 * 60 * 1000
        };

        const config: DCAConfig = {
            id: `dca_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            pair: params.pair,
            side: params.side,
            totalAmount: params.totalAmount,
            numOrders: params.numOrders,
            interval: params.interval,
            leverage: params.leverage,
            completedOrders: 0,
            status: 'active',
            nextExecutionTime: new Date(Date.now() + intervalMs[params.interval]),
            createdAt: new Date()
        };

        this.configs.set(config.id, config);
        this.scheduleDCA(config);
        this.persistConfigs();

        console.log(`DCA created: ${config.id} - ${params.numOrders} orders of $${params.totalAmount / params.numOrders} each`);
        return config;
    }

    /**
     * Pause a DCA configuration
     */
    pauseDCA(id: string): boolean {
        const config = this.configs.get(id);
        if (!config) return false;

        config.status = 'paused';

        const timer = this.timers.get(id);
        if (timer) {
            clearTimeout(timer);
            this.timers.delete(id);
        }

        this.persistConfigs();
        return true;
    }

    /**
     * Resume a paused DCA
     */
    resumeDCA(id: string): boolean {
        const config = this.configs.get(id);
        if (!config || config.status !== 'paused') return false;

        config.status = 'active';
        config.nextExecutionTime = new Date(Date.now() + this.getIntervalMs(config.interval));

        this.scheduleDCA(config);
        this.persistConfigs();
        return true;
    }

    /**
     * Cancel a DCA
     */
    cancelDCA(id: string): boolean {
        const config = this.configs.get(id);
        if (!config) return false;

        config.status = 'cancelled';

        const timer = this.timers.get(id);
        if (timer) {
            clearTimeout(timer);
            this.timers.delete(id);
        }

        this.persistConfigs();
        return true;
    }

    /**
     * Get all DCA configurations
     */
    getAllDCAs(): DCAConfig[] {
        return Array.from(this.configs.values());
    }

    /**
     * Schedule the next DCA execution
     */
    private scheduleDCA(config: DCAConfig): void {
        if (config.status !== 'active') return;
        if (config.completedOrders >= config.numOrders) {
            config.status = 'completed';
            this.persistConfigs();
            return;
        }

        const delay = config.nextExecutionTime.getTime() - Date.now();

        const timer = setTimeout(async () => {
            await this.executeDCAOrder(config);
        }, Math.max(0, delay));

        this.timers.set(config.id, timer);
    }

    /**
     * Execute a single DCA order
     */
    private async executeDCAOrder(config: DCAConfig): Promise<void> {
        if (config.status !== 'active') return;

        const orderAmount = config.totalAmount / config.numOrders;

        console.log(`Executing DCA order ${config.completedOrders + 1}/${config.numOrders} for $${orderAmount}`);

        try {
            // Get current price
            const prices = priceFeedSubscription.getLatestPrices();
            const currentPrice = prices[config.pair]?.price;

            if (!currentPrice) {
                console.error('No price available for DCA execution');
                // Reschedule
                config.nextExecutionTime = new Date(Date.now() + 60000); // Retry in 1 minute
                this.scheduleDCA(config);
                return;
            }

            // Execute trade
            const result = await moonlanderIntegration.openPosition({
                pair: config.pair,
                isLong: config.side === 'long',
                collateralUsd: orderAmount / config.leverage,
                sizeUsd: orderAmount,
                leverage: config.leverage,
                acceptableSlippage: 1.0,
                currentPrice
            });

            console.log(`DCA order executed: ${result.txHash}`);

            // Update config
            config.completedOrders++;
            config.nextExecutionTime = new Date(Date.now() + this.getIntervalMs(config.interval));

            if (config.completedOrders >= config.numOrders) {
                config.status = 'completed';
                console.log(`DCA ${config.id} completed!`);
            } else {
                // Schedule next order
                this.scheduleDCA(config);
            }

            this.persistConfigs();
        } catch (error) {
            console.error('DCA order execution failed:', error);
            // Reschedule for retry
            config.nextExecutionTime = new Date(Date.now() + 5 * 60000); // Retry in 5 minutes
            this.scheduleDCA(config);
        }
    }

    private getIntervalMs(interval: 'hourly' | 'daily' | 'weekly'): number {
        const intervals = {
            hourly: 60 * 60 * 1000,
            daily: 24 * 60 * 60 * 1000,
            weekly: 7 * 24 * 60 * 60 * 1000
        };
        return intervals[interval];
    }

    private persistConfigs(): void {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('relay_dca_configs',
                JSON.stringify(Array.from(this.configs.values()))
            );
        }
    }

    loadPersistedConfigs(): void {
        if (typeof localStorage === 'undefined') return;

        try {
            const saved = localStorage.getItem('relay_dca_configs');
            if (saved) {
                const configs = JSON.parse(saved) as DCAConfig[];
                configs.forEach(c => {
                    c.nextExecutionTime = new Date(c.nextExecutionTime);
                    c.createdAt = new Date(c.createdAt);
                    this.configs.set(c.id, c);

                    if (c.status === 'active') {
                        this.scheduleDCA(c);
                    }
                });
            }
        } catch (error) {
            console.error('Failed to load DCA configs:', error);
        }
    }
}

// Export singleton instances
export const orderManager = new OrderManager();
export const dcaManager = new DCAManager();

// Initialize on load
if (typeof window !== 'undefined') {
    orderManager.loadPersistedOrders();
    dcaManager.loadPersistedConfigs();
}
