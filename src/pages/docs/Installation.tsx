export default function DocsInstallation() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-4">Installation</h1>
                <p className="text-lg text-gray-600">
                    Set up Relay Core in your development environment.
                </p>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Prerequisites</h2>
                <ul className="space-y-2 text-gray-700">
                    <li className="flex items-start gap-2">
                        <span className="text-gray-400">•</span>
                        <span>Node.js 18 or higher</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-gray-400">•</span>
                        <span>pnpm package manager</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-gray-400">•</span>
                        <span>Git for version control</span>
                    </li>
                </ul>
            </div>

            <div className="space-y-4">
                <h2 className="text-2xl font-bold text-gray-900">Clone Repository</h2>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">git clone https://github.com/relay-core/relay-core.git
                        cd relay-core</code>
                </pre>
            </div>

            <div className="space-y-4">
                <h2 className="text-2xl font-bold text-gray-900">Install Dependencies</h2>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">pnpm install</code>
                </pre>
            </div>

            <div className="space-y-4">
                <h2 className="text-2xl font-bold text-gray-900">Environment Setup</h2>
                <p className="text-gray-700">
                    Create a <code className="px-2 py-1 bg-gray-100 rounded text-sm">.env</code> file:
                </p>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`ANTHROPIC_API_KEY=your_key_here
CRONOS_NETWORK=testnet
PAYMENT_RECIPIENT_ADDRESS=your_wallet_address`}</code>
                </pre>
            </div>

            <div className="space-y-4">
                <h2 className="text-2xl font-bold text-gray-900">Start Development</h2>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`# Terminal 1: Frontend
pnpm dev

# Terminal 2: Backend
pnpm dev:graphql`}</code>
                </pre>
            </div>
        </div>
    );
}
