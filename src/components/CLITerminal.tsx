import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Terminal, Check, ChevronRight, Copy, Play } from 'lucide-react'

// --- Types ---
type LineType = 'command' | 'output' | 'success' | 'info' | 'error' | 'spinner'

interface TerminalLine {
    id: string
    type: LineType
    content: string
    delay?: number
}

interface CommandScenario {
    id: string
    label: string
    command: string
    lines: TerminalLine[]
}

// --- Scenarios Data ---
const SCENARIOS: CommandScenario[] = [
    {
        id: 'init',
        label: 'Scaffold Project',
        command: 'relaycore init defect-detection-agent',
        lines: [
            { id: '1', type: 'info', content: '🚀 RelayCore Project Initializer' },
            { id: '2', type: 'spinner', content: 'Creating project structure...' },
            { id: '3', type: 'spinner', content: 'Installing dependencies...' },
            { id: '4', type: 'spinner', content: 'Initializing git repository...' },
            { id: '5', type: 'success', content: '✅ Project created successfully!' },
            { id: '6', type: 'output', content: 'Next steps:' },
            { id: '7', type: 'output', content: '  cd defect-detection-agent' },
            { id: '8', type: 'output', content: '  relaycore dev' },
        ]
    },
    {
        id: 'register',
        label: 'Register Agent',
        command: 'relaycore agent register',
        lines: [
            { id: '1', type: 'info', content: '🔐 RelayCore Authentication' },
            { id: '2', type: 'output', content: '? Select environment: testnet' },
            { id: '3', type: 'success', content: '✅ Logged in to testnet' },
            { id: '4', type: 'info', content: ' ' },
            { id: '5', type: 'info', content: '🤖 Register Agent' },
            { id: '6', type: 'output', content: '? Agent Name: Defect Detector 01' },
            { id: '7', type: 'output', content: '? Capabilities: [image_analysis, cronos_payment]' },
            { id: '8', type: 'spinner', content: 'Registering identity on-chain...' },
            { id: '9', type: 'success', content: '✅ Agent registered: agt_8xdf92m' },
        ]
    },
    {
        id: 'dev',
        label: 'Start Dev Env',
        command: 'relaycore dev',
        lines: [
            { id: '1', type: 'info', content: '🚀 Starting Development Environment' },
            { id: '2', type: 'success', content: '✓ Configuration valid (.env found)' },
            { id: '3', type: 'info', content: '📦 Starting services...' },
            { id: '4', type: 'output', content: '[agent] ▸ Starting MCP server on port 3001...' },
            { id: '5', type: 'output', content: '[web]   ▸ Next.js ready at http://localhost:3000' },
            { id: '6', type: 'success', content: '[agent] ✓ Tools registered: 63' },
            { id: '7', type: 'success', content: '[agent] ✓ Connected to Cronos Testnet' },
        ]
    }
]

