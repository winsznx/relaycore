/**
 * Claude AI Service
 * 
 * Provides AI-powered capabilities using Anthropic's Claude API
 * for intelligent agent interactions, service discovery, and trade analysis
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../../lib/logger.js';

// Initialize Claude client
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ClaudeMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface ClaudeResponse {
    content: string;
    usage: {
        inputTokens: number;
        outputTokens: number;
    };
}

export interface ServiceRecommendation {
    serviceName: string;
    confidence: number;
    reasoning: string;
    estimatedCost: string;
}

export interface TradeAnalysis {
    recommendation: 'buy' | 'sell' | 'hold';
    confidence: number;
    reasoning: string;
    riskLevel: 'low' | 'medium' | 'high';
    suggestedAmount?: string;
}



/**
 * Send a message to Claude and get a response
 */
export async function chat(
    messages: ClaudeMessage[],
    options: {
        model?: string;
        maxTokens?: number;
        temperature?: number;
        systemPrompt?: string;
    } = {}
): Promise<ClaudeResponse> {
    try {
        const response = await anthropic.messages.create({
            model: options.model || 'claude-sonnet-4-20250514',
            max_tokens: options.maxTokens || 1024,
            temperature: options.temperature || 1.0,
            system: options.systemPrompt,
            messages: messages.map(msg => ({
                role: msg.role,
                content: msg.content,
            })),
        });

        const textContent = response.content.find(block => block.type === 'text');

        return {
            content: textContent?.type === 'text' ? textContent.text : '',
            usage: {
                inputTokens: response.usage.input_tokens,
                outputTokens: response.usage.output_tokens,
            },
        };
    } catch (error) {
        logger.error('Claude API error', error as Error);
        throw new Error('Failed to get response from Claude');
    }
}

/**
 * Analyze a user query and recommend relevant services
 */
export async function recommendServices(
    userQuery: string,
    availableServices: Array<{ name: string; description: string; category: string; pricePerCall: string }>
): Promise<ServiceRecommendation[]> {
    const systemPrompt = `You are an AI assistant for Relay Core, a decentralized AI agent marketplace on Cronos blockchain.
Your job is to analyze user queries and recommend the most relevant services from the available options.

For each recommendation, provide:
1. Service name (exact match from available services)
2. Confidence score (0-1)
3. Clear reasoning
4. Estimated cost based on the service price

Return your response as a JSON array of recommendations, sorted by confidence (highest first).`;

    const userPrompt = `User Query: "${userQuery}"

Available Services:
${availableServices.map((s, i) => `${i + 1}. ${s.name} - ${s.description} (Category: ${s.category}, Price: ${s.pricePerCall} USDC)`).join('\n')}

Analyze the query and recommend the top 3 most relevant services. Return ONLY a JSON array with this structure:
[
  {
    "serviceName": "exact service name",
    "confidence": 0.95,
    "reasoning": "why this service matches",
    "estimatedCost": "0.01 USDC"
  }
]`;

    try {
        const response = await chat(
            [{ role: 'user', content: userPrompt }],
            { systemPrompt, maxTokens: 2048 }
        );

        // Extract JSON from response
        const jsonMatch = response.content.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            throw new Error('Invalid response format from Claude');
        }

        const recommendations = JSON.parse(jsonMatch[0]) as ServiceRecommendation[];
        return recommendations.slice(0, 3);
    } catch (error) {
        logger.error('Service recommendation error', error as Error);
        return [];
    }
}

/**
 * Analyze market data and provide trade recommendations
 */
