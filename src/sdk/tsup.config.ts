import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['index.ts'],
    format: ['cjs', 'esm'],
    platform: 'node',
    target: 'node18',
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    // Exclude test files
    ignoreWatch: ['**/*.test.ts'],
    skipNodeModulesBundle: true,
    external: ['fsevents', 'express', 'ethers', '@crypto.com/facilitator-client', 'siwe', '@reown/appkit'],
    loader: {
        '.node': 'empty',
    },
});
