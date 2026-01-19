import * as React from 'react';
import { cn } from '@/lib/utils';
import { Sparkline, TrendIndicator } from '@/components/ui/sparkline';
import type { LucideIcon } from 'lucide-react';

interface StatsCardProps {
    title: string;
    value: string | number;
    icon?: LucideIcon;
    trend?: number;
    sparklineData?: number[];
    sparklineColor?: string;
    className?: string;
    isLoading?: boolean;
}

export function StatsCard({
    title,
    value,
    icon: Icon,
    trend,
    sparklineData,
    sparklineColor = '#3b82f6',
    className,
    isLoading = false,
}: StatsCardProps) {
    return (
        <div className={cn(
            'relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm p-5',
            className
        )}>
            <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-500">
                    {title}
                </span>
                {Icon && (
                    <div className="p-2 bg-gray-100 rounded-lg">
                        <Icon className="h-4 w-4 text-gray-500" />
                    </div>
                )}
            </div>
            {isLoading ? (
                <div className="space-y-2">
                    <div className="h-8 w-24 bg-gray-200 animate-pulse rounded" />
                    <div className="h-6 w-20 bg-gray-200 animate-pulse rounded" />
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-gray-900">{value}</span>
                        {trend !== undefined && <TrendIndicator value={trend} />}
                    </div>
                    {sparklineData && sparklineData.length > 0 && (
                        <Sparkline
                            data={sparklineData}
                            color={sparklineColor}
                            width={120}
                            height={32}
                        />
                    )}
                </div>
            )}
        </div>
    );
}

interface StatsGridProps {
    children: React.ReactNode;
    className?: string;
}

export function StatsGrid({ children, className }: StatsGridProps) {
    return (
        <div className={cn('grid grid-cols-2 md:grid-cols-4 gap-4', className)}>
            {children}
        </div>
    );
}

interface StatValueProps {
    label: string;
    value: string | number;
    className?: string;
}

export function StatValue({ label, value, className }: StatValueProps) {
    return (
        <div className={cn('flex flex-col', className)}>
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="text-sm font-medium">{value}</span>
        </div>
    );
}
