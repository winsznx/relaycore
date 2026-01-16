import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Wallet, Shield, Zap, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAppKit, useAppKitAccount } from '@/lib/web3'
import logo from '@/assets/logo.png'
import { useEffect } from 'react'

export function EntryPage() {
    const { open } = useAppKit()
    const { isConnected } = useAppKitAccount()
    const navigate = useNavigate()

    useEffect(() => {
        if (isConnected) {
            navigate('/dashboard')
        }
    }, [isConnected, navigate])

    return (
        <div className="min-h-screen flex flex-col lg:flex-row">
            {/* Left Panel - Dark / Brand side */}
            <div className="lg:w-1/2 bg-[#0a0a0a] text-white p-8 lg:p-16 flex flex-col min-h-[50vh] lg:min-h-screen">
                {/* Logo */}
                <Link to="/" className="flex items-center gap-3 mb-auto">
                    <img src={logo} alt="Relay Core" className="h-10 w-10 rounded-xl" />
                    <span className="text-2xl font-bold tracking-tight">Relay Core</span>
                </Link>

                {/* Tagline */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="my-auto py-12"
                >
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
                        <span className="text-white">Trust Layer</span><br />
                        <span className="text-white">for Cronos</span><br />
                        <span className="text-[#2A4425]">Agents</span>
                    </h1>
                    <p className="text-gray-400 text-lg md:text-xl max-w-md mb-10">
                        Payment memory and reputation scoring for autonomous agents.
                        Every transaction builds trust. Every service earns reputation.
                    </p>

                    {/* Stats - Relay Core specific */}
                    <div className="flex gap-8 md:gap-12">
                        <div>
                            <div className="text-3xl md:text-4xl font-bold text-white flex items-center gap-2">
                                <Shield size={24} className="text-[#2A4425]" />
                                x402
                            </div>
                            <div className="text-sm">Payment Protocol</div>
                        </div>
                        <div>
                            <div className="text-3xl md:text-4xl font-bold text-white flex items-center gap-2">
                                <Zap size={24} className="text-[#2A4425]" />
                                &lt;2s
                            </div>
                            <div className="text-sm">Reputation Index</div>
                        </div>
                        <div>
                            <div className="text-3xl md:text-4xl font-bold text-white flex items-center gap-2">
                                <Star size={24} className="text-[#2A4425]" />
                                100%
                            </div>
                            <div className="text-sm">On-chain Proof</div>
                        </div>
                    </div>
                </motion.div>

                {/* Footer Links */}
                <div className="flex gap-6 text-sm text-gray-500 mt-auto">
                    <a href="https://docs.relaycore.xyz" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Docs</a>
                    <a href="https://github.com/AceVikings/relaycore" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GitHub</a>
                    <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
                    <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
                </div>
            </div>

            {/* Right Panel - White / Action side */}
            <div className="lg:w-1/2 bg-white p-8 lg:p-16 flex flex-col justify-center min-h-[50vh] lg:min-h-screen">
                <div className="max-w-md mx-auto w-full">
                    {/* For Service Providers Section */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="mb-12"
                    >
                        <Badge className="mb-4 bg-green-100 text-green-700 hover:bg-green-100 border-0">
                            <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                            Live on Cronos
                        </Badge>

                        <h2 className="text-3xl md:text-4xl font-bold text-[#111111] mb-3">
                            For Service Providers
                        </h2>
                        <p className="text-gray-500 mb-6">
                            Register your API or service. Build on-chain reputation with every successful payment. Get discovered by AI agents.
                        </p>

                        <Button
                            size="lg"
                            className="w-full bg-[#111111] text-white hover:bg-black rounded-xl h-14 text-base font-semibold gap-2"
                            onClick={() => open()}
                        >
                            <Wallet size={20} />
                            Connect Wallet
                        </Button>

                        <p className="text-center text-sm text-gray-400 mt-3">
                            Powered by zAuth · USDC payments on Cronos
                        </p>
                    </motion.div>

                    {/* Divider */}
                    <div className="flex items-center gap-4 my-8">
                        <div className="flex-1 h-px bg-gray-200" />
                        <span className="text-gray-400 text-sm">or</span>
                        <div className="flex-1 h-px bg-gray-200" />
                    </div>

                    {/* For AI Agents / Consumers Section */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.4 }}
                    >
                        <h2 className="text-3xl md:text-4xl font-bold text-[#111111] mb-3">
                            For AI Agents
                        </h2>
                        <p className="text-gray-500 mb-6">
                            Discover trusted services with verified reputation scores. Pay via x402 and get instant delivery.
                        </p>

                        <Button
                            variant="outline"
                            size="lg"
                            className="w-full border-gray-200 text-[#111111] hover:bg-gray-50 rounded-xl h-14 text-base font-semibold gap-2"
                            asChild
                        >
                            <Link to="/dashboard/discovery">
                                Browse Service Registry
                                <ArrowRight size={18} />
                            </Link>
                        </Button>

                        <p className="text-center text-sm text-gray-400 mt-3">
                            No wallet required to browse
                        </p>

                        <button className="block mx-auto mt-6 text-sm text-gray-400 underline hover:text-gray-600 transition-colors">
                            What is x402?
                        </button>
                    </motion.div>
                </div>
            </div>
        </div>
    )
}
