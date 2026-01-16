export default function DocsClaudeGuide() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-4">Claude AI Integration Guide</h1>
                <p className="text-lg text-gray-600">
                    Integrating Anthropic Claude with Model Context Protocol for trading intelligence.
                </p>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Setup</h2>
                <p className="text-gray-700">Install required packages:</p>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`npm install @anthropic-ai/sdk @modelcontextprotocol/sdk`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Initialize Claude Client</h2>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function chatWithAgent(
  message: string,
  context?: { walletAddress?: string }
) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: \`You are a DeFi trading assistant. 
             You help users execute trades on Cronos DEXs.
             User wallet: \${context?.walletAddress || 'Not connected'}\`,
    messages: [
      { role: 'user', content: message }
    ],
    tools: TRADING_TOOLS
  });
  
  return response;
}`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Define Tools</h2>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`const TRADING_TOOLS = [
  {
    name: 'get_crypto_price',
    description: 'Get real-time cryptocurrency price from Crypto.com',
    input_schema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Crypto symbol (e.g., BTC, ETH)'
        },
        currency: {
          type: 'string',
          description: 'Fiat currency (e.g., USD)',
          default: 'USD'
        }
      },
      required: ['symbol']
    }
  },
  {
    name: 'get_trade_quote',
    description: 'Get best trade quote across all venues',
    input_schema: {
      type: 'object',
      properties: {
        pair: { type: 'string' },
        side: { type: 'string', enum: ['long', 'short'] },
        leverage: { type: 'number' },
        sizeUsd: { type: 'number' }
      },
      required: ['pair', 'side', 'leverage', 'sizeUsd']
    }
  }
];`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Handle Tool Calls</h2>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`async function handleToolCall(toolName: string, toolInput: any) {
  switch (toolName) {
    case 'get_crypto_price':
      const price = await fetchCryptoPrice(
        toolInput.symbol,
        toolInput.currency
      );
      return { price, symbol: toolInput.symbol };
      
    case 'get_trade_quote':
      const quote = await getTradeQuote(toolInput);
      return quote;
      
    default:
      throw new Error(\`Unknown tool: \${toolName}\`);
  }
}

// Process tool use in response
if (response.stop_reason === 'tool_use') {
  const toolUse = response.content.find(
    block => block.type === 'tool_use'
  );
  
  const toolResult = await handleToolCall(
    toolUse.name,
    toolUse.input
  );
  
  // Continue conversation with tool result
  const followUp = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      ...previousMessages,
      { role: 'assistant', content: response.content },
      {
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(toolResult)
        }]
      }
    ]
  });
}`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">MCP Integration</h2>
                <p className="text-gray-700">Connect to Crypto.com MCP server:</p>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'npx',
  args: ['-y', '@cryptocom/mcp-server']
});

const mcpClient = new Client({
  name: 'relay-core-client',
  version: '1.0.0'
}, {
  capabilities: {}
});

await mcpClient.connect(transport);

// Call MCP tool
const result = await mcpClient.callTool({
  name: 'get_crypto_price',
  arguments: {
    symbol: 'BTC',
    currency: 'USD'
  }
});`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Best Practices</h2>
                <ul className="space-y-3 text-gray-700">
                    <li className="flex items-start gap-3">
                        <span className="text-gray-400">•</span>
                        <span>Always validate tool inputs before execution</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="text-gray-400">•</span>
                        <span>Implement rate limiting to avoid API quota issues</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="text-gray-400">•</span>
                        <span>Cache MCP responses when appropriate</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="text-gray-400">•</span>
                        <span>Handle errors gracefully and provide user feedback</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="text-gray-400">•</span>
                        <span>Keep conversation history for context (last 10 messages)</span>
                    </li>
                </ul>
            </div>
        </div>
    );
}
