import { useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import {
    Book,
    Zap,
    Code,
    Layers,
    Terminal,
    Menu,
    X,
    ChevronRight,
    Github,
    Send
} from 'lucide-react';
import { cn } from '@/lib/utils';
import logo from '@/assets/relay-logo.svg';

interface NavSection {
    title: string;
    items: NavItem[];
}

interface NavItem {
    title: string;
    path: string;
    icon?: React.ReactNode;
}

const navigation: NavSection[] = [
    {
        title: 'Getting Started',
        items: [
            { title: 'Overview', path: '/docs' },
            { title: 'Quickstart', path: '/docs/quickstart' },
            { title: 'Installation', path: '/docs/installation' },
        ],
    },
    {
        title: 'Core Concepts',
        items: [
            { title: 'Architecture', path: '/docs/architecture' },
            { title: 'Payment Flow', path: '/docs/payment-flow' },
            { title: 'Reputation System', path: '/docs/reputation' },
            { title: 'AI Trading Agent', path: '/docs/ai-agent' },
        ],
    },
    {
        title: 'Integration Guides',
        items: [
            { title: 'x402 Payments', path: '/docs/guides/x402' },
            { title: 'ACPS Sessions', path: '/docs/guides/acps' },
            { title: 'EIP-3009 Gasless', path: '/docs/guides/eip3009' },
            { title: 'ERC-8004 Registries', path: '/docs/guides/erc8004' },
            { title: 'Claude AI Integration', path: '/docs/guides/claude' },
        ],
    },
    {
        title: 'API Reference',
        items: [
            { title: 'SDK Guide', path: '/docs/api/sdk' },
            { title: 'MCP Server', path: '/docs/api/mcp' },
            { title: 'REST API', path: '/docs/api/rest' },
            { title: 'GraphQL API', path: '/docs/api/graphql' },
            { title: 'WebSocket Events', path: '/docs/api/websocket' },
        ],
    },
    {
        title: 'Smart Contracts',
        items: [
            { title: 'Identity Registry', path: '/docs/contracts/identity' },
            { title: 'Reputation Registry', path: '/docs/contracts/reputation' },
            { title: 'Validation Registry', path: '/docs/contracts/validation' },
            { title: 'Deployment Guide', path: '/docs/contracts/deployment' },
        ],
    },
    {
        title: 'Examples',
        items: [
            { title: 'Execute a Trade', path: '/docs/examples/trade' },
            { title: 'Register an Agent', path: '/docs/examples/register' },
            { title: 'Record Feedback', path: '/docs/examples/feedback' },
            { title: 'Request Validation', path: '/docs/examples/validation' },
        ],
    },
];

export default function DocsLayout({ children }: { children: React.ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();

    const isActive = (path: string) => {
        return location.pathname === path;
    };

    return (
        <div className="min-h-screen bg-white">
            {/* Header - Clean white theme */}
            <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
                <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo */}
                        <div className="flex items-center gap-8">
                            <button
                                onClick={() => navigate('/')}
                                className="flex flex-col items-start gap-0.5 hover:opacity-80 transition-opacity"
                            >
                                <img src={logo} alt="Relay Core" className="h-6" />
                                <div className="text-[10px] font-medium text-gray-500 uppercase tracking-widest ml-0.5">Documentation</div>
                            </button>
                        </div>

                        {/* Desktop Navigation */}
                        <nav className="hidden md:flex items-center gap-6">
                            <a
                                href="https://github.com/relay-core"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-2"
                            >
                                <Github className="w-4 h-4" />
                                <span>GitHub</span>
                            </a>
                            <a
                                href="https://t.me/relay_core"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-2"
                            >
                                <Send className="w-4 h-4" />
                                <span>Telegram</span>
                            </a>
                        </nav>

                        {/* Mobile menu button */}
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
                        >
                            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                    </div>
                </div>
            </header>

            <div className="max-w-screen-2xl mx-auto">
                <div className="flex">
                    {/* Sidebar - Clean white theme like Reown */}
                    <aside className={cn(
                        "fixed md:sticky top-16 left-0 z-40 w-64 h-[calc(100vh-4rem)] overflow-y-auto bg-white border-r border-gray-200 transition-transform duration-300",
                        sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
                    )}>
                        <nav className="p-6 space-y-8">
                            {navigation.map((section) => (
                                <div key={section.title}>
                                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                                        {section.title}
                                    </h3>
                                    <ul className="space-y-1">
                                        {section.items.map((item) => (
                                            <li key={item.path}>
                                                <button
                                                    onClick={() => {
                                                        navigate(item.path);
                                                        setSidebarOpen(false);
                                                    }}
                                                    className={cn(
                                                        "flex w-full items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                                                        isActive(item.path)
                                                            ? "bg-gray-100 text-gray-900"
                                                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                                                    )}
                                                >
                                                    <span>{item.title}</span>
                                                    {isActive(item.path) && (
                                                        <ChevronRight className="w-4 h-4 ml-auto" />
                                                    )}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </nav>
                    </aside>

                    {/* Overlay for mobile */}
                    {sidebarOpen && (
                        <div
                            className="fixed inset-0 bg-black/20 z-30 md:hidden"
                            onClick={() => setSidebarOpen(false)}
                        />
                    )}

                    {/* Main Content - Clean white theme */}
                    <main className="flex-1 min-w-0">
                        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                            {children}
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
}
