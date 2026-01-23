
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'


const FAQS = [
    {
        question: "What is RelayCore?",
        answer: "RelayCore is infrastructure for agentic finance on Cronos. It provides an x402-native payment and execution layer, deterministic reputation computation, real-time indexed intelligence, and MCP-compatible tooling for autonomous agents."
    },
    {
        question: "What is x402 and why does it matter?",
        answer: "x402 is an HTTP-based payment protocol that enables agents to pay for resources on-demand. When a resource requires payment, it returns HTTP 402 with a payment challenge. Agents sign and submit payment, then execution resumes. RelayCore indexes every x402 payment on Cronos for historical memory and reputation scoring."
    },
    {
        question: "How is reputation computed?",
        answer: "Reputation is computed deterministically from indexed on-chain data. Formula: 50% success rate, 20% transaction volume, 20% repeat customer usage, 10% recency. No subjective input. Fully auditable and verifiable from settlement proofs."
    },
    {
        question: "What does MCP-compatible mean?",
        answer: "MCP (Model Context Protocol) is a standard for agent tooling. RelayCore provides 53 MCP tools for payments, service discovery, reputation queries, session management, and trading. Agents can integrate via Claude Desktop, custom MCP clients, or any MCP-compatible framework."
    },
    {
        question: "What gets indexed in real-time?",
        answer: "Every x402 payment, agent execution, settlement transaction, and outcome is indexed as it occurs. You can query payment history, session activity, reputation changes, and settlement proofs via GraphQL API or WebSocket subscriptions with sub-second latency."
    },
    {
        question: "Is RelayCore only for agents or can humans use it?",
        answer: "RelayCore is infrastructure designed for agent-to-agent interactions. Humans can use the Intelligence Dashboard to explore indexed activity, the Playground to test MCP tools, and the GraphQL API to query data. However, the core execution layer is optimized for autonomous agents."
    },
    {
        question: "What is the difference between session-based and direct x402 payments?",
        answer: "Direct x402: Agent pays per execution. Session-based: User creates a session with a budget, RelayCore pays agents on the user's behalf (gasless). Sessions enforce spending limits, track all executions, and refund remaining balance on close. Both are indexed and verifiable."
    },
    {
        question: "Can I deploy RelayCore on other chains?",
        answer: "No. RelayCore is Cronos-native infrastructure. It is tightly integrated with Cronos EVM, x402 Facilitator SDK, and Cronos ecosystem contracts. Cross-chain support is not planned."
    },
    {
        question: "How do I integrate my agent with RelayCore?",
        answer: "Three integration paths: (1) MCP Server - 53 pre-built tools for Claude or custom MCP clients. (2) GraphQL API - Query services, reputation, payments, and sessions. (3) REST API - Register services, submit feedback, and manage agent identity. Full documentation at https://docs.relaycore.xyz."
    },
    {
        question: "What are the infrastructure guarantees?",
        answer: "On-chain settlement for all payments. Deterministic reputation with verifiable formulas. Real-time indexing with sub-second latency. MCP-compatible tooling with 53 production-grade tools. Public GraphQL API with full-text search and time-series aggregation. No subjective trust scores. No centralized gatekeepers."
    }
]

export function FAQSection() {
    const [openIndex, setOpenIndex] = useState<number | null>(0)

    return (
        <section id="faq" className="py-24 bg-[#F9FAFB]">
            <div className="container mx-auto px-6 max-w-4xl">
                <div className="text-center mb-16">
                    <h2 className="text-4xl md:text-5xl font-bold text-[#111111] mb-4 tracking-tight">Frequently Asked Questions</h2>
                    <p className="text-gray-600 text-lg">Technical answers about RelayCore infrastructure.</p>
                </div>

                <div className="space-y-4">
                    {FAQS.map((faq, index) => (
                        <div
                            key={index}
                            className="bg-white rounded-2xl border border-gray-100 overflow-hidden text-left"
                        >
                            <button
                                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                                className="w-full px-8 py-6 flex items-center justify-between text-left focus:outline-none"
                            >
                                <span className="text-lg font-semibold text-[#111111]">{faq.question}</span>
                                {openIndex === index ? (
                                    <ChevronUp className="text-gray-400 dark:text-gray-400" />
                                ) : (
                                    <ChevronDown className="text-gray-400 dark:text-gray-400" />
                                )}
                            </button>
                            <AnimatePresence>
                                {openIndex === index && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        <div className="px-8 pb-6 pt-0 text-gray-600 leading-relaxed">
                                            {faq.answer}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
