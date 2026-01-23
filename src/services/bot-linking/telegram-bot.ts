/**
 * Relay Core Telegram Bot
 * 
 * Read-only bot for monitoring services, reputation, and payments
 * Uses secure API keys linked via dashboard
 */

import { Telegraf, Context, Markup } from 'telegraf';
import { supabase } from '../../lib/supabase.js';
import logger from '../../lib/logger.js';
import http from 'http';
import {
    completeBotLink,
    getLinkedAccount,
    unlinkBotAccount,
} from './telegram-link.js';

// Types
interface BotContext extends Context {
    linkedWallet?: string;
}

// Initialize bot
const bot = new Telegraf<BotContext>(process.env.TELEGRAM_BOT_TOKEN || '');

// Middleware to check linked account
bot.use(async (ctx, next) => {
    if (!ctx.from) return next();

    try {
        // Add 2s timeout to DB call prevents hanging
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('DB Timeout')), 2000));

        const account = await Promise.race([
            getLinkedAccount('telegram', ctx.from.id.toString()),
            timeoutPromise
        ]) as any;

        if (account) {
            ctx.linkedWallet = account.walletAddress;
        }
    } catch (error) {
        // Log locally but don't spam production logs unless critical
    }

    return next();
});

// ============ COMMANDS ============

/**
 * /start - Welcome message
 */
bot.command('start', async (ctx) => {
    const welcomeMessage = `
*Welcome to Relay Core Bot*

I help you monitor your AI services and agent interactions on Cronos.

*What I can do:*
Check service reputation
View payment history
Get real-time notifications
Track performance metrics

*Get started:*
1. Link your wallet using a code from the dashboard
2. Use /link <code> to connect

*Commands:*
/link <code> - Link your wallet
/status - Check connection status
/services - View your services
/reputation - Check reputation scores
/payments - Recent payments
/alerts - Notification settings
/help - Show all commands
`;

    await ctx.replyWithMarkdown(welcomeMessage);
});

/**
 * /help - Show all commands
 */
bot.command('help', async (ctx) => {
    const helpMessage = `
*Available Commands*

*Account:*
/link <code> - Link wallet using dashboard code
/unlink - Disconnect your wallet
/status - Check connection status

*Services:*
/services - List your services
/service <id> - Service details
/reputation - Reputation scores

*Payments:*
/payments - Recent payment history
/earnings - Total earnings summary

*Monitoring:*
/alerts - Configure notifications
/health - Service health status

*Info:*
/help - Show this message
/about - About Relay Core
`;

    await ctx.replyWithMarkdown(helpMessage);
});

/**
 * /link <code> - Link wallet using dashboard code
 */
bot.command('link', async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    const code = args[0];

    if (!code) {
        await ctx.reply(
            'Please provide a link code.\n\n' +
            'Get a code from your Relay Core dashboard:\n' +
            '1. Go to Settings → Bot Integration\n' +
            '2. Click "Generate Link Code"\n' +
            '3. Use /link YOUR_CODE'
        );
        return;
    }

    try {
        const result = await completeBotLink(
            code,
            'telegram',
            ctx.from!.id.toString(),
            ctx.from!.username
        );

        await ctx.replyWithMarkdown(
            `*Wallet linked successfully!*\n\n` +
            `Connected: \`${result.walletAddress.slice(0, 6)}...${result.walletAddress.slice(-4)}\`\n\n` +
            `You can now use all bot commands to monitor your services.`
        );

        logger.info('Telegram account linked', {
            userId: ctx.from!.id,
            wallet: result.walletAddress.slice(0, 10),
        });
    } catch (error) {
        await ctx.reply(
            `${error instanceof Error ? error.message : 'Failed to link account'}\n\n` +
            'Please generate a new code from the dashboard.'
        );
    }
});

/**
 * /unlink - Disconnect wallet
 */
bot.command('unlink', async (ctx) => {
    if (!ctx.linkedWallet) {
        await ctx.reply('No wallet connected. Use /link to connect.');
        return;
    }

    const success = await unlinkBotAccount('telegram', ctx.from!.id.toString());

    if (success) {
        await ctx.reply('Wallet disconnected. Use /link to reconnect.');
    } else {
        await ctx.reply('Failed to disconnect. Please try again.');
    }
});

