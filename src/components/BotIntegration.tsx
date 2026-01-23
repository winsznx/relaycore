import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    MessageCircle, Unlink, RefreshCw, Copy, Check,
    Bell, BellOff, ExternalLink, Shield, Clock
} from 'lucide-react';
import { useAccount } from 'wagmi';

interface LinkedAccount {
    id: string;
    platform: 'telegram' | 'discord';
    platformUsername?: string;
    linkedAt: string;
    lastActiveAt: string;
    isActive: boolean;
}

interface LinkCode {
    code: string;
    expiresAt: Date;
}

export function BotIntegration() {
    const { address, isConnected } = useAccount();
    const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
    const [linkCode, setLinkCode] = useState<LinkCode | null>(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [countdown, setCountdown] = useState(0);

    // Notification state
    const [notifications, setNotifications] = useState({
        payments: true,
        services: true,
        reputation: true,
        health: true,
        dailySummary: true
    });

    useEffect(() => {
        if (isConnected && address) {
            fetchLinkedAccounts();
            fetchNotificationSettings();
        }
    }, [isConnected, address]);

    // Countdown timer for link code
    useEffect(() => {
        if (!linkCode) {
            setCountdown(0);
            return;
        }

        const updateCountdown = () => {
            const remaining = Math.max(0, Math.floor((linkCode.expiresAt.getTime() - Date.now()) / 1000));
            setCountdown(remaining);

            if (remaining === 0) {
                setLinkCode(null);
            }
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);
        return () => clearInterval(interval);
    }, [linkCode]);

    const fetchLinkedAccounts = async () => {
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'https://api.relaycore.xyz';
            const response = await fetch(`${apiUrl}/api/bot/accounts?wallet=${address}`);
            if (response.ok) {
                const data = await response.json();
                setLinkedAccounts(data.accounts || []);
            }
        } catch (error) {
            console.error('Failed to fetch linked accounts:', error);
        }
    };

    const fetchNotificationSettings = async () => {
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'https://api.relaycore.xyz';
            const response = await fetch(`${apiUrl}/api/user/profile?wallet=${address}`);
            if (response.ok) {
                const data = await response.json();
                if (data && data.notifications) {
                    setNotifications({
                        payments: data.notifications.payments ?? true,
                        services: data.notifications.services ?? true,
                        reputation: data.notifications.reputation ?? true,
                        health: data.notifications.health ?? true,
                        dailySummary: data.notifications.dailySummary ?? true
                    });
                }
            }
        } catch (error) {
            console.error('Failed to fetch settings:', error);
        }
    };

    const updateNotification = async (key: keyof typeof notifications, value: boolean) => {
        const newSettings = { ...notifications, [key]: value };
        setNotifications(newSettings); // Optimistic update

        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'https://api.relaycore.xyz';
            await fetch(`${apiUrl}/api/user/profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress: address,
                    notificationPreferences: newSettings
                })
            });
        } catch (error) {
            console.error('Failed to save settings:', error);
            setNotifications(notifications); // Revert on error
        }
    };

    const generateLinkCode = async () => {
        setLoading(true);
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'https://api.relaycore.xyz';
            const response = await fetch(`${apiUrl}/api/bot/link`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress: address }),
            });

            if (response.ok) {
                const data = await response.json();
                setLinkCode({
                    code: data.code,
                    expiresAt: new Date(data.expiresAt),
                });
            }
        } catch (error) {
            console.error('Failed to generate link code:', error);
        } finally {
            setLoading(false);
        }
    };

    const unlinkAccount = async (accountId: string) => {
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'https://api.relaycore.xyz';
            const response = await fetch(`${apiUrl}/api/bot/accounts/${accountId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setLinkedAccounts(prev => prev.filter(a => a.id !== accountId));
            }
        } catch (error) {
            console.error('Failed to unlink account:', error);
        }
    };

    const copyCode = () => {
        if (linkCode) {
            navigator.clipboard.writeText(linkCode.code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const formatCountdown = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (!isConnected) {
        return (
            <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                <CardContent className="p-8 text-center">
                    <Shield className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold">Connect Wallet</h3>
                    <p className="text-gray-500 mt-2">
                        Connect your wallet to link bot accounts
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-[#111111]">Bot Integration</h2>
                <p className="text-gray-500 mt-1">
                    Link your Telegram or Discord account to receive notifications and monitor your services
                </p>
            </div>

            {/* Link New Account */}
            <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MessageCircle className="h-5 w-5" />
                        Link New Account
                    </CardTitle>
                    <CardDescription>
                        Generate a one-time code to link your Telegram bot
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {linkCode ? (
                        <div className="space-y-4">
                            {/* Code Display */}
                            <div className="bg-gray-50 rounded-xl p-6 text-center">
                                <p className="text-sm text-gray-500 mb-2">Your link code:</p>
                                <div className="flex items-center justify-center gap-4">
                                    <code className="text-3xl font-bold font-mono tracking-wider text-[#111111]">
                                        {linkCode.code}
                                    </code>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={copyCode}
                                    >
                                        {copied ? (
                                            <Check className="h-4 w-4 text-green-600" />
                                        ) : (
                                            <Copy className="h-4 w-4" />
                                        )}
                                    </Button>
                                </div>
                                <div className="flex items-center justify-center gap-2 mt-4 text-sm text-gray-500">
                                    <Clock className="h-4 w-4" />
                                    Expires in {formatCountdown(countdown)}
                                </div>
                            </div>

                            {/* Instructions */}
                            <div className="bg-blue-50 rounded-lg p-4">
                                <h4 className="font-medium text-blue-900 mb-2">How to link:</h4>
                                <ol className="text-sm text-blue-800 space-y-1">
                                    <li>1. Open Telegram and search for <strong>@RelayCoreBot</strong></li>
                                    <li>2. Start the bot with /start</li>
                                    <li>3. Send /link {linkCode.code}</li>
                                    <li>4. You're connected!</li>
                                </ol>
                            </div>

                            <Button
                                variant="outline"
                                onClick={() => setLinkCode(null)}
                                className="w-full"
                            >
                                Cancel
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Button
                                    onClick={generateLinkCode}
                                    disabled={loading}
                                    className="bg-[#0088cc] hover:bg-[#006699] h-auto py-4"
                                >
                                    <MessageCircle className="h-5 w-5 mr-2" />
                                    <div className="text-left">
                                        <div className="font-semibold">Telegram</div>
                                        <div className="text-xs opacity-80">Link via bot</div>
                                    </div>
                                </Button>
                                <Button
                                    variant="outline"
                                    disabled
                                    className="h-auto py-4 opacity-50"
                                >
                                    <div className="text-left">
                                        <div className="font-semibold">Discord</div>
                                        <div className="text-xs">Coming soon</div>
                                    </div>
                                </Button>
                            </div>

                            <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg text-sm">
                                <Shield className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                <div className="text-amber-900">
                                    <strong>Security note:</strong> Bot accounts have READ-ONLY access.
                                    They cannot execute payments or modify your services.
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Linked Accounts */}
            <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Linked Accounts</CardTitle>
                        <CardDescription>
                            Manage your connected bot accounts
                        </CardDescription>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchLinkedAccounts}
                    >
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </CardHeader>
                <CardContent>
                    {linkedAccounts.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <MessageCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                            <p>No linked accounts</p>
                            <p className="text-sm">Link a Telegram bot to get started</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {linkedAccounts.map(account => (
                                <div
                                    key={account.id}
                                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-lg ${account.platform === 'telegram'
                                            ? 'bg-[#0088cc]/10 text-[#0088cc]'
                                            : 'bg-[#5865F2]/10 text-[#5865F2]'
                                            }`}>
                                            <MessageCircle className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium capitalize">
                                                    {account.platform}
                                                </span>
                                                {account.platformUsername && (
                                                    <span className="text-gray-500">
                                                        @{account.platformUsername}
                                                    </span>
                                                )}
                                                <Badge variant={account.isActive ? 'default' : 'secondary'}>
                                                    {account.isActive ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                Linked {new Date(account.linkedAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => unlinkAccount(account.id)}
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    >
                                        <Unlink className="h-4 w-4 mr-1" />
                                        Unlink
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Notification Settings */}
            {linkedAccounts.length > 0 && (
                <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Bell className="h-5 w-5" />
                            Notification Settings
                        </CardTitle>
                        <CardDescription>
                            Choose what notifications you receive via bot
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <NotificationToggle
                                label="Payment Received"
                                description="When you receive a payment"
                                checked={notifications.payments}
                                onChange={(v) => updateNotification('payments', v)}
                            />
                            <NotificationToggle
                                label="Payment Sent"
                                description="When you send a payment"
                                checked={false} // Currently forced false/disabled in UI logic
                                onChange={(v) => updateNotification('payments', v)}
                            />
                            <NotificationToggle
                                label="Service Called"
                                description="When your service is called"
                                checked={notifications.services}
                                onChange={(v) => updateNotification('services', v)}
                            />
                            <NotificationToggle
                                label="Reputation Changes"
                                description="When your reputation score changes"
                                checked={notifications.reputation}
                                onChange={(v) => updateNotification('reputation', v)}
                            />
                            <NotificationToggle
                                label="Health Alerts"
                                description="When service health changes"
                                checked={notifications.health}
                                onChange={(v) => updateNotification('health', v)}
                            />
                            <NotificationToggle
                                label="Daily Summary"
                                description="Daily digest at 9 AM"
                                checked={notifications.dailySummary}
                                onChange={(v) => updateNotification('dailySummary', v)}
                            />
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Bot Info */}
            <Card className="border-0 shadow-sm ring-1 ring-gray-100 bg-gradient-to-r from-gray-50 to-white">
                <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-[#0088cc]/10 rounded-lg">
                            <MessageCircle className="h-6 w-6 text-[#0088cc]" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-lg">@RelayCoreBot</h3>
                            <p className="text-gray-500 text-sm mt-1">
                                Monitor services, check reputation, and get payment notifications directly in Telegram
                            </p>
                            <div className="flex gap-3 mt-4">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => window.open('https://t.me/RelayCoreBot', '_blank')}
                                >
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    Open in Telegram
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => window.open('/docs/bot', '_blank')}
                                >
                                    View Docs
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

interface NotificationToggleProps {
    label: string;
    description: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}

function NotificationToggle({ label, description, checked, onChange }: NotificationToggleProps) {
    return (
        <div
            onClick={() => onChange(!checked)}
            className={`flex items-center justify-between p-4 rounded-lg cursor-pointer transition-colors ${checked ? 'bg-green-50 ring-1 ring-green-200' : 'bg-gray-50 hover:bg-gray-100'
                }`}
        >
            <div>
                <div className="font-medium text-sm">{label}</div>
                <div className="text-xs text-gray-500">{description}</div>
            </div>
            {checked ? (
                <Bell className="h-5 w-5 text-green-600" />
            ) : (
                <BellOff className="h-5 w-5 text-gray-400" />
            )}

        </div>
    );
}

export default BotIntegration;
