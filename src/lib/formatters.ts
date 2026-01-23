/**
 * Currency and Number Formatters
 * 
 * Handles proper formatting for USDC (6 decimals) and other currencies
 */

/**
 * Format USDC amount from base units (1e6) to human-readable
 * @param amount - Amount in base units (e.g., "1000000" for 1 USDC)
 * @returns Formatted string (e.g., "1.00")
 */
export function formatUSDC(amount: string | number): string {
    const value = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(value)) return '0.00';
    return (value / 1e6).toFixed(2);
}

/**
 * Format USDC with currency symbol
 * @param amount - Amount in base units
 * @returns Formatted string with symbol (e.g., "$1.00")
 */
export function formatUSDCWithSymbol(amount: string | number): string {
    return `$${formatUSDC(amount)}`;
}

/**
 * Format USDC with USDC label
 * @param amount - Amount in base units
 * @returns Formatted string with label (e.g., "1.00 USDC")
 */
export function formatUSDCWithLabel(amount: string | number): string {
    return `${formatUSDC(amount)} USDC`;
}

/**
 * Format large numbers with commas
 * @param value - Number to format
 * @returns Formatted string (e.g., "1,000,000")
 */
export function formatNumber(value: number): string {
    return value.toLocaleString('en-US');
}

/**
 * Format percentage
 * @param value - Decimal value (e.g., 0.95 for 95%)
 * @returns Formatted string (e.g., "95.00%")
 */
export function formatPercentage(value: number): string {
    return `${(value * 100).toFixed(2)}%`;
}

/**
 * Shorten address for display
 * @param address - Ethereum address
 * @param chars - Number of chars to show on each side
 * @returns Shortened address (e.g., "0x1234...5678")
 */
export function shortenAddress(address: string, chars = 4): string {
    if (!address) return '';
    return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}
