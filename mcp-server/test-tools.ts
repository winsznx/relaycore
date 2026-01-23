#!/usr/bin/env tsx

/**
 * Test script to verify MCP server tool registration
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const server = new McpServer({
    name: "Test Server",
    version: "1.0.0",
});

// Count registered tools
let toolCount = 0;

// Wrap server.tool to count registrations
const originalTool = server.tool.bind(server);
server.tool = function (name: string, schema: any, handler: any) {
    try {
        toolCount++;
        console.log(`[${toolCount}] Registering: ${name}`);
        return originalTool(name, schema, handler);
    } catch (error) {
        console.error(`[ERROR] Failed to register ${name}:`, error);
        throw error;
    }
} as any;

// Import and run the server initialization
async function test() {
    try {
        // Dynamically import the index file
        await import('./index.js');
        console.log(`\n✅ Total tools registered: ${toolCount}`);
    } catch (error) {
        console.error('❌ Error during registration:', error);
    }
}

test();
