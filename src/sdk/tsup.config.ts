import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    // Exclude test files
    ignoreWatch: ['**/*.test.ts'],
    external: ['fsevents', 'express', 'ethers', '@crypto.com/facilitator-client', 'siwe', '@reown/appkit'],
    esbuildOptions(options) {
        options.loader = {
            ...options.loader,
            '.node': 'empty', // or 'file'
        };
    },
});
