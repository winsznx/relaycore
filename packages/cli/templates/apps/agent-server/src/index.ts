import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { RelayCore } from '@relaycore/sdk';
import dotenv from 'dotenv';

dotenv.config();

const server = new Server(
    {
        name: 'relaycore-agent',
        version: '0.1.0',
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

const relaycore = new RelayCore({
    apiKey: process.env.RELAYCORE_API_KEY!,
    environment: process.env.RELAYCORE_ENVIRONMENT as 'testnet' | 'mainnet' || 'testnet',
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: 'execute_task',
                description: 'Execute a task using RelayCore services',
                inputSchema: {
                    type: 'object',
                    properties: {
                        task: {
                            type: 'string',
                            description: 'The task to execute',
                        },
                        context: {
                            type: 'object',
                            description: 'Additional context for the task',
                        },
                    },
                    required: ['task'],
                },
            },
        ],
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === 'execute_task') {
        const { task, context } = request.params.arguments as {
            task: string;
            context?: Record<string, unknown>;
        };

        return {
            content: [
                {
                    type: 'text',
                    text: `Executing task: ${task}\nContext: ${JSON.stringify(context, null, 2)}`,
                },
            ],
        };
    }

    throw new Error(`Unknown tool: ${request.params.name}`);
});

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('RelayCore Agent Server running on stdio');
}

main().catch((error) => {
    console.error('Server error:', error);
    process.exit(1);
});
