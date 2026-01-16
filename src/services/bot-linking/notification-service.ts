/**
 * Notification Service for Telegram/Discord Bots
 * 
 * Sends real-time notifications to linked bot accounts
 */

import { supabase } from '../../lib/supabase.js';
import logger from '../../lib/logger.js';
import { bot } from './telegram-bot.js';

export interface NotificationPayload {
    type: 'payment_received' | 'payment_sent' | 'service_called' | 'reputation_change' | 'health_alert' | 'daily_summary';
    title: string;
    message: string;
    data?: Record<string, unknown>;
    priority?: 0 | 1 | 2; // 0=normal, 1=high, 2=urgent
}

/**
 * Send notification to a linked account
 */
export async function sendNotification(
    walletAddress: string,
    notification: NotificationPayload
): Promise<boolean> {
    try {
        // Find linked accounts for this wallet
        const { data: accounts, error } = await supabase
            .from('linked_bot_accounts')
            .select(`
                *,
                notification_settings:bot_notification_settings(*)
            `)
            .eq('wallet_address', walletAddress.toLowerCase())
            .eq('is_active', true);

        if (error || !accounts || accounts.length === 0) {
            return false;
        }

        let sent = false;

        for (const account of accounts) {
            const settings = account.notification_settings?.[0];

            // Check if this notification type is enabled
            if (!shouldSendNotification(notification.type, settings)) {
                continue;
            }

            // Format message based on platform
            const formattedMessage = formatNotification(notification);

            if (account.platform === 'telegram') {
                await sendTelegramNotification(account.platform_user_id, formattedMessage);
                sent = true;
            } else if (account.platform === 'discord') {
                // Discord webhook integration (future)
                // await sendDiscordNotification(account.platform_user_id, formattedMessage);
            }

            // Log to notification queue
            await supabase.from('bot_notification_queue').insert({
                linked_account_id: account.id,
                notification_type: notification.type,
                title: notification.title,
                message: notification.message,
                data: notification.data,
                priority: notification.priority || 0,
                is_sent: sent,
                sent_at: sent ? new Date().toISOString() : null,
            });
        }

        return sent;
    } catch (error) {
        logger.error('Failed to send notification', error as Error);
        return false;
    }
}

/**
 * Check if we should send this notification based on user settings
 */
function shouldSendNotification(
    type: NotificationPayload['type'],
    settings?: Record<string, unknown>
): boolean {
    if (!settings) return true; // Default to sending if no settings

    switch (type) {
        case 'payment_received':
            return settings.notify_payments_received !== false;
        case 'payment_sent':
            return settings.notify_payments_sent !== false;
        case 'service_called':
            return settings.notify_service_calls !== false;
        case 'reputation_change':
            return settings.notify_reputation_changes !== false;
        case 'health_alert':
            return settings.notify_health_alerts !== false;
        case 'daily_summary':
            return settings.notify_daily_summary !== false;
        default:
            return true;
    }
}

/**
 * Format notification for display
 */
function formatNotification(notification: NotificationPayload): string {
    const priorityIcon = notification.priority === 2 ? '[URGENT]' :
        notification.priority === 1 ? '[HIGH]' : '[INFO]';

    const typeIcons: Record<NotificationPayload['type'], string> = {
        payment_received: '[RECV]',
        payment_sent: '[SENT]',
        service_called: '[CALL]',
        reputation_change: '[REP]',
        health_alert: '[HEALTH]',
        daily_summary: '[SUMMARY]',
    };

    const icon = typeIcons[notification.type] || '[INFO]';

    return `${priorityIcon} ${icon} *${notification.title}*\n\n${notification.message}`;
}

/**
 * Send Telegram notification
 */
async function sendTelegramNotification(chatId: string, message: string): Promise<void> {
    try {
        await bot.telegram.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
        logger.error('Failed to send Telegram notification', error as Error, { chatId });
    }
}

// ============ NOTIFICATION TRIGGERS ============

/**
 * Notify when payment is received
 */
export async function notifyPaymentReceived(
    toAddress: string,
    fromAddress: string,
    amount: string,
    serviceName?: string
): Promise<void> {
    await sendNotification(toAddress, {
        type: 'payment_received',
        title: 'Payment Received',
        message: `You received *$${amount} USDC* from \`${fromAddress.slice(0, 6)}...${fromAddress.slice(-4)}\`${serviceName ? ` for *${serviceName}*` : ''}.`,
        data: { fromAddress, amount, serviceName },
        priority: 1,
    });
}

/**
 * Notify when payment is sent
 */
export async function notifyPaymentSent(
    fromAddress: string,
    toAddress: string,
    amount: string,
    serviceName?: string
): Promise<void> {
    await sendNotification(fromAddress, {
        type: 'payment_sent',
        title: 'Payment Sent',
        message: `You sent *$${amount} USDC* to \`${toAddress.slice(0, 6)}...${toAddress.slice(-4)}\`${serviceName ? ` for *${serviceName}*` : ''}.`,
        data: { toAddress, amount, serviceName },
        priority: 0,
    });
}