// Safe DB call helper
const safeGetLinkedAccount = async (platform: string, id: string) => {
    try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('DB Timeout')), 2000));
        return await Promise.race([
            getLinkedAccount(platform as any, id),
            timeoutPromise
        ]) as any;
    } catch (e) {
        return null;
    }
};

/**
 * /status - Check connection status
 */
bot.command('status', async (ctx) => {
    if (!ctx.linkedWallet) {
        await ctx.reply(
            '*Not connected*\n\n' +
            'Use /link <code> to connect your wallet.',
            { parse_mode: 'Markdown' }
        );
        return;
    }

    const account = await safeGetLinkedAccount('telegram', ctx.from!.id.toString());

    if (!account) {
        // Fallback if DB text lookup fails but middleware succeeded
        await ctx.replyWithMarkdown(
            `*Connected*\n\n` +
            `*Wallet:* \`${ctx.linkedWallet.slice(0, 6)}...${ctx.linkedWallet.slice(-4)}\`\n` +
            `_Details temporarily unavailable_`
        );
        return;
    }

    await ctx.replyWithMarkdown(
        `*Connected*\n\n` +
        `*Wallet:* \`${ctx.linkedWallet.slice(0, 6)}...${ctx.linkedWallet.slice(-4)}\`\n` +
        `*Username:* @${account?.platformUsername || 'N/A'}\n` +
        `*Linked:* ${account?.linkedAt.toLocaleDateString()}\n` +
        `*Last Active:* ${account?.lastActiveAt.toLocaleDateString()}`
    );
});

/**
 * /sessions - List active sessions
 */
bot.command('sessions', async (ctx) => {
    if (!ctx.linkedWallet) {
        await ctx.reply('Please link your wallet first. Use /link <code>');
        return;
    }

    try {
        const { data: sessions, error } = await supabase
            .from('escrow_sessions')
            .select('*')
            .or(`client_address.eq.${ctx.linkedWallet.toLowerCase()},provider_address.eq.${ctx.linkedWallet.toLowerCase()}`)
            .eq('status', 'active')
            .limit(5);

        if (error) throw error;

        if (!sessions || sessions.length === 0) {
            await ctx.reply('*No active sessions found*', { parse_mode: 'Markdown' });
            return;
        }

        let message = `*Active Sessions (${sessions.length})*\n\n`;
        for (const session of sessions) {
            message += `• *${session.service_id || 'Unknown Service'}*\n`;
            message += `   Type: ${session.type}\n`;
            message += `   Balance: $${session.current_balance_usd || '0.00'}\n\n`;
        }
        await ctx.replyWithMarkdown(message);
    } catch (error) {
        await ctx.reply('Failed to fetch sessions.');
    }
});

/**
 * /rwa - List RWA assets
 */
bot.command('rwa', async (ctx) => {
    if (!ctx.linkedWallet) {
        await ctx.reply('Please link your wallet first. Use /link <code>');
        return;
    }

    try {
        const { data: assets, error } = await supabase
            .from('rwa_assets')
            .select('*')
            .eq('owner_address', ctx.linkedWallet.toLowerCase())
            .limit(5);

        if (error) throw error;

        if (!assets || assets.length === 0) {
            await ctx.reply('*No RWA assets found*', { parse_mode: 'Markdown' });
            return;
        }

        let message = `*My RWA Assets*\n\n`;
        for (const asset of assets) {
            message += `• *${asset.name}* (${asset.symbol})\n`;
            message += `   Value: $${asset.valuation_usd || '0'}\n`;
            message += `   Status: ${asset.status}\n\n`;
        }
        await ctx.replyWithMarkdown(message);
    } catch (error) {
        await ctx.reply('Failed to fetch RWA assets.');
    }
});

/**
 * /services - List user's services
 */
