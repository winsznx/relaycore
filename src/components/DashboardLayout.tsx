import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutDashboard, Users, BarChart3, ShieldCheck, Settings, Bell, Wallet, Menu, TrendingUp, Store, LogOut, Building2, ChevronLeft, ChevronRight, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import logoWhite from '@/assets/relay-white.svg'
import logoIcon from '@/assets/logo-white.svg'
import logoFavicon from '@/assets/relay-favicon.svg'
import { useAppKit, useAppKitAccount } from '@/lib/web3'
import { AIChat } from '@/components/AIChat'

const NAV_ITEMS = [
    { icon: LayoutDashboard, label: 'Overview', path: '/dashboard' },
    { icon: Store, label: 'Services', path: '/dashboard/services' },
    { icon: TrendingUp, label: 'Trade', path: '/dashboard/trade' },
    { icon: Users, label: 'My Agents', path: '/dashboard/agents' },
    { icon: BarChart3, label: 'Transactions', path: '/dashboard/transactions' },
    { icon: ShieldCheck, label: 'Reputation', path: '/dashboard/reputation' },
    { icon: Zap, label: 'x402 Sessions', path: '/dashboard/acps' },
    { icon: Building2, label: 'RWA Settlement', path: '/dashboard/rwa' },
    { icon: Settings, label: 'Configuration', path: '/dashboard/settings' },
]

