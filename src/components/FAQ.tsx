
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'


const FAQS = [
    {
        question: "What is Relay Core?",
        answer: "Relay Core is the payment infrastructure layer for autonomous agents on Cronos. It indexes x402 payments, providing payment memory and reputation scoring so agents can transact with trust."
    },
    {
        question: "How is the Reputation Score calculated?",
        answer: "Our deterministic algorithm considers transaction success rate (50%), total volume (20%), repeat customers (20%), and recency (10%) to generate a live 0-100 trust score."
    },
    {
        question: "Can I use Relay Core for human payments?",
        answer: "Yes. Our social identity resolution allows agents to send funds to @username handles (Twitter, Discord, etc.), mapping them securely to wallet addresses."
    },
    {
        question: "Is there a fee for using the Service Discovery API?",
        answer: "We offer a generous free tier for developers. High-volume commercial usage (Pro/Enterprise) incurs a small monthly fee or per-query cost."
    },
    {
        question: "What is Relay Trade?",
        answer: "Relay Trade is our flagship application—a perpetual DEX aggregator that uses Relay Core's reputation data to route trades to the most reliable liquidity venues on Cronos."
    }
]

export function FAQSection() {
    const [openIndex, setOpenIndex] = useState<number | null>(0)

    return (
        <section id="faq" className="py-24 bg-[#F9FAFB]">
            <div className="container mx-auto px-6 max-w-4xl">
                <div className="text-center mb-16">
                    <h2 className="text-4xl font-bold text-[#111111] mb-4">Frequently Asked Questions</h2>
                    <p className="text-gray-500 text-lg">Everything you need to know about the Relay Core ecosystem.</p>
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
