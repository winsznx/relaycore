// Basic polyfill for node:crypto using Web Crypto API
const cryptoPolyfill = {
    getRandomValues: (buffer: any) => window.crypto.getRandomValues(buffer),
    randomBytes: (size: number) => {
        const buffer = new Uint8Array(size);
        window.crypto.getRandomValues(buffer);
        return buffer;
    },
    createHash: (algo: string) => {
        // Very basic placeholder - for full support we'd need a library
        console.warn('crypto.createHash called in browser - not fully supported');
        return {
            update: () => ({ digest: () => 'mock-hash' }),
        };
    }
};

export default cryptoPolyfill;
export const getRandomValues = cryptoPolyfill.getRandomValues;
export const randomBytes = cryptoPolyfill.randomBytes;
export const createHash = cryptoPolyfill.createHash;