/**
 * Notify when a service is called
 */
export async function notifyServiceCalled(
    ownerAddress: string,
    serviceName: string,
    callerAddress: string,
    success: boolean
): Promise<void> {
    await sendNotification(ownerAddress, {
        type: 'service_called',
        title: 'Service Called',
        message: `*${serviceName}* was called by \`${callerAddress.slice(0, 6)}...${callerAddress.slice(-4)}\`.\n\nResult: ${success ? 'Success' : 'Failed'}`,
        data: { serviceName, callerAddress, success },
        priority: 0,
    });
}

/**
 * Notify when reputation changes significantly
 */
export async function notifyReputationChange(
    walletAddress: string,
    serviceName: string,
    oldScore: number,
    newScore: number
): Promise<void> {
    const change = newScore - oldScore;
    const direction = change > 0 ? 'increased' : 'decreased';

    await sendNotification(walletAddress, {
        type: 'reputation_change',
        title: 'Reputation Update',
        message: `Your reputation for *${serviceName}* ${direction} from *${oldScore.toFixed(1)}* to *${newScore.toFixed(1)}* (${change > 0 ? '+' : ''}${change.toFixed(1)}).`,
        data: { serviceName, oldScore, newScore, change },
        priority: change < -5 ? 1 : 0,
    });
}

/**
 * Notify when service health changes
 */
export async function notifyHealthAlert(
    ownerAddress: string,
    serviceName: string,
    status: 'WORKING' | 'FAILING' | 'FLAKY',
    details?: string
): Promise<void> {
    const statusText = status === 'WORKING' ? 'Online' :
        status === 'FAILING' ? '[FAILING]' : 'Unstable';

    await sendNotification(ownerAddress, {
        type: 'health_alert',
        title: 'Health Alert',
        message: `*${serviceName}* is now ${statusText}.${details ? `\n\n${details}` : ''}`,
        data: { serviceName, status, details },
        priority: status === 'FAILING' ? 2 : status === 'FLAKY' ? 1 : 0,
    });
}

/**
 * Send daily summary
 */
export async function sendDailySummary(walletAddress: string): Promise<void> {
    try {
        // Fetch metrics for the last 24 hours
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const { data: services } = await supabase
            .from('services')
            .select('name, total_calls, reputation_score')
            .eq('owner_address', walletAddress.toLowerCase());

        const { data: payments } = await supabase
            .from('payments')
            .select('amount_usd')
            .eq('to_address', walletAddress.toLowerCase())
            .gte('created_at', yesterday);

        const totalEarnings = (payments || []).reduce(
            (sum, p) => sum + parseFloat(p.amount_usd || '0'),
            0
        );

        const totalCalls = (services || []).reduce(
            (sum, s) => sum + (s.total_calls || 0),
            0
        );

        const avgReputation = services && services.length > 0
            ? services.reduce((sum, s) => sum + (s.reputation_score || 0), 0) / services.length
            : 0;

        await sendNotification(walletAddress, {
            type: 'daily_summary',
            title: 'Daily Summary',
            message:
                `*Your 24-Hour Summary*\n\n` +
                `Earned: *$${totalEarnings.toFixed(2)} USDC*\n` +
                `Service Calls: *${totalCalls}*\n` +
                `Avg Reputation: *${avgReputation.toFixed(1)}*\n` +
                `Active Services: *${services?.length || 0}*`,
            priority: 0,
        });
    } catch (error) {
        logger.error('Failed to send daily summary', error as Error, { walletAddress });
    }
}

/**
 * Process pending notifications from queue
 */
export async function processNotificationQueue(): Promise<void> {
    try {
        const { data: pending, error } = await supabase
            .from('bot_notification_queue')
            .select('*, linked_account:linked_bot_accounts(*)')
            .eq('is_sent', false)
            .order('priority', { ascending: false })
            .order('created_at', { ascending: true })
            .limit(50);

        if (error || !pending) return;

        for (const notification of pending) {
            const account = notification.linked_account;
            if (!account) continue;

            try {
                const formattedMessage = `*${notification.title}*\n\n${notification.message}`;

                if (account.platform === 'telegram') {
                    await sendTelegramNotification(account.platform_user_id, formattedMessage);
                }

                // Mark as sent
                await supabase
                    .from('bot_notification_queue')
                    .update({ is_sent: true, sent_at: new Date().toISOString() })
                    .eq('id', notification.id);
            } catch (err) {
                // Log error but continue processing
                await supabase
                    .from('bot_notification_queue')
                    .update({ error_message: (err as Error).message })
                    .eq('id', notification.id);
            }
        }
    } catch (error) {
        logger.error('Failed to process notification queue', error as Error);
    }
}

export default {
    sendNotification,
    notifyPaymentReceived,
    notifyPaymentSent,
    notifyServiceCalled,
    notifyReputationChange,
    notifyHealthAlert,
    sendDailySummary,
    processNotificationQueue,
};
