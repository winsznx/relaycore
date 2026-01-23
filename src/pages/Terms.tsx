/**
 * Terms of Service Page
 */

import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logo from '@/assets/relay-logo.svg';

export function TermsPage() {
    return (
        <div className="min-h-screen">
            {/* Simple Header */}
            <header className="border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
                <div className="container mx-auto px-6 py-4 max-w-4xl flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2">
                        <img src={logo} alt="Relay Core" className="h-8 w-8 rounded-lg" />
                        <span className="text-xl font-bold text-[#111111]">Relay Core</span>
                    </Link>
                    <Link to="/">
                        <Button variant="ghost" size="sm" className="text-gray-600 dark:text-gray-200">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Home
                        </Button>
                    </Link>
                </div>
            </header>

            {/* Content */}
            <main className="container mx-auto px-6 py-16 max-w-4xl">
                <h1 className="text-4xl font-bold text-[#111111] mb-4">Terms of Service</h1>
                <p className="text-gray-500 mb-12">Last updated: January 10, 2026</p>

                <div className="prose prose-gray max-w-none space-y-8">
                    <section>
                        <h2 className="text-2xl font-bold text-[#111111] mb-4">1. Acceptance of Terms</h2>
                        <p className="text-gray-600 leading-relaxed">
                            By accessing or using Relay Core ("the Platform"), you agree to be bound by these Terms of Service.
                            If you do not agree to these terms, please do not use the Platform. The Platform is a decentralized
                            infrastructure service for autonomous agents on the Cronos blockchain.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-[#111111] mb-4">2. Description of Service</h2>
                        <p className="text-gray-600 leading-relaxed">
                            Relay Core provides payment memory, reputation scoring, and service discovery infrastructure for
                            autonomous agents. The Platform includes:
                        </p>
                        <ul className="list-disc list-inside text-gray-600 mt-4 space-y-2">
                            <li>Payment indexing and tracking for x402 protocol transactions</li>
                            <li>Reputation scoring based on payment outcomes</li>
                            <li>Service discovery APIs for agent-to-agent interactions</li>
                            <li>Relay Trade: Perpetual DEX aggregation with reputation-based routing</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-[#111111] mb-4">3. User Responsibilities</h2>
                        <p className="text-gray-600 leading-relaxed">
                            You are responsible for maintaining the security of your wallet and private keys. You agree not to
                            use the Platform for any unlawful purposes or to conduct any activity that could damage, disable,
                            or impair the Platform.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-[#111111] mb-4">4. Blockchain Transactions</h2>
                        <p className="text-gray-600 leading-relaxed">
                            All transactions on the Platform are executed on the Cronos blockchain and are irreversible.
                            You acknowledge that blockchain transactions may be subject to network fees (gas) and that
                            transaction times may vary based on network conditions.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-[#111111] mb-4">5. Reputation Scoring</h2>
                        <p className="text-gray-600 leading-relaxed">
                            Reputation scores are calculated algorithmically based on publicly available on-chain data.
                            The Platform does not guarantee the accuracy of reputation scores and they should be used
                            as one of many factors in decision-making.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-[#111111] mb-4">6. Limitation of Liability</h2>
                        <p className="text-gray-600 leading-relaxed">
                            The Platform is provided "as is" without warranties of any kind. We are not liable for any
                            losses arising from your use of the Platform, including but not limited to trading losses,
                            smart contract failures, or third-party service interruptions.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-[#111111] mb-4">7. Modifications</h2>
                        <p className="text-gray-600 leading-relaxed">
                            We reserve the right to modify these Terms at any time. Continued use of the Platform after
                            changes constitutes acceptance of the new Terms.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-[#111111] mb-4">8. Contact</h2>
                        <p className="text-gray-600 leading-relaxed">
                            For questions about these Terms, please contact us at{' '}
                            <a href="mailto:legal@relaycore.finance" className="text-[#2A4425] hover:underline">
                                legal@relaycore.finance
                            </a>
                        </p>
                    </section>
                </div>
            </main>

            {/* Simple Footer */}
            <footer className="border-t border-gray-100 py-8 mt-16">
                <div className="container mx-auto px-6 max-w-4xl flex flex-col md:flex-row justify-between items-center text-sm text-gray-500 gap-4">
                    <p>© 2026 Relay Core. All rights reserved.</p>
                    <div className="flex gap-6">
                        <Link to="/privacy" className="hover:text-[#111111] transition-colors">Privacy Policy</Link>
                        <Link to="/terms" className="hover:text-[#111111] transition-colors font-medium text-[#111111]">Terms of Service</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
