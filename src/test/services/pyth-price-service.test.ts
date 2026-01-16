import { describe, it, expect } from 'vitest';
import { pythPriceService } from '@/services/prices/pyth-price-service';

describe('Pyth Price Service', () => {
    it('should get BTC price', async () => {
        const price = await pythPriceService.getPrice('BTC/USD');
        expect(price).toBeGreaterThan(0);
    });

    it('should cache prices', async () => {
        const price1 = await pythPriceService.getPrice('ETH/USD');
        const price2 = await pythPriceService.getPrice('ETH/USD');

        // Should return same cached value
        expect(price1).toBe(price2);
    });

    it('should get multiple prices', async () => {
        const prices = await pythPriceService.getPrices(['BTC/USD', 'ETH/USD']);

        expect(prices).toHaveProperty('BTC/USD');
        expect(prices).toHaveProperty('ETH/USD');
        expect(prices['BTC/USD']).toBeGreaterThan(0);
        expect(prices['ETH/USD']).toBeGreaterThan(0);
    });
});
