# Relay Core LangGraph Chatbot

Production-grade chatbot architecture using LangGraph for agentic finance operations.

## Architecture Overview

This chatbot is a **control plane**, not an execution engine. It orchestrates operations but never directly executes transactions or signs messages.

### Core Principles

1. **LLM Never Reads MCP/DB Directly**: All data access goes through tools
2. **Tools Are Execution Boundaries**: Tools execute, LLM reasons
3. **No Fabrication**: If data isn't available, say so explicitly
4. **Approval Gates**: Risky operations require explicit user approval
5. **Deterministic Flow**: State graph ensures predictable behavior

## Graph Structure

```
START
  ↓
validate_input
  ↓
classify_intent
  ↓
[query/explain] → retrieve_context → make_decision
[simulate] → run_simulation → synthesize_response
[execute] → make_decision
  ↓
make_decision
  ↓
[needs_approval] → generate_approval → synthesize_response
[needs_tools] → execute_tools → synthesize_response
  ↓
synthesize_response
  ↓
update_memory
  ↓
END
```

### Node Responsibilities

1. **validate_input**: Validates message format, normalizes addresses
2. **classify_intent**: Determines user intent (query/execute/explain/simulate)
3. **retrieve_context**: RAG retrieval from vector store (TODO)
4. **make_decision**: Decides if tools are needed
5. **execute_tools**: Executes tools in parallel
6. **run_simulation**: Dry-runs operations
7. **generate_approval**: Creates approval actions for risky ops
8. **synthesize_response**: Converts tool outputs to human response
9. **update_memory**: Persists conversation (TODO)

## Tools

### Query Tools (Read-only)
- `query_indexer`: Query blockchain data from Supabase
- `get_service_metrics`: Get service reputation/performance
- `get_market_price`: Get real-time prices from Pyth Oracle
- `discover_services`: Search marketplace

### Simulation Tools
- `simulate_payment`: Dry-run payment without executing
- `estimate_fees`: Calculate gas/service fees

### Approval Tools
- `generate_handoff_url`: Create URL for wallet signing

## Usage

### Basic Chat
```typescript
import { processChat } from './services/chat';

const result = await processChat(
    'What is the current BTC price?',
    { walletAddress: '0x...' }
);

console.log(result.response);
// Tool calls are in result.toolCalls
```

### With Approval Flow
```typescript
const result = await processChat(
    'Pay 10 USDC to service xyz',
    { walletAddress: '0x...' }
);

if (result.requiresApproval) {
    // Show approval UI
    console.log(result.approvalActions);
}
```

### Direct Graph Invocation
```typescript
import { relayChatGraph } from './services/chat';

const result = await relayChatGraph.invoke({
    messages: [{ role: 'user', content: 'Show my recent transactions' }],
    context: { walletAddress: '0x...' },
});
```

## Installation

### Dependencies
```bash
npm install @langchain/langgraph @langchain/core @langchain/anthropic chromadb zod --legacy-peer-deps
```

### Environment Variables
```bash
ANTHROPIC_API_KEY=sk-ant-...
VITE_APP_URL=http://localhost:5173
```

## Security

### API Keys
- Loaded from environment variables only
- Never logged or stored in state
- Never exposed in responses

### Tool Execution
- All tools return structured JSON
- Tools fail explicitly with error codes
- No raw database connections exposed

### Approval Requirements
Operations that require approval:
- Spending money
- Modifying on-chain state
- Creating sessions
- Releasing payments

## Memory Strategy

### Short-term (Current)
- LangGraph state holds current conversation
- Last 10 messages kept in state
- Older messages summarized

### Long-term (TODO)
- Store summaries in Supabase
- Index by walletAddress
- Retrieve via RAG

## RAG Strategy (TODO)

### Vector Store
- Chroma for document storage
- Index documentation from `docs/`
- Index service descriptions
- Semantic search on queries

## Testing

### Unit Tests
```bash
npm test src/services/chat/nodes.test.ts
```

### Integration Tests
```bash
npm test src/services/chat/graph.test.ts
```

### Manual Testing
```bash
npm run dev:graphql
# Then use GraphQL playground to test chat queries
```

## Migration from Old Implementation

### Removed Patterns
1. ❌ Direct Claude API calls without state management
2. ❌ MCP tools as "context" for LLM
3. ❌ Manual conversation history management
4. ❌ Markdown stripping in code (moved to prompt)
5. ❌ Tool execution inside LLM loop

### New Patterns
1. ✅ LangGraph state management
2. ✅ Tools as execution boundaries
3. ✅ Proper intent classification
4. ✅ Conditional routing
5. ✅ Approval gates for risky ops

## Troubleshooting

### "Tool not found" error
- Check tool is registered in `tools.ts`
- Verify tool name matches exactly

### "No response generated"
- Check Anthropic API key is set
- Verify message format is correct
- Check logs for errors

### Tools not executing
- Verify Supabase connection
- Check tool schemas match input
- Review logs for execution errors

## Future Enhancements

1. **RAG Implementation**: Add Chroma vector store
2. **Memory Persistence**: Save conversations to Supabase
3. **Multi-turn Context**: Improve conversation coherence
4. **Streaming Responses**: Add streaming support
5. **Tool Composition**: Chain tools automatically

## Files

- `graph-state.ts`: State schema definition
- `tools.ts`: Tool definitions with Zod schemas
- `nodes.ts`: Graph node implementations
- `graph.ts`: Main graph definition
- `index.ts`: Public exports
