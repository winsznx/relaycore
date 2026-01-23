/**
 * RAG Initialization Script
 * 
 * Indexes documentation into Chroma vector store.
 * Run this after installing dependencies to set up RAG.
 */

import { ragService } from '../services/chat/rag-service.js';
import { logger } from '../lib/logger.js';
import { resolve } from 'path';

async function initializeRAG() {
    logger.info('Starting RAG initialization...');

    try {
        // Initialize vector store
        await ragService.initialize();

        // Index documentation
        const docsPath = resolve(process.cwd(), 'docs');
        logger.info(`Indexing documentation from: ${docsPath}`);

        const chunkCount = await ragService.indexDocumentation(docsPath);

        logger.info('RAG initialization complete', {
            chunksIndexed: chunkCount,
        });

        console.log('\n✓ RAG service initialized successfully!');
        console.log(`  - Indexed ${chunkCount} document chunks`);
        console.log(`  - Vector store ready for queries\n`);

        process.exit(0);
    } catch (error) {
        logger.error('RAG initialization failed', error as Error);
        console.error('\n✗ RAG initialization failed:', (error as Error).message);
        console.error('\nMake sure:');
        console.error('  1. Chroma is running (docker run -p 8000:8000 chromadb/chroma)');
        console.error('  2. OPENAI_API_KEY is set in .env');
        console.error('  3. Documentation exists in docs/ directory\n');
        process.exit(1);
    }
}

initializeRAG();