export function CLITerminal() {
    const [activeScenarioIndex, setActiveScenarioIndex] = useState(0)
    const [visibleLines, setVisibleLines] = useState<TerminalLine[]>([])
    const [isTyping, setIsTyping] = useState(false)
    const [typedCommand, setTypedCommand] = useState('')
    const scrollRef = useRef<HTMLDivElement>(null)

    const activeScenario = SCENARIOS[activeScenarioIndex]

    // Auto-run scenario logic
    useEffect(() => {
        let active = true
        let timeouts: NodeJS.Timeout[] = []

        const playScenario = async () => {
            // Reset
            setVisibleLines([])
            setTypedCommand('')
            setIsTyping(true)

            // 1. Type Command
            const cmd = activeScenario.command
            for (let i = 0; i <= cmd.length; i++) {
                if (!active) return
                setTypedCommand(cmd.slice(0, i))
                await new Promise(r => setTimeout(r, 50)) // Typing speed
            }
            setIsTyping(false)

            await new Promise(r => setTimeout(r, 500)) // Pause before execution

            // 2. Stream Lines
            let currentLines: TerminalLine[] = []
            for (const line of activeScenario.lines) {
                if (!active) return

                // Add line
                currentLines = [...currentLines, line]
                setVisibleLines(currentLines)

                // Scroll to bottom
                if (scrollRef.current) {
                    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
                }

                // Variable delay based on line type
                const delay = line.type === 'spinner' ? 800 : 150
                await new Promise(r => setTimeout(r, delay))

                // Update spinner to "done" visual if needed (abstracted here by just showing next line)
            }

            await new Promise(r => setTimeout(r, 3000)) // Wait before next scenario

            // Next scenario
            if (active) {
                setActiveScenarioIndex((prev) => (prev + 1) % SCENARIOS.length)
            }
        }

        playScenario()

        return () => {
            active = false
            timeouts.forEach(clearTimeout)
        }
    }, [activeScenarioIndex])

    return (
        <div className="w-full max-w-3xl mx-auto perspective-1000">
            <motion.div
                initial={{ opacity: 0, y: 20, rotateX: 5 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{ duration: 0.8 }}
                className="relative bg-[#0F1117] rounded-xl border border-white/10 shadow-2xl overflow-hidden font-mono text-sm md:text-base group"
            >
                {/* Glow Effects */}
                <div className="absolute -inset-1 bg-gradient-to-r from-[#2A4425]/20 to-[#5C40D0]/20 blur-xl opacity-50 group-hover:opacity-75 transition-opacity duration-1000" />

                {/* Window Header */}
                <div className="relative flex items-center justify-between px-4 py-3 bg-[#1A1D24] border-b border-white/5">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]" />
                        <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]" />
                        <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]" />
                    </div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-gray-400 text-xs flex items-center gap-2">
                        <Terminal size={12} />
                        <span>relaycore-cli — zsh</span>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Scenario Tabs */}
                        <div className="hidden sm:flex bg-black/20 rounded-lg p-0.5">
                            {SCENARIOS.map((s, i) => (
                                <button
                                    key={s.id}
                                    onClick={() => setActiveScenarioIndex(i)}
                                    className={cn(
                                        "px-2 py-0.5 text-[10px] rounded-md transition-all",
                                        activeScenarioIndex === i
                                            ? "bg-white/10 text-white shadow-sm"
                                            : "text-gray-500 hover:text-gray-300"
                                    )}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Terminal Body */}
                <div
                    ref={scrollRef}
                    className="relative h-[320px] md:h-[400px] overflow-y-auto p-4 md:p-6 space-y-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
                >
                    {/* Command Prompt */}
                    <div className="flex items-center gap-3 text-white">
                        <span className="text-[#2A4425] font-bold">➜</span>
                        <span className="text-[#5C40D0] font-bold">~</span>
                        <div className="flex gap-2">
                            <span className="text-gray-300">{typedCommand}</span>
                            {isTyping && (
                                <motion.span
                                    animate={{ opacity: [1, 0] }}
                                    transition={{ repeat: Infinity, duration: 0.8 }}
                                    className="w-2.5 h-5 bg-white block"
                                />
                            )}
                        </div>
                    </div>

                    {/* Output History */}
                    <AnimatePresence>
                        {visibleLines.map((line) => (
                            <motion.div
                                key={line.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={cn(
                                    "leading-relaxed break-words",
                                    line.type === 'command' && "font-bold text-white",
                                    line.type === 'success' && "text-[#00FF88] flex items-center gap-2",
                                    line.type === 'error' && "text-red-400",
                                    line.type === 'info' && "text-blue-300 font-bold mt-2 mb-1",
                                    line.type === 'spinner' && "text-gray-400 flex items-center gap-2",
                                    line.type === 'output' && "text-gray-300 ml-2"
                                )}
                            >
                                {line.type === 'spinner' && (
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                                        className="w-3 h-3 border-2 border-gray-500 border-t-transparent rounded-full"
                                    />
                                )}
                                <span>{line.content}</span>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                {/* Status Bar */}
                <div className="bg-[#1A1D24] px-4 py-1.5 border-t border-white/5 flex justify-between text-[10px] text-gray-500">
                    <div className="flex gap-3">
                        <span>node v20.10.0</span>
                        <span>relaycore v0.1.0</span>
                    </div>
                    <div className="flex gap-3">
                        <span className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#00FF88] animate-pulse" />
                            Online
                        </span>
                        <span>UTF-8</span>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