bot.command('services', async (ctx) => {
    if (!ctx.linkedWallet) {
        await ctx.reply('Please link your wallet first. Use /link <code>');
        return;
    }

    try {
        const { data: services, error } = await supabase
            .from('services')
            .select('*')
            .eq('owner_address', ctx.linkedWallet.toLowerCase())
            .eq('is_active', true)
            .limit(10);

        if (error) throw error;

        if (!services || services.length === 0) {
            await ctx.reply(
                '*No services found*\n\n' +
                'You haven\'t registered any services yet.\n' +
                'Register services at: https://relaycore.xyz/dashboard/services/register',
                { parse_mode: 'Markdown' }
            );
            return;
        }

        let message = `*Your Services (${services.length})*\n\n`;

        for (const service of services) {
            const reputation = service.reputation_score || 0;
            const statusIcon = service.is_active ? '[ON]' : '[OFF]';
            message += `${statusIcon} *${service.name}*\n`;
            message += `   ${reputation.toFixed(1)} reputation\n`;
            message += `   ${service.price_per_call || '0'} USDC/call\n`;
            message += `   ${service.total_calls || 0} total calls\n\n`;
        }

        await ctx.replyWithMarkdown(message);
    } catch (error) {
        logger.error('Failed to fetch services', error as Error);
        await ctx.reply('Failed to fetch services. Please try again.');
    }
});

/**
 * /reputation - Check reputation scores
 */
bot.command('reputation', async (ctx) => {
    if (!ctx.linkedWallet) {
        await ctx.reply('Please link your wallet first. Use /link <code>');
        return;
    }

    try {
        const { data: reputations, error } = await supabase
            .from('agent_reputation')
            .select('*')
            .eq('wallet_address', ctx.linkedWallet.toLowerCase());

        if (error) throw error;

        if (!reputations || reputations.length === 0) {
            await ctx.reply(
                '*No reputation data*\n\n' +
                'Start using services to build your reputation.',
                { parse_mode: 'Markdown' }
            );
            return;
        }

        let message = `*Reputation Summary*\n\n`;

        for (const rep of reputations) {
            const score = rep.reputation_score || 0;
            const emoji = score >= 90 ? '[STAR]' : score >= 70 ? '[GOOD]' : score >= 50 ? '' : '';
            message += `${emoji} *${rep.service_name || 'Service'}*\n`;
            message += `   Score: ${score.toFixed(1)}/100\n`;
            message += `   Success Rate: ${(rep.success_rate || 0).toFixed(1)}%\n`;
            message += `   Total Calls: ${rep.total_calls || 0}\n\n`;
        }

        await ctx.replyWithMarkdown(message);
    } catch (error) {
        logger.error('Failed to fetch reputation', error as Error);
        await ctx.reply('Failed to fetch reputation. Please try again.');
    }
});

/**
 * /payments - Recent payment history
 */
bot.command('payments', async (ctx) => {
    if (!ctx.linkedWallet) {
        await ctx.reply('Please link your wallet first. Use /link <code>');
        return;
    }

    try {
        const { data: payments, error } = await supabase
            .from('payments')
            .select('*')
            .or(`from_address.eq.${ctx.linkedWallet.toLowerCase()},to_address.eq.${ctx.linkedWallet.toLowerCase()}`)
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) throw error;

        if (!payments || payments.length === 0) {
            await ctx.reply(
                '*No payments found*\n\n' +
                'Make or receive your first payment to see history here.',
                { parse_mode: 'Markdown' }
            );
            return;
        }

        let message = `*Recent Payments*\n\n`;

        for (const payment of payments) {
            const isOutgoing = payment.from_address?.toLowerCase() === ctx.linkedWallet?.toLowerCase();
            const icon = isOutgoing ? '[OUT]' : '[IN]';
            const direction = isOutgoing ? 'Sent to' : 'From';
            const otherAddress = isOutgoing ? payment.to_address : payment.from_address;
            const shortAddress = otherAddress ? `${otherAddress.slice(0, 6)}...${otherAddress.slice(-4)}` : 'Unknown';

            message += `${icon} *$${payment.amount_usd || '0.00'}*\n`;
            message += `   ${direction}: \`${shortAddress}\`\n`;
            message += `   ${new Date(payment.created_at).toLocaleDateString()}\n\n`;
        }

        await ctx.replyWithMarkdown(message);
    } catch (error) {
        logger.error('Failed to fetch payments', error as Error);
        await ctx.reply('Failed to fetch payments. Please try again.');
    }
});

/**
 * /earnings - Total earnings summary
 */
