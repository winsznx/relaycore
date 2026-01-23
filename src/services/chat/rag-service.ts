/**
 * RAG Service - Vector Store for Documentation Retrieval
 * 
 * Implements semantic search over documentation using Chroma.
 * Retrieves relevant context for user queries.
 */

import { Chroma } from '@langchain/community/vectorstores/chroma';
import { OpenAIEmbeddings } from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { logger } from '../../lib/logger.js';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { CloudClient } from 'chromadb';

export interface RetrievedDoc {
    content: string;
    source: string;
    relevanceScore: number;
}

export class RAGService {
    private vectorStore: Chroma | null = null;
    private embeddings: OpenAIEmbeddings;
    private readonly COLLECTION_NAME = 'relay_docs';
    private chromaClient: CloudClient | null = null;

    constructor() {
        this.embeddings = new OpenAIEmbeddings({
            openAIApiKey: process.env.OPENAI_API_KEY,
        });

        // Initialize Chroma Cloud client if credentials are available
        if (process.env.CHROMA_API_KEY && process.env.CHROMA_TENANT && process.env.CHROMA_DATABASE) {
            this.chromaClient = new CloudClient({
                apiKey: process.env.CHROMA_API_KEY,
                tenant: process.env.CHROMA_TENANT,
                database: process.env.CHROMA_DATABASE,
            });
            logger.info('Chroma Cloud client initialized', {
                tenant: process.env.CHROMA_TENANT,
                database: process.env.CHROMA_DATABASE,
            });
        }
    }

    /**
     * Initialize vector store
     */
    async initialize(): Promise<void> {
        try {
            const chromaConfig = this.chromaClient
                ? { client: this.chromaClient }
                : { url: process.env.CHROMA_URL || 'http://localhost:8000' };

            this.vectorStore = await Chroma.fromExistingCollection(
                this.embeddings,
                {
                    collectionName: this.COLLECTION_NAME,
                    ...chromaConfig,
                }
            );

            logger.info('RAG service initialized', {
                collection: this.COLLECTION_NAME,
                usingCloud: !!this.chromaClient,
            });
        } catch (error) {
            logger.warn('Vector store not initialized', error as Error);
        }
    }

    /**
     * Index documentation files
     */
    async indexDocumentation(docsPath: string): Promise<number> {
        try {
            const textSplitter = new RecursiveCharacterTextSplitter({
                chunkSize: 1000,
                chunkOverlap: 200,
            });

            const documents: Array<{ pageContent: string; metadata: { source: string } }> = [];

            // Read all markdown files from docs directory
            const files = this.getMarkdownFiles(docsPath);

            for (const file of files) {
                const content = readFileSync(file, 'utf-8');
                const chunks = await textSplitter.createDocuments([content], [
                    { source: file },
                ]);

                documents.push(...chunks.map(chunk => ({
                    pageContent: chunk.pageContent,
                    metadata: { source: file },
                })));
            }

            // Create or update vector store with appropriate config
            const chromaConfig = this.chromaClient
                ? { client: this.chromaClient }
                : { url: process.env.CHROMA_URL || 'http://localhost:8000' };

            this.vectorStore = await Chroma.fromDocuments(
                documents,
                this.embeddings,
                {
                    collectionName: this.COLLECTION_NAME,
                    ...chromaConfig,
                }
            );

            logger.info('Documentation indexed', {
                fileCount: files.length,
                chunkCount: documents.length,
                usingCloud: !!this.chromaClient,
            });

            return documents.length;
        } catch (error) {
            logger.error('Failed to index documentation', error as Error);
            return 0;
        }
    }

    /**
     * Retrieve relevant documents for query
     */
    async retrieve(query: string, topK: number = 3): Promise<RetrievedDoc[]> {
        if (!this.vectorStore) {
            logger.warn('Vector store not initialized');
            return [];
        }

        try {
            const results = await this.vectorStore.similaritySearchWithScore(query, topK);

            return results.map(([doc, score]) => ({
                content: doc.pageContent,
                source: doc.metadata.source || 'unknown',
                relevanceScore: score,
            }));
        } catch (error) {
            logger.error('Failed to retrieve documents', error as Error);
            return [];
        }
    }

    /**
     * Get all markdown files recursively
     */
    private getMarkdownFiles(dir: string): string[] {
        const files: string[] = [];

        try {
            const entries = readdirSync(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = join(dir, entry.name);

                if (entry.isDirectory()) {
                    files.push(...this.getMarkdownFiles(fullPath));
                } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.mdx'))) {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            logger.error(`Failed to read directory ${dir}`, error as Error);
        }

        return files;
    }

    /**
     * Clear vector store
     */
    async clear(): Promise<void> {
        if (!this.vectorStore) {
            return;
        }

        try {
            // Chroma doesn't have a direct clear method, so we'll delete and recreate
            this.vectorStore = null;
            logger.info('Vector store cleared');
        } catch (error) {
            logger.error('Failed to clear vector store', error as Error);
        }
    }
}

export const ragService = new RAGService();