export async function analyzeTradeOpportunity(
    symbol: string,
    currentPrice: number,
    priceHistory: Array<{ timestamp: string; price: number }>,
    userContext?: string
): Promise<TradeAnalysis> {
    const systemPrompt = `You are a crypto trading analyst for Relay Core.
Analyze market data and provide actionable trade recommendations.
Consider price trends, volatility, and risk factors.
Be conservative and prioritize user safety.`;

    const userPrompt = `Analyze this trading opportunity:

Symbol: ${symbol}
Current Price: $${currentPrice}

Recent Price History (last 24h):
${priceHistory.slice(-10).map(p => `${p.timestamp}: $${p.price}`).join('\n')}

${userContext ? `User Context: ${userContext}` : ''}

Provide a trade analysis with:
1. Recommendation (buy/sell/hold)
2. Confidence level (0-1)
3. Clear reasoning
4. Risk level (low/medium/high)
5. Suggested amount (if buying)

Return ONLY a JSON object with this structure:
{
  "recommendation": "buy",
  "confidence": 0.75,
  "reasoning": "detailed analysis",
  "riskLevel": "medium",
  "suggestedAmount": "100 USDC"
}`;

    try {
        const response = await chat(
            [{ role: 'user', content: userPrompt }],
            { systemPrompt, maxTokens: 1024, temperature: 0.7 }
        );

        // Extract JSON from response
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Invalid response format from Claude');
        }

        return JSON.parse(jsonMatch[0]) as TradeAnalysis;
    } catch (error) {
        logger.error('Trade analysis error', error as Error);
        return {
            recommendation: 'hold',
            confidence: 0,
            reasoning: 'Unable to analyze market conditions',
            riskLevel: 'high',
        };
    }
}

/**
 * Generate a natural language response for Telegram bot
 */
export async function generateBotResponse(
    userMessage: string,
    context: {
        userName?: string;
        walletAddress?: string;
        recentActivity?: string;
    }
): Promise<string> {
    const systemPrompt = `You are the Relay Core Telegram bot assistant.
You help users interact with the Relay Core platform - a decentralized AI agent marketplace on Cronos.

Your capabilities:
- Check service status and reputation
- View payment history
- Get real-time notifications
- Answer questions about the platform

Be helpful, concise, and friendly. Use emojis sparingly.
If you don't know something, be honest and suggest checking the dashboard.`;

    const contextInfo = `
User: ${context.userName || 'Guest'}
Wallet: ${context.walletAddress || 'Not connected'}
${context.recentActivity ? `Recent Activity: ${context.recentActivity}` : ''}
`.trim();

    try {
        const response = await chat(
            [{ role: 'user', content: `${contextInfo}\n\nUser Message: ${userMessage}` }],
            { systemPrompt, maxTokens: 512, temperature: 0.8 }
        );

        return response.content;
    } catch (error) {
        logger.error('Bot response generation error', error as Error);
        return "I'm having trouble processing your request right now. Please try again or check the dashboard at relay-core.xyz";
    }
}

/**
 * Analyze agent performance and suggest improvements
 */
export async function analyzeAgentPerformance(
    agentData: {
        name: string;
        successRate: number;
        avgLatency: number;
        totalCalls: number;
        reputationScore: number;
    }
): Promise<string> {
    const systemPrompt = `You are an AI performance analyst for Relay Core agents.
Analyze agent metrics and provide actionable improvement suggestions.
Focus on reliability, speed, and user satisfaction.`;

    const userPrompt = `Analyze this agent's performance:

Agent: ${agentData.name}
Success Rate: ${(agentData.successRate * 100).toFixed(1)}%
Average Latency: ${agentData.avgLatency}ms
Total Calls: ${agentData.totalCalls}
Reputation Score: ${agentData.reputationScore}/100

Provide:
1. Performance assessment
2. Key strengths
3. Areas for improvement
4. Specific recommendations

Keep it concise and actionable.`;

    try {
        const response = await chat(
            [{ role: 'user', content: userPrompt }],
            { systemPrompt, maxTokens: 1024, temperature: 0.7 }
        );

        return response.content;
    } catch (error) {
        logger.error('Agent performance analysis error', error as Error);
        return 'Unable to analyze agent performance at this time.';
    }
}

export default {
    chat,
    recommendServices,
    analyzeTradeOpportunity,
    generateBotResponse,
    analyzeAgentPerformance,
};