bot.command('earnings', async (ctx) => {
    if (!ctx.linkedWallet) {
        await ctx.reply('Please link your wallet first. Use /link <code>');
        return;
    }

    try {
        const { data, error } = await supabase
            .from('payments')
            .select('amount_usd')
            .eq('to_address', ctx.linkedWallet.toLowerCase());

        if (error) throw error;

        const totalEarnings = (data || []).reduce(
            (sum, p) => sum + parseFloat(p.amount_usd || '0'),
            0
        );

        const { count: totalTransactions } = await supabase
            .from('payments')
            .select('*', { count: 'exact', head: true })
            .eq('to_address', ctx.linkedWallet.toLowerCase());

        await ctx.replyWithMarkdown(
            `*Earnings Summary*\n\n` +
            `*Total Earned:* $${totalEarnings.toFixed(2)} USDC\n` +
            `*Transactions:* ${totalTransactions || 0}\n\n` +
            `_View detailed breakdown on the dashboard._`
        );
    } catch (error) {
        logger.error('Failed to fetch earnings', error as Error);
        await ctx.reply('Failed to fetch earnings. Please try again.');
    }
});

/**
 * /alerts - Configure notifications
 */
bot.command('alerts', async (ctx) => {
    if (!ctx.linkedWallet) {
        await ctx.reply('Please link your wallet first. Use /link <code>');
        return;
    }

    await ctx.reply(
        '*Notification Settings*\n\n' +
        'Configure alerts on the dashboard:\n' +
        'Settings → Notifications → Bot Alerts\n\n' +
        '*Available alerts:*\n' +
        '• Payment received\n' +
        '• Service called\n' +
        '• Reputation changes\n' +
        '• Health alerts\n' +
        '• Daily summary',
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.url('Open Settings', 'https://relaycore.xyz/dashboard/settings')],
            ]),
        }
    );
});

/**
 * /about - About Relay Core
 */
bot.command('about', async (ctx) => {
    await ctx.replyWithMarkdown(
        `*Relay Core*\n\n` +
        `The discovery and payment layer for AI agents on Cronos.\n\n` +
        `*Features:*\n` +
        `• Service Discovery\n` +
        `• Reputation System\n` +
        `• x402 Payments\n` +
        `• PerpAI Aggregator\n\n` +
        `Website: https://relaycore.xyz\n` +
        `Docs: https://docs.relaycore.xyz`
    );
});

// ============ ERROR HANDLING ============

bot.catch((err, ctx) => {
    logger.error('Telegram bot error', err as Error, {
        updateType: ctx.updateType,
        userId: ctx.from?.id,
    });
});

// ============ BOT STARTUP ============

export async function startTelegramBot(): Promise<void> {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
        logger.warn('TELEGRAM_BOT_TOKEN not set, bot will not start');
        return;
    }

    try {
        const webhookDomain = process.env.WEBHOOK_DOMAIN;

        if (webhookDomain) {
            console.log('Starting bot in webhook mode with domain:', webhookDomain);

            try {
                // await bot.telegram.setWebhook(`https://${webhookDomain}/telegram-webhook`);
            } catch (e) {
                console.warn('Skipping setWebhook (likely 429)', e);
            }

            // Start the webhook server manually using http.createServer
            // This avoids Telegraf's internal launch mechanisms that might force setWebhook
            const callback = bot.webhookCallback('/telegram-webhook');
            http.createServer(callback).listen(4002, () => {
                logger.info('Telegram bot started in webhook mode');
                console.log('Bot server listening on port 4002');
            });

        } else {
            console.log('Starting bot in polling mode...');
            bot.launch().then(() => {
                logger.info('Telegram bot started in polling mode');
            }).catch((error) => {
                logger.error('Failed to start polling', error as Error);
            });
        }

        console.log('Telegram bot launch initiated');
        process.once('SIGINT', () => bot.stop('SIGINT'));
        process.once('SIGTERM', () => bot.stop('SIGTERM'));
    } catch (error) {
        logger.error('Failed to start Telegram bot', error as Error);
        console.error('Bot launch error:', error);
    }
}


export async function stopTelegramBot(): Promise<void> {
    bot.stop('Manual stop');
    logger.info('Telegram bot stopped');
}

export { bot };
export default bot;
