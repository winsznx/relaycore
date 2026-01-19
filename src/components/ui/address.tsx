'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

interface AddressProps {
    address: string | number | null | undefined;
    className?: string;
    short?: boolean;
    disableCopy?: boolean;
    hideTooltip?: boolean;
    mono?: boolean;
}

export function formatAddress(address: string): string {
    if (!address || address.length < 10) return address || '-';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function Address({
    address,
    className,
    short = true,
    disableCopy = false,
    hideTooltip = false,
    mono = true,
}: AddressProps) {
    const [copied, setCopied] = useState(false);

    if (!address) {
        return <span className={cn('text-muted-foreground', className)}>-</span>;
    }

    const addressStr = String(address);
    const displayAddress = short ? formatAddress(addressStr) : addressStr;

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation();
        await navigator.clipboard.writeText(addressStr);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const content = (
        <span
            className={cn(
                'inline-flex items-center gap-1 text-sm',
                mono && 'font-mono',
                !disableCopy && 'cursor-pointer hover:text-primary transition-colors',
                className
            )}
            onClick={!disableCopy ? handleCopy : undefined}
        >
            <span className="text-blue-600 dark:text-blue-400">{displayAddress}</span>
            {!disableCopy && (
                <span className="text-muted-foreground">
                    {copied ? (
                        <Check className="h-3 w-3 text-green-500" />
                    ) : (
                        <Copy className="h-3 w-3 opacity-50 hover:opacity-100" />
                    )}
                </span>
            )}
        </span>
    );

    if (hideTooltip || !short) {
        return content;
    }

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>{content}</TooltipTrigger>
                <TooltipContent side="top" className="font-mono text-xs">
                    {addressStr}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

interface TxHashProps {
    hash: string | null | undefined;
    className?: string;
    explorerUrl?: string;
}

export function TxHash({ hash, className, explorerUrl }: TxHashProps) {
    if (!hash) {
        return <span className={cn('text-muted-foreground', className)}>-</span>;
    }

    const displayHash = formatAddress(hash);
    const url = explorerUrl || `https://explorer.cronos.org/testnet/tx/${hash}`;

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
                'font-mono text-sm text-blue-600 dark:text-blue-400 hover:underline',
                className
            )}
            onClick={(e) => e.stopPropagation()}
        >
            {displayHash}
        </a>
    );
}
