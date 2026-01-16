/**
 * Debug Script: Test VVS and Moonlander Price Sources
 * 
 * Run this in browser console to debug why sources are failing
 */

// Test 1: Check environment variables
console.log('=== Environment Variables ===');
console.log('VVS API Key (338):', import.meta.env.VITE_VVS_API_CLIENT_ID_338);
console.log('VVS API Key (25):', import.meta.env.VITE_VVS_API_CLIENT_ID_25);
console.log('Moonlander Address:', import.meta.env.VITE_MOONLANDER_ADDRESS);

// Test 2: Test VVS API directly
async function testVVS() {
    console.log('\n=== Testing VVS Finance ===');
    const apiKey = import.meta.env.VITE_VVS_API_CLIENT_ID_25;

    if (!apiKey) {
        console.error('[ERROR] VVS API key is missing!');
        return;
    }

    try {
        const response = await fetch('https://public-api.vvs.finance/api/v1/quote', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-client-id': apiKey
            },
            body: JSON.stringify({
                chain: 'CRONOS',
                currencyIn: '0x062E66477Faf219F25D27dCED647BF57C3107d52', // WBTC
                currencyOut: '0xc21223249CA28397B4B6541dfFaEcC539BfF0c59', // USDC
                amount: '100000000', // 1 WBTC (8 decimals)
                tradeType: 'EXACT_INPUT',
                maxHops: 2,
                maxSplits: 2,
                poolTypes: ['V2', 'V3_100', 'V3_500', 'V3_3000', 'V3_10000']
            })
        });

        console.log('VVS Response Status:', response.status);
        const data = await response.json();
        console.log('VVS Response:', data);

        if (data.code === 0 && data.data?.quote?.outputAmount) {
            const price = Number(ethers.formatUnits(data.data.quote.outputAmount, 6));
            console.log('[OK] VVS BTC Price:', price);
        } else {
            console.error('[ERROR] VVS returned error:', data);
        }
    } catch (error) {
        console.error('[ERROR] VVS API Error:', error);
    }
}

// Test 3: Test Moonlander contract
async function testMoonlander() {
    console.log('\n=== Testing Moonlander ===');

    try {
        const provider = new ethers.JsonRpcProvider('https://evm.cronos.org');
        const contract = new ethers.Contract(
            '0xE6F6351fb66f3a35313fEEFF9116698665FBEeC9',
            ['function getMaxPrice(address token) external view returns (uint256)'],
            provider
        );

        const btcAddress = '0x062E66477Faf219F25D27dCED647BF57C3107d52';
        console.log('Calling getMaxPrice for BTC...');

        const price = await contract.getMaxPrice(btcAddress);
        console.log('Raw price:', price.toString());

        const formattedPrice = Number(ethers.formatUnits(price, 30));
        console.log('Formatted price:', formattedPrice);

        if (formattedPrice > 0) {
            console.log('[OK] Moonlander BTC Price:', formattedPrice);
        } else {
            console.error('[ERROR] Moonlander returned 0');
        }
    } catch (error) {
        console.error('[ERROR] Moonlander Error:', error);
    }
}

// Test 4: Check price aggregator
async function testAggregator() {
    console.log('\n=== Testing Price Aggregator ===');

    try {
        const { multiDexAggregator } = await import('/src/services/prices/price-aggregator.ts');
        const result = await multiDexAggregator.getAggregatedPrice('BTC/USD');

        console.log('Aggregator Result:', result);
        console.log('Best Price:', result.bestPrice);
        console.log('Best Source:', result.bestSource);
        console.log('All Sources:', result.sources);

        // Check which sources failed
        const sourceNames = ['Pyth Oracle', 'Moonlander', 'VVS Finance', 'MM Finance', 'GMX'];
        const missingSources = sourceNames.filter(name =>
            !result.sources.find(s => s.name === name)
        );

        if (missingSources.length > 0) {
            console.warn('[WARN] Missing sources:', missingSources);
        } else {
            console.log('[OK] All 5 sources working!');
        }
    } catch (error) {
        console.error('[ERROR] Aggregator Error:', error);
    }
}

// Run all tests
console.log('[DEBUG] Starting Price Source Debug Tests...\n');
await testVVS();
await testMoonlander();
await testAggregator();
console.log('\n[OK] Debug tests complete!');
