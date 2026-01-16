/**
 * Relay Core System Initialization
 * 
 * Entry point for starting the indexer suite.
 */

import { startIndexers, stopIndexers } from './services/indexer/index.js';

async function main(): Promise<void> {
    console.log('Relay Core Indexer Suite');
    console.log('========================\n');

    await startIndexers();
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