export function DashboardLayout() {
    const navigate = useNavigate()
    const location = useLocation()
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
    const { open } = useAppKit()
    const { address, isConnected, caipAddress } = useAppKitAccount()
    const [balanceDisplay, setBalanceDisplay] = useState<string | null>(null)
    const [displayName, setDisplayName] = useState<string>('')

    // Fetch user profile for display name
    const fetchProfile = () => {
        if (isConnected && address) {
            fetch(`/api/user/profile?wallet=${address}`)
                .then(res => res.json())
                .then(data => {
                    if (data.displayName) {
                        setDisplayName(data.displayName)
                    } else {
                        setDisplayName(address.slice(0, 6))
                    }
                })
                .catch(() => {
                    setDisplayName(address.slice(0, 6))
                })
        } else {
            setDisplayName('')
        }
    }

    useEffect(() => {
        fetchProfile()
    }, [isConnected, address])

    // Listen for profile updates
    useEffect(() => {
        const handleProfileUpdate = () => {
            fetchProfile()
        }
        window.addEventListener('profileUpdated', handleProfileUpdate)
        return () => window.removeEventListener('profileUpdated', handleProfileUpdate)
    }, [isConnected, address])

    // Fetch balance using Web3 provider when connected
    useEffect(() => {
        if (isConnected && address && window.ethereum) {
            (window.ethereum.request as (args: { method: string; params: string[] }) => Promise<string>)({
                method: 'eth_getBalance',
                params: [address, 'latest']
            }).then((balance: string) => {
                const balanceInCRO = parseInt(balance, 16) / 1e18
                setBalanceDisplay(`${balanceInCRO.toFixed(4)} ${caipAddress?.includes('338') ? 'TCRO' : 'CRO'}`)
            }).catch((err: Error) => {
                console.error('Balance fetch error:', err)
                setBalanceDisplay(null)
            })
        } else {
            setBalanceDisplay(null)
        }
    }, [isConnected, address, caipAddress])

    const truncateAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

    return (
        <div className="flex h-[100dvh] bg-[#F5F5F5] font-sans w-full overflow-hidden">
            {/* Desktop Sidebar */}
            <motion.aside
                initial={{ x: -20, opacity: 0 }}
                animate={{
                    x: 0,
                    opacity: 1,
                    width: isSidebarCollapsed ? '80px' : '288px'
                }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="hidden md:flex bg-[#111111] text-white flex-col m-3 rounded-2xl overflow-visible shadow-2xl shrink-0 relative"
            >
                <div className={cn(
                    "p-6 flex items-center justify-center border-b border-gray-800 relative"
                )}>
                    <div className="flex items-center cursor-pointer" onClick={() => navigate('/')}>
                        {isSidebarCollapsed ? (
                            <img src={logoIcon} alt="Relay" className="h-6 w-6" />
                        ) : (
                            <img src={logoWhite} alt="Relay Core" className="h-6" />
                        )}
                    </div>

                    {/* Toggle Button - Positioned on the right edge */}
                    <button
                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        className="absolute -right-3 top-1/2 -translate-y-1/2 p-1.5 bg-[#111111] border border-gray-700 hover:bg-gray-800 rounded-full transition-colors shadow-lg z-10"
                        aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        {isSidebarCollapsed ? (
                            <ChevronRight size={16} className="text-gray-400" />
                        ) : (
                            <ChevronLeft size={16} className="text-gray-400" />
                        )}
                    </button>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {NAV_ITEMS.map((item) => {
                        const isActive = location.pathname === item.path || (item.path === '/dashboard' && location.pathname === '/dashboard/')
                        return (
                            <button
                                key={item.path}
                                onClick={() => navigate(item.path)}
                                className={cn(
                                    "flex w-full items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200",
                                    isActive
                                        ? "bg-white text-[#111111] shadow-md"
                                        : "text-gray-400 hover:text-white hover:bg-white/5",
                                    isSidebarCollapsed && "justify-center"
                                )}
                                title={isSidebarCollapsed ? item.label : undefined}
                            >
                                <item.icon size={20} className={cn(isActive ? "text-[#111111]" : "text-current")} />
                                {!isSidebarCollapsed && item.label}
                            </button>
                        )
                    })}
                </nav>

                <div className="border-t border-gray-800">
                    <div className={cn(
                        "p-4 m-2",
                        isSidebarCollapsed && "flex flex-col items-center gap-2"
                    )}>
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#FFD84D] to-[#FF8A4C] flex items-center justify-center text-[#111111] font-bold uppercase shrink-0">
                                {isConnected && address ? (displayName ? displayName[0] : 'T') : 'G'}
                            </div>
                            {!isSidebarCollapsed && (
                                <div className="flex-1 overflow-hidden">
                                    <p className="text-sm font-medium text-white truncate">
                                        {isConnected && address ? (displayName || truncateAddress(address)) : 'Guest User'}
                                    </p>
                                    <p className="text-xs text-gray-500 truncate">
                                        {isConnected && address ? truncateAddress(address) : 'View Only'}
                                    </p>
                                </div>
                            )}
                        </div>
                        {!isSidebarCollapsed && isConnected && (
                            <button
                                onClick={() => open()}
                                className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-sm font-medium"
                            >
                                <LogOut size={16} />
                                Disconnect
                            </button>
                        )}
                        {isSidebarCollapsed && isConnected && (
                            <button
                                onClick={() => open()}
                                className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                                title="Disconnect"
                            >
                                <LogOut size={16} />
                            </button>
                        )}
                    </div>
                </div>
            </motion.aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col h-full overflow-hidden relative">
                {/* Mobile Header */}
                <header className="md:hidden bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex items-center justify-between shrink-0 z-30">
                    <div className="flex items-center gap-3">
                        <img src={logoFavicon} alt="Relay" className="h-7 w-7 cursor-pointer" onClick={() => navigate('/')} />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                        <Menu className="text-[#111111]" />
                    </Button>
                </header>

                {/* Mobile Navigation Menu (Overlay) */}
                <AnimatePresence>
                    {isMobileMenuOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="absolute top-[60px] left-0 right-0 bg-[#111111] text-white z-20 rounded-b-2xl shadow-2xl p-4 md:hidden"
                        >
                            <nav className="space-y-1">
                                {NAV_ITEMS.map((item) => {
                                    const isActive = location.pathname === item.path
                                    return (
                                        <button
                                            key={item.path}
                                            onClick={() => { navigate(item.path); setIsMobileMenuOpen(false); }}
                                            className={cn(
                                                "flex w-full items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all",
                                                isActive ? "bg-white text-[#111111]" : "text-gray-400 hover:text-white"
                                            )}
                                        >
                                            <item.icon size={20} />
                                            {item.label}
                                        </button>
                                    )
                                })}
                            </nav>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Desktop Header & Content Wrapper */}
                <div className="flex-1 flex flex-col p-0 md:p-3 md:pl-0 w-full overflow-hidden">
                    <div className="bg-white min-h-full md:rounded-2xl shadow-sm border border-gray-200/60 flex flex-col overflow-hidden">
                        {/* Desktop Header - Fixed at top, not scrolling */}
                        <header className="hidden md:flex shrink-0 bg-white border-b border-gray-100 px-8 py-5 items-center justify-between z-10">
                            <div>
                                <h1 className="text-2xl font-bold text-[#111111]">Dashboard</h1>
                                <p className="text-sm text-gray-500">Welcome back to your command center</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <Button variant="outline" size="icon" className="rounded-full">
                                    <Bell size={18} />
                                </Button>
                                <Button
                                    className="bg-[#111111] text-white rounded-full px-6 hover:bg-black"
                                    onClick={() => open()}
                                >
                                    <Wallet className="mr-2 h-4 w-4" />
                                    {isConnected && address ? (
                                        <span className="flex items-center gap-2">
                                            <span>{balanceDisplay || 'Connected'}</span>
                                            <span className="opacity-25">|</span>
                                            <span>{truncateAddress(address)}</span>
                                        </span>
                                    ) : 'Connect Wallet'}
                                </Button>
                            </div>
                        </header>

                        {/* Page Content - This is the only scroll container */}
                        <div className="flex-1 p-4 md:p-8 overflow-y-auto">
                            <Outlet />
                        </div>
                    </div>
                </div>

                {/* Mobile Bottom Navigation (Icon Only) - Glass Effect */}
                <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/70 backdrop-blur-xl border-t border-white/20 flex justify-around p-2 pb-safe shrink-0 z-30 shadow-[0_-4px_30px_rgba(0,0,0,0.1)]">
                    {NAV_ITEMS.slice(0, 5).map((item) => {
                        const isActive = location.pathname === item.path
                        return (
                            <button
                                key={item.path}
                                onClick={() => navigate(item.path)}
                                className={cn(
                                    "flex flex-col items-center justify-center w-12 h-12 rounded-2xl transition-all duration-200",
                                    isActive
                                        ? "text-[#111111] bg-white/80 shadow-lg backdrop-blur-sm"
                                        : "text-gray-500 hover:text-[#111111] hover:bg-white/40"
                                )}
                            >
                                <item.icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                            </button>
                        )
                    })}
                </div>

                {/* AI Chat Assistant */}
                <AIChat />
            </main>
        </div>
    )
}
