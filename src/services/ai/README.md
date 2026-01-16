# Claude AI Service

AI-powered capabilities for Relay Core using Anthropic's Claude API.

## Features

### 1. **Service Recommendations**
Analyzes user queries and recommends relevant services from the marketplace.

```typescript
import { recommendServices } from './services/ai/claude-service';

const recommendations = await recommendServices(
    "I need to analyze Bitcoin price trends",
    availableServices
);

// Returns:
// [
//   {
//     serviceName: "Crypto Price Oracle",
//     confidence: 0.95,
//     reasoning: "Provides real-time BTC price data and trend analysis",
//     estimatedCost: "0.01 USDC"
//   }
// ]
```

### 2. **Trade Analysis**
Provides intelligent trade recommendations based on market data.

```typescript
import { analyzeTradeOpportunity } from './services/ai/claude-service';

const analysis = await analyzeTradeOpportunity(
    'BTC/USD',
    95000,
    priceHistory
);

// Returns:
// {
//   recommendation: "buy",
//   confidence: 0.75,
//   reasoning: "Upward trend with strong support at $94k",
//   riskLevel: "medium",
//   suggestedAmount: "100 USDC"
// }
```

### 3. **Telegram Bot Responses**
Generates natural, context-aware responses for the Telegram bot.

```typescript
import { generateBotResponse } from './services/ai/claude-service';

const response = await generateBotResponse(
    "What's my reputation score?",
    {
        userName: "Tim",
        walletAddress: "0xaD4F...",
        recentActivity: "3 successful trades today"
    }
);

// Returns natural language response
```

### 4. **Agent Performance Analysis**
Analyzes agent metrics and provides improvement suggestions.

```typescript
import { analyzeAgentPerformance } from './services/ai/claude-service';

const analysis = await analyzeAgentPerformance({
    name: "Price Oracle Agent",
    successRate: 0.98,
    avgLatency: 150,
    totalCalls: 1000,
    reputationScore: 95
});

// Returns detailed performance analysis with recommendations
```

### 5. **General Chat**
Direct access to Claude for custom use cases.

```typescript
import { chat } from './services/ai/claude-service';

const response = await chat(
    [
        { role: 'user', content: 'Explain how Relay Core works' }
    ],
    {
        systemPrompt: 'You are a helpful assistant for Relay Core',
        maxTokens: 1024
    }
);
```

## Environment Setup

Add to `.env`:
```
ANTHROPIC_API_KEY=your_api_key_here
```

## Usage Limits

- **Model**: Claude Sonnet 4 (claude-sonnet-4-20250514)
- **Default Max Tokens**: 1024
- **Temperature**: 0.7-1.0 (depending on use case)

## Integration Examples

### Telegram Bot Integration

```typescript
// In telegram-bot.ts
import { generateBotResponse } from '../ai/claude-service';

bot.on('text', async (ctx) => {
    const response = await generateBotResponse(
        ctx.message.text,
        {
            userName: ctx.from.first_name,
            walletAddress: getUserWallet(ctx.from.id)
        }
    );
    await ctx.reply(response);
});
```

### Service Discovery Integration

```typescript
// In service-discovery.ts
import { recommendServices } from '../ai/claude-service';

app.post('/api/services/recommend', async (req, res) => {
    const { query } = req.body;
    const services = await getAvailableServices();
    const recommendations = await recommendServices(query, services);
    res.json({ recommendations });
});
```

## Error Handling

All functions include error handling and return safe defaults:
- Service recommendations: Returns empty array
- Trade analysis: Returns "hold" with low confidence
- Bot responses: Returns friendly error message

## Cost Optimization

- Responses are cached where appropriate
- Token limits are set conservatively
- System prompts are optimized for conciseness
