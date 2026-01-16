import { Link } from 'react-router-dom';
import { Zap, Shield, Coins, Brain, ArrowRight, CheckCircle } from 'lucide-react';

export default function DocsOverview() {
    return (
        <div className="space-y-12">
            {/* Hero Section */}
            <div className="space-y-4">
                <h1 className="text-4xl font-bold text-gray-900">
                    Welcome to Relay Core
                </h1>
                <p className="text-xl text-gray-600">
                    A decentralized AI trading infrastructure combining Claude AI, gasless payments,
                    and trustless reputation systems for seamless DeFi trading on Cronos.
                </p>
            </div>

            {/* Quick Links */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Link
                    to="/docs/quickstart"
                    className="group p-6 bg-white border border-gray-200 rounded-xl hover:border-[#111111] hover:shadow-lg transition-all"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-[#F5F5F5] rounded-lg flex items-center justify-center">
                            <Zap className="w-6 h-6 text-[#111111]" />
                        </div>
                        <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-[#111111] group-hover:translate-x-1 transition-all" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Quickstart</h3>
                    <p className="text-sm text-gray-600">
                        Get started with Relay Core in under 10 minutes. Build your first AI-powered trading app.
                    </p>
                </Link>

                <Link
                    to="/docs/architecture"
                    className="group p-6 bg-white border border-gray-200 rounded-xl hover:border-[#111111] hover:shadow-lg transition-all"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-[#F5F5F5] rounded-lg flex items-center justify-center">
                            <Brain className="w-6 h-6 text-[#111111]" />
                        </div>
                        <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-[#111111] group-hover:translate-x-1 transition-all" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Architecture</h3>
                    <p className="text-sm text-gray-600">
                        Learn how Relay Core combines AI, payments, and reputation in a unified system.
                    </p>
                </Link>

                <Link
                    to="/docs/api/rest"
                    className="group p-6 bg-white border border-gray-200 rounded-xl hover:border-[#111111] hover:shadow-lg transition-all"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-[#F5F5F5] rounded-lg flex items-center justify-center">
                            <Coins className="w-6 h-6 text-[#111111]" />
                        </div>
                        <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-[#111111] group-hover:translate-x-1 transition-all" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">API Reference</h3>
                    <p className="text-sm text-gray-600">
                        Complete API documentation for REST, GraphQL, and WebSocket endpoints.
                    </p>
                </Link>

                <Link
                    to="/docs/examples/trade"
                    className="group p-6 bg-white border border-gray-200 rounded-xl hover:border-[#111111] hover:shadow-lg transition-all"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-[#F5F5F5] rounded-lg flex items-center justify-center">
                            <Shield className="w-6 h-6 text-[#111111]" />
                        </div>
                        <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-[#111111] group-hover:translate-x-1 transition-all" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Examples</h3>
                    <p className="text-sm text-gray-600">
                        Working code examples for trades, payments, and agent registration.
                    </p>
                </Link>
            </div>

            {/* What is Relay Core */}
            <div className="space-y-6">
                <h2 className="text-3xl font-bold text-gray-900">What is Relay Core?</h2>
                <p className="text-lg text-gray-700 leading-relaxed">
                    Relay Core is a comprehensive infrastructure for building AI-powered decentralized trading applications.
                    It combines cutting-edge AI technology with blockchain-native payment systems and trustless reputation
                    mechanisms to create a seamless trading experience.
                </p>
                <p className="text-lg text-gray-700 leading-relaxed">
                    Built on Cronos, Relay Core leverages the x402 payment protocol for gasless transactions,
                    ERC-8004 for trustless agent registries, and Claude AI for intelligent trade execution.
                </p>
            </div>

            {/* Key Features */}
            <div className="space-y-6">
                <h2 className="text-3xl font-bold text-gray-900">Key Features</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0">
                            <CheckCircle className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900 mb-2">AI-Powered Trading</h3>
                            <p className="text-gray-600">
                                Claude AI analyzes market data in real-time, provides intelligent trade recommendations,
                                and executes trades across multiple venues.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0">
                            <CheckCircle className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900 mb-2">Gasless Payments</h3>
                            <p className="text-gray-600">
                                Users pay for services without gas fees using EIP-3009 transferWithAuthorization,
                                powered by Cronos x402 Facilitator.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0">
                            <CheckCircle className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900 mb-2">Trustless Reputation</h3>
                            <p className="text-gray-600">
                                ERC-8004 registries provide on-chain reputation tracking for agents,
                                with independent validation for high-value trades.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0">
                            <CheckCircle className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900 mb-2">Multi-Venue Routing</h3>
                            <p className="text-gray-600">
                                Intelligent routing across Moonlander, GMX, and Fulcrom based on reputation,
                                liquidity, and execution quality.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0">
                            <CheckCircle className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900 mb-2">Real-Time Market Data</h3>
                            <p className="text-gray-600">
                                Integration with Crypto.com MCP provides accurate, real-time cryptocurrency
                                prices across multiple sources.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0">
                            <CheckCircle className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900 mb-2">Service Discovery</h3>
                            <p className="text-gray-600">
                                ZAUTH integration enables discovery of reliable API endpoints with
                                health status monitoring and reputation scoring.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Technology Stack */}
            <div className="space-y-6">
                <h2 className="text-3xl font-bold text-gray-900">Technology Stack</h2>
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <h3 className="font-semibold text-gray-900 mb-3">Frontend</h3>
                            <ul className="space-y-2 text-sm text-gray-600">
                                <li>• React 18 with TypeScript</li>
                                <li>• Vite for build tooling</li>
                                <li>• TailwindCSS for styling</li>
                                <li>• ethers.js for blockchain</li>
                                <li>• Wagmi for wallet connection</li>
                            </ul>
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900 mb-3">Backend</h3>
                            <ul className="space-y-2 text-sm text-gray-600">
                                <li>• Node.js with Express</li>
                                <li>• GraphQL with Apollo</li>
                                <li>• Supabase for database</li>
                                <li>• Anthropic Claude AI</li>
                                <li>• Crypto.com MCP</li>
                            </ul>
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900 mb-3">Blockchain</h3>
                            <ul className="space-y-2 text-sm text-gray-600">
                                <li>• Cronos EVM (x402)</li>
                                <li>• Cronos zkEVM (ERC-8004)</li>
                                <li>• Solidity 0.8.20</li>
                                <li>• OpenZeppelin contracts</li>
                                <li>• EIP-3009, ERC-8004</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* Use Cases */}
            <div className="space-y-6">
                <h2 className="text-3xl font-bold text-gray-900">Use Cases</h2>
                <div className="space-y-4">
                    <div className="p-6 bg-white border border-gray-200 rounded-xl">
                        <h3 className="font-semibold text-gray-900 mb-2">AI Trading Assistants</h3>
                        <p className="text-gray-700">
                            Build conversational AI agents that help users execute trades, analyze markets,
                            and manage positions across multiple DEXs.
                        </p>
                    </div>

                    <div className="p-6 bg-white border border-gray-200 rounded-xl">
                        <h3 className="font-semibold text-gray-900 mb-2">Automated Trading Bots</h3>
                        <p className="text-gray-700">
                            Create sophisticated trading bots that leverage AI for decision-making and
                            execute trades with gasless payments.
                        </p>
                    </div>

                    <div className="p-6 bg-white border border-gray-200 rounded-xl">
                        <h3 className="font-semibold text-gray-900 mb-2">Service Marketplaces</h3>
                        <p className="text-gray-700">
                            Build marketplaces where AI agents can discover, pay for, and consume
                            services with built-in reputation and validation.
                        </p>
                    </div>
                </div>
            </div>

            {/* Next Steps */}
            <div className="bg-[#111111] rounded-xl p-8 text-white">
                <h2 className="text-2xl font-bold mb-4">Ready to Get Started?</h2>
                <p className="text-gray-300 mb-6">
                    Follow our quickstart guide to build your first AI-powered trading app in under 10 minutes.
                </p>
                <Link
                    to="/docs/quickstart"
                    className="inline-flex items-center space-x-2 px-6 py-3 bg-white text-[#111111] font-semibold rounded-lg hover:bg-gray-100 transition-colors"
                >
                    <span>Get Started</span>
                    <ArrowRight className="w-5 h-5" />
                </Link>
            </div>
        </div>
    );
}
