import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, TrendingUp, AlertCircle, Zap, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAccount } from 'wagmi';

interface ToolCall {
    name: string;
    input: Record<string, unknown>;
    result?: unknown;
    executionTimeMs?: number;
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    toolCalls?: ToolCall[];
    processingTimeMs?: number;
}

/**
 * AI Chat Component
 * 
 * Floating chat interface for Claude AI trading assistant
 * Features:
 * - Real-time crypto data via multi-DEX aggregator
 * - Trade quotes from venues (Moonlander, GMX, Fulcrom)
 * - Tool call visualization with execution times
 * - Venue recommendations and reputation
 */
export function AIChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            role: 'assistant',
            content: 'Hello! I\'m your DeFi trading assistant powered by Claude AI.\n\nI can help you:\n• Check real-time crypto prices from multiple DEX sources\n• Get trade quotes with best venue recommendations\n• Explore services and agents on Relay Core\n\nWhat would you like to do?',
            timestamp: new Date(),
        },
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string>();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { address, isConnected } = useAccount();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            role: 'user',
            content: input,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            // Call Claude API endpoint
            const apiUrl = import.meta.env.VITE_API_URL || 'https://api.relaycore.xyz';
            const response = await fetch(`${apiUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: input,
                    walletAddress: address,
                    conversationHistory: messages.slice(-10).map(m => ({
                        role: m.role,
                        content: m.content,
                    })),
                    sessionId,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to get response');
            }

            const data = await response.json();

            // Update session ID
            if (data.sessionId) {
                setSessionId(data.sessionId);
            }

            const assistantMessage: Message = {
                role: 'assistant',
                content: data.message,
                timestamp: new Date(),
                toolCalls: data.toolCalls,
                processingTimeMs: data.processingTimeMs,
            };

            setMessages((prev) => [...prev, assistantMessage]);
        } catch {
            const errorMessage: Message = {
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.',
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const quickActions = [
        { label: 'BTC Price', message: 'What is the current Bitcoin price?' },
        { label: 'ETH Quote', message: 'Get me a quote for a 10x long on ETH worth $1000' },
        { label: 'Venues', message: 'Show me the trading venue rankings' },
    ];

    return (
        <>
            {/* Floating Chat Button - Responsive positioning */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 group"
                    aria-label="Open AI Chat"
                >
                    <div className="relative">
                        {/* Button - Clean black design, smaller on mobile */}
                        <div className="relative bg-[#111111] text-white p-3 md:p-4 rounded-full shadow-2xl hover:shadow-xl transition-all duration-300 hover:scale-105">
                            <MessageCircle className="h-5 w-5 md:h-6 md:w-6" />
                        </div>

                        {/* Pulse indicator */}
                        <div className="absolute -top-1 -right-1 h-3 w-3 bg-green-500 rounded-full animate-pulse" />
                    </div>
                </button>
            )}

            {/* Chat Window - Fixed size floater */}
            {isOpen && (
                <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 w-[calc(100vw-2rem)] md:w-[420px] h-[500px] md:h-[650px] flex flex-col shadow-2xl rounded-2xl overflow-hidden border border-gray-200 bg-white">
                    {/* Header - Clean black design */}
                    <div className="bg-[#111111] text-white p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center">
                                    <TrendingUp className="h-5 w-5" />
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-green-400 rounded-full border-2 border-[#111111]" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm">AI Trading Assistant</h3>
                                <p className="text-xs text-gray-400">Powered by Claude • Live Data</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="hover:bg-white/10 p-1.5 rounded-lg transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Wallet Status Banner */}
                    {!isConnected && (
                        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex items-center gap-2 text-sm text-yellow-800">
                            <AlertCircle className="h-4 w-4" />
                            <span>Connect wallet to execute trades</span>
                        </div>
                    )}

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F5F5F5]">
                        {messages.map((message, index) => (
                            <div
                                key={index}
                                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${message.role === 'user'
                                        ? 'bg-[#111111] text-white'
                                        : 'bg-white border border-gray-200 text-gray-800'
                                        }`}
                                >
                                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                                    {/* Tool Calls Display */}
                                    {message.toolCalls && message.toolCalls.length > 0 && (
                                        <ToolCallsDisplay toolCalls={message.toolCalls} />
                                    )}

                                    {/* Footer with time and processing info */}
                                    <div className={`flex items-center gap-2 text-xs mt-2 ${message.role === 'user' ? 'text-gray-400' : 'text-gray-500'
                                        }`}>
                                        <span>
                                            {message.timestamp.toLocaleTimeString([], {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </span>
                                        {message.processingTimeMs && (
                                            <>
                                                <span>•</span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {message.processingTimeMs}ms
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white border border-gray-200 rounded-2xl px-4 py-2.5">
                                    <div className="flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin text-[#111111]" />
                                        <span className="text-sm text-gray-600">Thinking...</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Quick Actions */}
                    {messages.length <= 2 && !isLoading && (
                        <div className="px-4 py-2 bg-white border-t border-gray-100">
                            <p className="text-xs text-gray-500 mb-2">Quick actions:</p>
                            <div className="flex gap-2 flex-wrap">
                                {quickActions.map((action, i) => (
                                    <button
                                        key={i}
                                        onClick={() => {
                                            setInput(action.message);
                                            handleSend();
                                        }}
                                        className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                                    >
                                        {action.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Input */}
                    <div className="p-4 bg-white border-t border-gray-200">
                        <div className="flex gap-2">
                            <Input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="Ask about trades, prices, or venues..."
                                className="flex-1 border-gray-300 focus:ring-2 focus:ring-[#111111]"
                                disabled={isLoading}
                            />
                            <Button
                                onClick={handleSend}
                                disabled={!input.trim() || isLoading}
                                className="bg-[#111111] hover:bg-[#222222] text-white"
                            >
                                {isLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Send className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            Press Enter to send • Real-time data from Pyth, VVS, Moonlander
                        </p>
                    </div>
                </div>
            )}
        </>
    );
}

interface ToolCallsDisplayProps {
    toolCalls: ToolCall[];
}

function ToolCallsDisplay({ toolCalls }: ToolCallsDisplayProps) {
    const [expanded, setExpanded] = useState(false);

    const toolIcons: Record<string, string> = {
        get_crypto_price: '[PRICE]',
        get_trade_quote: '[QUOTE]',
        get_venue_rankings: '[RANK]',
        get_funding_rates: '[RATES]',
        discover_services: '[SEARCH]',
        get_wallet_info: '[WALLET]',
    };

    return (
        <div className="mt-2 pt-2 border-t border-gray-100">
            <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
            >
                <Zap className="h-3 w-3" />
                {toolCalls.length} tool{toolCalls.length > 1 ? 's' : ''} used
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>

            {expanded && (
                <div className="mt-2 space-y-2">
                    {toolCalls.map((tool, i) => (
                        <div key={i} className="bg-blue-50 rounded-lg p-2 text-xs">
                            <div className="flex items-center justify-between">
                                <span className="font-medium">
                                    {toolIcons[tool.name] || '[TOOL]'} {tool.name.replace(/_/g, ' ')}
                                </span>
                                {tool.executionTimeMs && (
                                    <span className="text-gray-500">
                                        {tool.executionTimeMs}ms
                                    </span>
                                )}
                            </div>
                            {tool.result !== null && tool.result !== undefined && typeof tool.result === 'object' ? (
                                <pre className="mt-1 text-gray-600 overflow-x-auto">
                                    {String(JSON.stringify(tool.result, null, 2)).slice(0, 200)}
                                    {JSON.stringify(tool.result).length > 200 ? '...' : ''}
                                </pre>
                            ) : null}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
