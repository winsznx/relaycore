
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, ShieldCheck, CheckCircle2, Search } from 'lucide-react'
import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import phoneMockup from '@/assets/phone-mockup.png'
import featurePayment from '@/assets/feature-payment.png'
import featureReputation from '@/assets/feature-reputation.png'
import featureDiscovery from '@/assets/feature-discovery.png'
import { FAQSection } from '@/components/FAQ'
import logo from '@/assets/logo.png'
import cronosLogo from '@/assets/partners/cronos.svg'
import cryptoComLogo from '@/assets/partners/crypto-com.svg'
import zauthLogo from '@/assets/partners/zauth.png'
import { cn } from '@/lib/utils'
import Globe from '@/components/Globe'
import DotGrid from '@/components/DotGrid'
import { DashboardLayout } from '@/components/DashboardLayout'
import { DashboardOverview, DashboardAgents, DashboardTransactions, DashboardReputation, DashboardSettings, DashboardTrading } from '@/components/DashboardPages'
import { BotIntegration } from '@/components/BotIntegration'
import DocsLayout from '@/components/DocsLayout';
import DocsOverview from '@/pages/docs/Overview';
import DocsQuickstart from '@/pages/docs/Quickstart';
import DocsInstallation from '@/pages/docs/Installation';
import DocsArchitecture from '@/pages/docs/Architecture';
import DocsPaymentFlow from '@/pages/docs/PaymentFlow';
import DocsReputation from '@/pages/docs/Reputation';
import DocsAIAgent from '@/pages/docs/AIAgent';
import DocsX402Guide from '@/pages/docs/guides/X402Guide';
import DocsEIP3009Guide from '@/pages/docs/guides/EIP3009Guide';
import DocsERC8004Guide from '@/pages/docs/guides/ERC8004Guide';
import DocsClaudeGuide from '@/pages/docs/guides/ClaudeGuide';
import DocsACPSGuide from '@/pages/docs/guides/ACPSGuide';
import DocsRESTAPI from '@/pages/docs/api/RESTAPI';
import DocsGraphQLAPI from '@/pages/docs/api/GraphQLAPI';
import DocsWebSocketAPI from '@/pages/docs/api/WebSocketAPI';
import DocsSDKGuide from '@/pages/docs/api/SDKGuide';
import DocsMCPGuide from '@/pages/docs/api/MCPGuide';
import DocsIdentityRegistry from '@/pages/docs/contracts/IdentityRegistry';
import DocsReputationRegistry from '@/pages/docs/contracts/ReputationRegistry';
import DocsValidationRegistry from '@/pages/docs/contracts/ValidationRegistry';
import DocsDeployment from '@/pages/docs/contracts/Deployment';
import DocsTradeExample from '@/pages/docs/examples/TradeExample';
import DocsRegisterExample from '@/pages/docs/examples/RegisterExample';
import DocsFeedbackExample from '@/pages/docs/examples/FeedbackExample';
import DocsValidationExample from '@/pages/docs/examples/ValidationExample';
import DocPage from '@/pages/docs/DocPage';

// --- Navbar ---

function Navbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const navigate = useNavigate()
  const location = useLocation()

  const NAV_LINKS = [
    { label: 'Features', href: '#features' },
    { label: 'How it Works', href: '#how-it-works' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Docs', href: '/docs' },
  ]

  const handleNavClick = (href: string) => {
    if (href.startsWith('/')) {
      // Navigate to route
      navigate(href);
    } else if (href.startsWith('#')) {
      // If on dashboard, go to home first
      if (location.pathname !== '/') {
        navigate('/')
        setTimeout(() => {
          const el = document.querySelector(href)
          el?.scrollIntoView({ behavior: 'smooth' })
        }, 100)
      } else {
        const el = document.querySelector(href)
        el?.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-4 md:px-6 py-4">
      <div className={cn(
        "container mx-auto max-w-6xl transition-all duration-300",
        "flex items-center justify-between",
        "px-6 py-3 rounded-full",
        "bg-white/90 backdrop-blur-xl",
        "border border-gray-200 shadow-lg shadow-black/5"
      )}>
        <Link to="/" className="flex items-center gap-2.5 cursor-pointer">
          <img src={logo} alt="Relay Core" className="h-9 w-9 rounded-xl" />
          <span className="text-xl font-bold tracking-tight text-[#111111]">Relay Core</span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <button
              key={link.label}
              onClick={() => handleNavClick(link.href)}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-[#111111] hover:bg-gray-100 rounded-full transition-all bg-transparent border-none cursor-pointer"
            >
              {link.label}
            </button>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Button
            size="sm"
            className="bg-[#111111] text-white hover:bg-black rounded-full px-6 shadow-md"
            onClick={() => navigate('/app')}
          >
            Launch App
          </Button>
        </div>

        <button className="md:hidden text-[#111111] p-2 hover:bg-gray-100 rounded-full transition-colors" onClick={onOpenMenu}>
          <Menu size={24} />
        </button>
      </div>
    </nav>
  )
}

// --- Home Components ---

// --- Home Components ---

function HeroSection() {
  const navigate = useNavigate()

  return (
    <section className="relative min-h-[100dvh] md:snap-start w-full flex flex-col justify-center items-center bg-white overflow-hidden pt-28 pb-12">
      {/* Interactive Dot Grid Background */}
      <div className="absolute inset-0 z-0">
        <DotGrid
          dotSize={3}
          gap={25}
          baseColor="#e5e7eb"
          activeColor="#9945FF"
          proximity={120}
          shockRadius={250}
          shockStrength={5}
          resistance={750}
          returnDuration={1.5}
        />
      </div>

      {/* Background Gradients */}
      <div className="absolute top-0 inset-x-0 h-[1000px] -z-10 overflow-hidden pointer-events-none w-full max-w-[100vw]">
        <div className="absolute top-[-10%] left-[20%] w-[800px] h-[800px] rounded-full bg-[#F5E9FF] opacity-60 blur-[120px]" />
        <div className="absolute top-[10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[#FFF0E6] opacity-60 blur-[120px]" />
      </div>

      <div className="container mx-auto text-center z-10 relative max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-5xl mx-auto"
        >
          <Badge variant="outline" className="mb-8 px-6 py-2 rounded-full border-gray-200 bg-white/80 backdrop-blur-md text-[#111111] font-semibold text-sm tracking-wide shadow-sm">
            The Trust Layer for Cronos Agents
          </Badge>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-[#111111] tracking-tight leading-[1.05] mb-8">
            Financial Clarity <br />
            <span className="text-gray-400">You Can Trust</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto mb-8 leading-relaxed">
            Relay Core provides payment memory, reputation scoring, and service discovery infrastructure for the autonomous agent economy.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-12">
            <Button size="lg" className="h-16 px-10 rounded-full bg-[#111111] text-white hover:bg-black text-lg font-semibold shadow-xl shadow-black/10 w-full sm:w-auto" onClick={() => navigate('/app')}>
              Start Building Now
            </Button>
            <Button size="lg" variant="outline" className="h-16 px-10 rounded-full border-gray-200 text-[#111111] hover:bg-gray-50 text-lg font-semibold w-full sm:w-auto bg-white shadow-sm" onClick={() => navigate('/docs')}>
              Read The Docs
            </Button>
          </div>

          {/* Partner Logo Marquee */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mb-8"
          >
            <p className="text-sm text-gray-500 font-medium mb-4 tracking-wide uppercase">Built on</p>
            <div className="relative max-w-3xl mx-auto overflow-hidden py-3" style={{ maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)', WebkitMaskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)' }}>
              {/* Seamless infinite scroll - 4 tracks for smooth continuous loop */}
              <div className="flex animate-marquee-infinite">
                {/* Render 4 identical tracks for seamless looping */}
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-16 px-8 flex-shrink-0">
                    <a href="https://cronos.org" target="_blank" rel="noopener noreferrer" className="flex-shrink-0 hover:opacity-70 transition-opacity">
                      <img src={cronosLogo} alt="Cronos" className="h-7 md:h-8 w-auto" />
                    </a>
                    <a href="https://zauthx402.com" target="_blank" rel="noopener noreferrer" className="flex-shrink-0 hover:opacity-70 transition-opacity">
                      <img src={zauthLogo} alt="zAuth" className="h-7 md:h-8 w-auto" style={{ filter: 'brightness(0) opacity(0.7)' }} />
                    </a>
                    <a href="https://crypto.com" target="_blank" rel="noopener noreferrer" className="flex-shrink-0 hover:opacity-70 transition-opacity">
                      <img src={cryptoComLogo} alt="Crypto.com" className="h-6 md:h-7 w-auto" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Hero Visual - 3D Globe - Outside Container */}
      <div className="relative w-full h-[400px] md:h-[600px] mt-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="w-full h-full"
        >
          <Globe className="w-full h-full" />
        </motion.div>
      </div>
    </section>
  )
}

// How It Works - Interactive Step Flow (inspired by zAuth)
function HowItWorksSection() {
  const [activeStep, setActiveStep] = useState(0)

  const steps = [
    {
      title: "Agent Discovers Services",
      description: "AI agents query Relay Core to find reliable services. Filter by category, reputation score, and price.",
      diagram: "discovery"
    },
    {
      title: "x402 Payment Triggered",
      description: "When a service is selected, the agent initiates an x402 payment. The transaction is signed and broadcast to Cronos.",
      diagram: "payment"
    },
    {
      title: "Payment Indexed",
      description: "Relay Core indexes the payment transaction in real-time. Every x402 payment on Cronos is captured and stored.",
      diagram: "indexing"
    },
    {
      title: "Outcome Recorded",
      description: "After service delivery, the outcome (success/failure, latency) is recorded. This builds the service's track record.",
      diagram: "outcome"
    },
    {
      title: "Reputation Updated",
      description: "A deterministic reputation score is calculated: 50% success rate + 20% volume + 20% repeat customers + 10% recency.",
      diagram: "reputation"
    }
  ]

  // Auto-advance steps
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length)
    }, 4000)
    return () => clearInterval(timer)
  }, [steps.length])

  return (
    <section id="how-it-works" className="min-h-[100dvh] md:snap-start bg-gradient-to-b from-white via-gray-50 to-white w-full flex flex-col justify-center items-center px-6 py-20 scroll-mt-0 overflow-hidden">
      <div className="container mx-auto px-6 text-center max-w-5xl">
        {/* Section Title */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-4xl md:text-6xl font-bold text-[#111111] mb-16 tracking-tight"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          How it <span className="italic text-[#2A4425]">works</span>
        </motion.h2>

        {/* Interactive Diagram Area */}
        <div className="relative h-[320px] md:h-[360px] mb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <FlowDiagram step={activeStep} />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Pagination Dots */}
        <div className="flex justify-center gap-3 mb-8">
          {steps.map((_, index) => (
            <button
              key={index}
              onClick={() => setActiveStep(index)}
              className={cn(
                "w-3 h-3 rounded-full transition-all duration-300",
                activeStep === index
                  ? "bg-[#2A4425] w-6 shadow-[0_0_12px_rgba(42,68,37,0.3)]"
                  : "bg-gray-300 hover:bg-gray-400"
              )}
              aria-label={`Step ${index + 1}`}
            />
          ))}
        </div>

        {/* Step Description */}
        <AnimatePresence mode="wait">
          <motion.p
            key={activeStep}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed"
          >
            {steps[activeStep].description}
          </motion.p>
        </AnimatePresence>

        {/* Trust Ecosystem Title */}
        <div className="mt-24 text-left">
          <h3 className="text-3xl md:text-5xl font-bold text-[#111111]">
            Our trust
          </h3>
          <h3 className="text-3xl md:text-5xl font-bold italic text-[#2A4425]" style={{ fontFamily: "'Playfair Display', serif" }}>
            ecosystem
          </h3>
        </div>
      </div>
    </section>
  )
}

// Flow Diagram Component - Unique visual for each step
function FlowDiagram({ step }: { step: number }) {
  // Step 0: Discovery - Search interface with results
  if (step === 0) {
    return (
      <div className="w-full max-w-lg">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 shadow-2xl"
        >
          {/* Search Bar */}
          <div className="flex items-center gap-3 bg-[#0a0a0a] rounded-xl px-4 py-3 mb-4">
            <Search className="w-5 h-5 text-gray-500" />
            <span className="text-gray-400 font-mono text-sm">Find services: oracle, kyc...</span>
          </div>

          {/* Results */}
          <div className="space-y-3">
            {[
              { name: 'Pyth Oracle', score: 98.5, latency: '45ms', active: true },
              { name: 'Chainlink VRF', score: 96.2, latency: '120ms', active: false },
              { name: 'KYC Verify Pro', score: 94.8, latency: '200ms', active: false },
            ].map((service, i) => (
              <motion.div
                key={service.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * i }}
                className={cn(
                  "flex items-center justify-between p-3 rounded-xl transition-all",
                  service.active ? "bg-[#00FF88]/10 border border-[#00FF88]/30" : "bg-[#0a0a0a]"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold",
                    service.active ? "bg-[#00FF88] text-black" : "bg-gray-700 text-gray-300"
                  )}>
                    {service.name[0]}
                  </div>
                  <span className="text-white text-sm font-medium">{service.name}</span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-[#00FF88] font-mono">{service.score}</span>
                  <span className="text-gray-500">{service.latency}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
        <p className="text-gray-500 text-sm mt-4">Service Discovery</p>
      </div>
    )
  }

  // Step 1: Payment - Transaction being signed
  if (step === 1) {
    return (
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#1a1a1a] border border-orange-500/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden"
        >
          {/* Pulsing warning */}
          <motion.div
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute inset-0 bg-orange-500/5"
          />

          <div className="relative">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold">$</span>
              </div>
              <div>
                <p className="text-white font-semibold">x402 Payment Required</p>
                <p className="text-orange-400 text-xs">HTTP 402 - Payment Required</p>
              </div>
            </div>

            <div className="space-y-3 font-mono text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">To:</span>
                <span className="text-white">0x742d...5f1B</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Amount:</span>
                <span className="text-[#00FF88] font-bold">0.50 USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Network:</span>
                <span className="text-white">Cronos</span>
              </div>
            </div>

            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ duration: 2, repeat: Infinity }}
              className="h-1 bg-orange-500 rounded-full mt-6"
            />
            <p className="text-orange-400 text-xs mt-2 text-center">Signing transaction...</p>
          </div>
        </motion.div>
        <p className="text-gray-500 text-sm mt-4">Payment Initiated</p>
      </div>
    )
  }

  // Step 2: Indexing - Block being processed
  if (step === 2) {
    return (
      <div className="w-full max-w-lg">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-[#1a1a1a] border border-[#00FF88]/30 rounded-2xl p-6 shadow-2xl"
        >
          {/* Block Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-8 h-8 border-2 border-[#00FF88] border-t-transparent rounded-full"
              />
              <span className="text-white font-semibold">Indexing Block #18,432,891</span>
            </div>
            <Badge className="bg-[#00FF88]/20 text-[#00FF88] border-0">Live</Badge>
          </div>

          {/* Transaction List */}
          <div className="space-y-2 font-mono text-xs">
            {[
              { hash: '0x8f2a...3d1c', status: 'indexed', amount: '0.50' },
              { hash: '0x1b4e...7f2a', status: 'indexed', amount: '2.00' },
              { hash: '0x9c3d...8e1b', status: 'pending', amount: '0.10' },
            ].map((tx, i) => (
              <motion.div
                key={tx.hash}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.15 }}
                className="flex items-center justify-between bg-[#0a0a0a] rounded-lg p-3"
              >
                <span className="text-gray-400">{tx.hash}</span>
                <div className="flex items-center gap-3">
                  <span className="text-white">{tx.amount} USDC</span>
                  {tx.status === 'indexed' ? (
                    <CheckCircle2 className="w-4 h-4 text-[#00FF88]" />
                  ) : (
                    <motion.div
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ repeat: Infinity, duration: 1 }}
                      className="w-4 h-4 rounded-full bg-yellow-500"
                    />
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
        <p className="text-gray-500 text-sm mt-4">Real-time Indexing</p>
      </div>
    )
  }

  // Step 3: Outcome - Success/failure recording
  if (step === 3) {
    return (
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[#1a1a1a] border border-[#00FF88] rounded-2xl p-6 shadow-2xl shadow-[#00FF88]/10"
        >
          {/* Success Header */}
          <div className="text-center mb-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", bounce: 0.5 }}
              className="w-16 h-16 bg-[#00FF88] rounded-full flex items-center justify-center mx-auto mb-4"
            >
              <CheckCircle2 className="w-8 h-8 text-black" />
            </motion.div>
            <p className="text-white font-bold text-lg">Service Delivered</p>
            <p className="text-[#00FF88] text-sm">Outcome Recorded</p>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-[#0a0a0a] rounded-xl p-3">
              <p className="text-2xl font-bold text-white">45</p>
              <p className="text-xs text-gray-500">ms latency</p>
            </div>
            <div className="bg-[#0a0a0a] rounded-xl p-3">
              <p className="text-2xl font-bold text-[#00FF88]">✓</p>
              <p className="text-xs text-gray-500">delivered</p>
            </div>
            <div className="bg-[#0a0a0a] rounded-xl p-3">
              <p className="text-2xl font-bold text-white">0.50</p>
              <p className="text-xs text-gray-500">USDC paid</p>
            </div>
          </div>
        </motion.div>
        <p className="text-gray-500 text-sm mt-4">Outcome Tracking</p>
      </div>
    )
  }

  // Step 4: Reputation - Score calculation
  if (step === 4) {
    return (
      <div className="w-full max-w-lg">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 shadow-2xl"
        >
          {/* Score Display */}
          <div className="text-center mb-6">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring" }}
              className="inline-flex items-baseline gap-1"
            >
              <span className="text-6xl font-bold text-[#00FF88]">98.5</span>
              <span className="text-xl text-gray-500">/100</span>
            </motion.div>
            <p className="text-white font-semibold mt-2">Reputation Score</p>
          </div>

          {/* Score Breakdown */}
          <div className="space-y-3">
            {[
              { label: 'Success Rate', value: 98.5, weight: '50%', color: '#00FF88' },
              { label: 'Volume', value: 85.0, weight: '20%', color: '#3B82F6' },
              { label: 'Repeat Customers', value: 92.0, weight: '20%', color: '#8B5CF6' },
              { label: 'Recency', value: 100, weight: '10%', color: '#F59E0B' },
            ].map((factor, i) => (
              <motion.div
                key={factor.label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-3"
              >
                <div className="w-24 text-xs text-gray-400">{factor.label}</div>
                <div className="flex-1 h-2 bg-[#0a0a0a] rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${factor.value}%` }}
                    transition={{ duration: 0.8, delay: i * 0.1 }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: factor.color }}
                  />
                </div>
                <div className="w-12 text-xs text-gray-500 text-right">{factor.weight}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
        <p className="text-gray-500 text-sm mt-4">Reputation Calculation</p>
      </div>
    )
  }

  return null
}

function FeatureSection({
  title,
  description,
  image,
  tags,
  bg,
  reversed = false,
  id
}: {
  title: string,
  description: string,
  image: string,
  tags: string[],
  bg: string,
  reversed?: boolean,
  id?: string
}) {
  return (
    <section id={id} className={`min-h-[100dvh] md:snap-start w-full flex flex-col justify-center px-6 pt-28 pb-12 ${bg} overflow-hidden scroll-mt-0`}>
      <div className="container mx-auto px-6 max-w-7xl">
        <div className={`flex flex-col lg:flex-row items-center gap-16 ${reversed ? 'lg:flex-row-reverse' : ''}`}>
          <motion.div
            initial={{ opacity: 0, x: reversed ? 50 : -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="flex-1 w-full"
          >
            <img src={image} alt={title} className="w-full rounded-[2.5rem] shadow-2xl" />
          </motion.div>
          <div className="flex-1 space-y-8">
            <h2 className="text-4xl md:text-5xl font-bold text-[#111111] leading-tight">{title}</h2>
            <p className="text-xl text-gray-600 leading-relaxed">{description}</p>
            <div className="flex flex-wrap gap-3">
              {tags.map(tag => (
                <span key={tag} className="px-6 py-2 rounded-full border border-gray-300 text-sm font-semibold text-gray-700 bg-white shadow-sm">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Features() {
  return (
    <div id="features" className="w-full">
      <FeatureSection
        id="payment-memory"
        bg="bg-[#E9F9F0]"
        title="Payment Memory & Indexing"
        description="Agents often operate blindly. Relay Core indexes every x402 payment, giving your agents historical memory to assess reliability before spending a single cent."
        image={featurePayment}
        tags={['Historical Data', 'x402 Indexing', 'Latency Tracking']}
      />
      <FeatureSection
        id="reputation"
        bg="bg-[#E6F5F6]"
        title="Reputation Scoring"
        description="Trust signals you can verify. Our deterministic scoring algorithm evaluates success rates, volume, and recency to provide a realtime 0-100 trust score for every service."
        image={featureReputation}
        tags={['Proof of Outcome', 'Real-time Scores', 'Sybil Resistant']}
        reversed
      />
      <FeatureSection
        id="service-discovery"
        bg="bg-[#F6E6E6]"
        title="Service Discovery API"
        description="Don't build scratchers. Use our GraphQL API to instantly find the highest-rated KYC, Oracle, or Data services. Filter by price, reputation, and uptime."
        image={featureDiscovery}
        tags={['GraphQL', 'REST API', '< 100ms Latency']}
      />
    </div>
  )
}

function PricingSection() {
  return (
    <section id="pricing" className="min-h-[100dvh] md:snap-start bg-white w-full flex flex-col justify-center px-6 pt-28 pb-12 scroll-mt-0">
      <div className="container mx-auto px-6 max-w-7xl text-center">
        <h2 className="text-4xl font-bold text-[#111111] mb-4">Simple, Transparent Pricing</h2>
        <p className="text-xl text-gray-500 mb-16 max-w-2xl mx-auto">Start for free, scale as you grow. No hidden fees.</p>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {[
            { name: 'Developer', price: '$0', desc: 'For hacking and experiments', features: ['1,000 requests/mo', 'Basic Reputation Score', 'Community Support'] },
            { name: 'Startup', price: '$49', desc: 'For growing agent networks', features: ['100,000 requests/mo', 'Real-time Webhooks', 'Priority Support', 'Full History Access'], popular: true },
            { name: 'Enterprise', price: 'Custom', desc: 'For large-scale autonomous systems', features: ['Unlimited requests', 'SLA Guarantee', 'Dedicated Account Manager', 'Custom Integrations'] }
          ].map((plan) => (
            <Card key={plan.name} className={`border-2 ${plan.popular ? 'border-[#111111] shadow-2xl scale-105' : 'border-gray-100 shadow-sm'} rounded-[2rem] flex flex-col`}>
              <CardContent className="p-8 flex flex-col h-full">
                {plan.popular && <Badge className="self-center mb-4 bg-[#FFD84D] text-[#111111] hover:bg-[#FFD84D]">Most Popular</Badge>}
                <h3 className="text-2xl font-bold text-[#111111] mb-2">{plan.name}</h3>
                <div className="text-4xl font-bold mb-2">{plan.price}<span className="text-base font-normal text-gray-500">/mo</span></div>
                <p className="text-gray-500 mb-8">{plan.desc}</p>
                <div className="space-y-4 mb-8 flex-1 text-left">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-center gap-3">
                      <CheckCircle2 size={18} className="text-green-600" />
                      <span className="text-gray-700">{f}</span>
                    </div>
                  ))}
                </div>
                <Button className={`w-full h-12 rounded-full ${plan.popular ? 'bg-[#111111] text-white hover:bg-black' : 'bg-gray-100 text-[#111111] hover:bg-gray-200'}`}>
                  Choose {plan.name}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

function Testimonials() {
  return (
    <section className="min-h-[100dvh] md:snap-start bg-white w-full flex flex-col justify-center px-6 pt-28 pb-12">
      <div className="container mx-auto px-6 max-w-7xl">
        <h2 className="text-4xl md:text-5xl font-bold text-center text-[#111111] mb-20">Hear From Our Happy Clients</h2>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <Card className="bg-[#2A4425] text-white border-none p-8 rounded-[2rem] shadow-2xl">
            <CardContent className="space-y-6">
              <h3 className="text-2xl font-bold">FastKYC Oracle</h3>
              <p className="text-white/80 text-lg leading-relaxed">
                "Managing reputation for our oracle node used to be impossible. Relay Core made it effortless. Now agents trust us automatically."
              </p>
              <div className="flex items-center gap-4 pt-4">
                <Avatar className="h-12 w-12 border-2 border-white/20">
                  <AvatarFallback className="bg-white/10 text-white">FO</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-bold">Sarah Jenkins</p>
                  <p className="text-sm text-white/60">Lead Developer</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col justify-center space-y-8 pl-8 border-l border-gray-100">
            <p className="text-2xl font-medium text-gray-800 italic">
              "Relay Trade aggregates liquidity like magic. We get the best execution for our hedging agents every single time."
            </p>
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-black text-white">RT</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-bold text-[#111111]">Alex Thompson</p>
                <p className="text-sm text-gray-500">DeFi Strategist</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer id="docs" className="bg-[#2A4425] text-white w-full flex flex-col justify-center px-6 py-20 scroll-mt-0 md:snap-start">
      <div className="container mx-auto px-6 max-w-7xl">
        <div className="flex flex-col md:flex-row justify-between items-start gap-16">
          <div className="max-w-md space-y-8">
            <h3 className="text-3xl font-bold">Relay Core</h3>
            <p className="text-white/70 text-lg leading-relaxed">
              The payment infrastructure for autonomous agents on Cronos. Get started with trust-scored service discovery and x402 payments today.
            </p>
            <Button className="bg-white text-[#2A4425] hover:bg-gray-100 rounded-full px-8 py-6 text-lg font-bold shadow-lg">
              Get Started Now
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 md:gap-16">
            <div className="space-y-6">
              <h4 className="font-bold text-lg">Product</h4>
              <ul className="space-y-4 text-white/70">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><Link to="/marketplace" className="hover:text-white transition-colors">Marketplace</Link></li>
                <li><Link to="/dashboard/trade" className="hover:text-white transition-colors">Relay Trade</Link></li>
              </ul>
            </div>
            <div className="space-y-6">
              <h4 className="font-bold text-lg">Resources</h4>
              <ul className="space-y-4 text-white/70">
                <li><Link to="/docs" className="hover:text-white transition-colors">Documentation</Link></li>
                <li><a href="https://github.com/relay-core" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GitHub</a></li>
                <li><Link to="/docs/api/rest" className="hover:text-white transition-colors">API Reference</Link></li>
              </ul>
            </div>
            <div className="space-y-6">
              <h4 className="font-bold text-lg">Community</h4>
              <ul className="space-y-4 text-white/70">
                <li><a href="https://x.com/relaycore_" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">X (Twitter)</a></li>
                <li><a href="https://discord.gg/relaycore" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Discord</a></li>
                <li><a href="https://t.me/relaycore" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Telegram</a></li>
              </ul>
            </div>
            <div className="space-y-6">
              <h4 className="font-bold text-lg">Legal</h4>
              <ul className="space-y-4 text-white/70">
                <li><Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
                <li><Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 mt-20 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-white/50 gap-4">
          <p>© 2026 Relay Core. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <span>Built on Cronos</span>
            <span>•</span>
            <span>Powered by x402</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <div className="min-h-[100dvh] bg-white font-sans text-[#111111] w-full overflow-y-auto scroll-smooth selection:bg-[#FFD84D]/50">
      <Navbar onOpenMenu={() => setIsMenuOpen(true)} />

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-white p-6 flex flex-col md:hidden"
          >
            <div className="flex justify-between items-center mb-10">
              <span className="text-xl font-bold">Menu</span>
              <button onClick={() => setIsMenuOpen(false)}><X /></button>
            </div>
            <div className="space-y-6 flex flex-col">
              <button className="text-2xl font-bold text-left" onClick={() => { setIsMenuOpen(false); document.getElementById('features')?.scrollIntoView() }}>Features</button>
              <button className="text-2xl font-bold text-left" onClick={() => { setIsMenuOpen(false); document.getElementById('how-it-works')?.scrollIntoView() }}>How it Works</button>
              <button className="text-2xl font-bold text-left" onClick={() => { setIsMenuOpen(false); document.getElementById('pricing')?.scrollIntoView() }}>Pricing</button>
              <button className="text-2xl font-bold text-left" onClick={() => { setIsMenuOpen(false); document.getElementById('docs')?.scrollIntoView() }}>Docs</button>
              <Button className="w-full bg-[#111111] text-white h-12 text-lg mt-8" onClick={() => navigate('/app')}>Launch App</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="w-full">
        <HeroSection />
        <HowItWorksSection />
        <Features />
        <PricingSection />
        <FAQSection /> {/* FAQ Added */}
        <Testimonials />
        <Footer />
      </main>
    </div>
  )
}


// --- App Entry & Routing ---

import { Routes, Route } from 'react-router-dom'
import { TermsPage } from '@/pages/Terms'
import { PrivacyPage } from '@/pages/Privacy'
import { EntryPage } from '@/pages/Entry'
import { NewAgentPage } from '@/pages/NewAgent'
import { NotFoundPage } from '@/pages/NotFound'
import ServiceDiscovery from '@/pages/ServiceDiscovery'
import RegisterService from '@/pages/RegisterService'
import ServiceDetailPage from '@/pages/ServiceDetailPage'
import Marketplace from '@/pages/Marketplace'
import ACPSSessions from '@/pages/ACPSSessions'
import RWAServices from '@/pages/RWAServices'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/app" element={<EntryPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<DashboardOverview />} />
        <Route path="trade" element={<DashboardTrading />} />
        <Route path="discovery" element={<Navigate to="/dashboard/services" replace />} />
        <Route path="services" element={<ServiceDiscovery />} />
        <Route path="services/register" element={<RegisterService />} />
        <Route path="services/:id" element={<ServiceDetailPage />} />
        <Route path="agents" element={<DashboardAgents />} />
        <Route path="agents/new" element={<NewAgentPage />} />
        <Route path="transactions" element={<DashboardTransactions />} />
        <Route path="reputation" element={<DashboardReputation />} />
        <Route path="acps" element={<ACPSSessions />} />
        <Route path="rwa" element={<RWAServices />} />
        <Route path="settings" element={<DashboardSettings />} />
        <Route path="settings/bot" element={<BotIntegration />} />
      </Route>
      {/* Documentation Routes */}
      <Route path="/docs" element={<DocsLayout><DocsOverview /></DocsLayout>} />
      <Route path="/docs/quickstart" element={<DocsLayout><DocsQuickstart /></DocsLayout>} />
      <Route path="/docs/installation" element={<DocsLayout><DocsInstallation /></DocsLayout>} />
      <Route path="/docs/architecture" element={<DocsLayout><DocsArchitecture /></DocsLayout>} />
      <Route path="/docs/payment-flow" element={<DocsLayout><DocsPaymentFlow /></DocsLayout>} />
      <Route path="/docs/reputation" element={<DocsLayout><DocsReputation /></DocsLayout>} />
      <Route path="/docs/ai-agent" element={<DocsLayout><DocsAIAgent /></DocsLayout>} />
      <Route path="/docs/guides/x402" element={<DocsLayout><DocsX402Guide /></DocsLayout>} />
      <Route path="/docs/guides/eip3009" element={<DocsLayout><DocsEIP3009Guide /></DocsLayout>} />
      <Route path="/docs/guides/erc8004" element={<DocsLayout><DocsERC8004Guide /></DocsLayout>} />
      <Route path="/docs/guides/claude" element={<DocsLayout><DocsClaudeGuide /></DocsLayout>} />
      <Route path="/docs/guides/acps" element={<DocsLayout><DocsACPSGuide /></DocsLayout>} />
      <Route path="/docs/api/rest" element={<DocsLayout><DocsRESTAPI /></DocsLayout>} />
      <Route path="/docs/api/graphql" element={<DocsLayout><DocsGraphQLAPI /></DocsLayout>} />
      <Route path="/docs/api/websocket" element={<DocsLayout><DocsWebSocketAPI /></DocsLayout>} />
      <Route path="/docs/api/sdk" element={<DocsLayout><DocsSDKGuide /></DocsLayout>} />
      <Route path="/docs/api/mcp" element={<DocsLayout><DocsMCPGuide /></DocsLayout>} />
      <Route path="/docs/contracts/identity" element={<DocsLayout><DocsIdentityRegistry /></DocsLayout>} />
      <Route path="/docs/contracts/reputation" element={<DocsLayout><DocsReputationRegistry /></DocsLayout>} />
      <Route path="/docs/contracts/validation" element={<DocsLayout><DocsValidationRegistry /></DocsLayout>} />
      <Route path="/docs/contracts/deployment" element={<DocsLayout><DocsDeployment /></DocsLayout>} />
      <Route path="/docs/examples/trade" element={<DocsLayout><DocsTradeExample /></DocsLayout>} />
      <Route path="/docs/examples/register" element={<DocsLayout><DocsRegisterExample /></DocsLayout>} />
      <Route path="/docs/examples/feedback" element={<DocsLayout><DocsFeedbackExample /></DocsLayout>} />
      <Route path="/docs/examples/validation" element={<DocsLayout><DocsValidationExample /></DocsLayout>} />
      {/* Marketplace Routes (Public) */}
      <Route path="/marketplace" element={<Marketplace />} />
      <Route path="/marketplace/services/:id" element={<ServiceDetailPage />} />
      {/* 404 Catch-all route */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
