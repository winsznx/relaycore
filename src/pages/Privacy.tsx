/**
 * Privacy Policy Page
 */

import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logo from '@/assets/relay-logo.svg';

export function PrivacyPage() {
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
                <h1 className="text-4xl font-bold text-[#111111] mb-4">Privacy Policy</h1>
                <p className="text-gray-500 mb-12">Last updated: January 10, 2026</p>

                <div className="prose prose-gray max-w-none space-y-8">
                    <section>
                        <h2 className="text-2xl font-bold text-[#111111] mb-4">1. Introduction</h2>
                        <p className="text-gray-600 leading-relaxed">
                            Relay Core ("we", "our", or "the Platform") is committed to protecting your privacy.
                            This Privacy Policy explains how we collect, use, and safeguard information when you
                            use our decentralized infrastructure services on the Cronos blockchain.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-[#111111] mb-4">2. Information We Collect</h2>
                        <p className="text-gray-600 leading-relaxed mb-4">
                            As a blockchain-based platform, we primarily interact with publicly available on-chain data:
                        </p>
                        <ul className="list-disc list-inside text-gray-600 space-y-2">
                            <li><strong>Wallet Addresses:</strong> Public blockchain addresses used to interact with the Platform</li>
                            <li><strong>Transaction Data:</strong> Publicly recorded blockchain transactions (payments, trades)</li>
                            <li><strong>Usage Data:</strong> API calls, page views, and interaction patterns (anonymized)</li>
                            <li><strong>Device Information:</strong> Browser type, IP address for rate limiting purposes</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-[#111111] mb-4">3. How We Use Information</h2>
                        <p className="text-gray-600 leading-relaxed mb-4">We use collected information to:</p>
                        <ul className="list-disc list-inside text-gray-600 space-y-2">
                            <li>Index and track x402 payment transactions for reputation scoring</li>
                            <li>Calculate and display service reputation scores</li>
                            <li>Provide service discovery and matching</li>
                            <li>Improve Platform performance and user experience</li>
                            <li>Prevent abuse and ensure security (rate limiting)</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-[#111111] mb-4">4. Data on the Blockchain</h2>
                        <p className="text-gray-600 leading-relaxed">
                            Transaction data recorded on the Cronos blockchain is publicly accessible and immutable.
                            We do not control blockchain data and cannot delete or modify on-chain records.
                            Our reputation scores are derived from this public data.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-[#111111] mb-4">5. Data Storage</h2>
                        <p className="text-gray-600 leading-relaxed">
                            Off-chain data (API usage logs, cached scores) is stored on secure cloud infrastructure
                            (Supabase). We retain this data only as long as necessary to provide our services.
                            Rate limiting data is temporary and automatically expires.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-[#111111] mb-4">6. Third-Party Services</h2>
                        <p className="text-gray-600 leading-relaxed">
                            The Platform integrates with third-party services including Cronos RPC providers,
                            perpetual DEXs (Moonlander, GMX, Gains Network), and price oracle providers.
                            These services have their own privacy policies.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-[#111111] mb-4">7. Your Rights</h2>
                        <p className="text-gray-600 leading-relaxed mb-4">You have the right to:</p>
                        <ul className="list-disc list-inside text-gray-600 space-y-2">
                            <li>Access information we hold about your wallet address</li>
                            <li>Request deletion of off-chain data associated with your address</li>
                            <li>Opt out of optional data collection (analytics)</li>
                        </ul>
                        <p className="text-gray-600 leading-relaxed mt-4">
                            Note: On-chain data cannot be deleted as it is part of the public blockchain record.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-[#111111] mb-4">8. Security</h2>
                        <p className="text-gray-600 leading-relaxed">
                            We implement industry-standard security measures including encryption, access controls,
                            and regular security audits. However, no system is completely secure, and we cannot
                            guarantee absolute security.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-[#111111] mb-4">9. Changes to This Policy</h2>
                        <p className="text-gray-600 leading-relaxed">
                            We may update this Privacy Policy periodically. We will notify users of significant
                            changes through the Platform. Continued use after changes constitutes acceptance.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-[#111111] mb-4">10. Contact Us</h2>
                        <p className="text-gray-600 leading-relaxed">
                            For privacy-related inquiries, please contact{' '}
                            <a href="mailto:privacy@relaycore.finance" className="text-[#2A4425] hover:underline">
                                privacy@relaycore.finance
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
                        <Link to="/privacy" className="hover:text-[#111111] transition-colors font-medium text-[#111111]">Privacy Policy</Link>
                        <Link to="/terms" className="hover:text-[#111111] transition-colors">Terms of Service</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
