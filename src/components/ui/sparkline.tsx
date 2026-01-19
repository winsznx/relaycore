'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface SparklineProps {
    data: number[];
    width?: number;
    height?: number;
    className?: string;
    color?: string;
    fillOpacity?: number;
    strokeWidth?: number;
}

export function Sparkline({
    data,
    width = 80,
    height = 24,
    className,
    color = 'currentColor',
    fillOpacity = 0.1,
    strokeWidth = 1.5,
}: SparklineProps) {
    const path = useMemo((): { linePath: string; areaPath: string } | null => {
        if (!data || data.length < 2) return null;

        const max = Math.max(...data);
        const min = Math.min(...data);
        const range = max - min || 1;

        const points = data.map((value, index) => {
            const x = (index / (data.length - 1)) * width;
            const y = height - ((value - min) / range) * (height - 4) - 2;
            return { x, y };
        });

        const linePath = points
            .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
            .join(' ');

        const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

        return { linePath, areaPath };
    }, [data, width, height]);

    if (!path) {
        return (
            <div
                className={cn('flex items-center justify-center', className)}
                style={{ width, height }}
            >
                <span className="text-xs text-muted-foreground">-</span>
            </div>
        );
    }

    return (
        <svg
            width={width}
            height={height}
            className={cn('overflow-visible', className)}
            viewBox={`0 0 ${width} ${height}`}
        >
            <path
                d={path.areaPath}
                fill={color}
                fillOpacity={fillOpacity}
            />
            <path
                d={path.linePath}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

interface MiniBarChartProps {
    data: number[];
    width?: number;
    height?: number;
    className?: string;
    color?: string;
    gap?: number;
}

export function MiniBarChart({
    data,
    width = 80,
    height = 24,
    className,
    color = 'currentColor',
    gap = 2,
}: MiniBarChartProps) {
    const bars = useMemo(() => {
        if (!data || data.length === 0) return [];

        const max = Math.max(...data) || 1;
        const barWidth = (width - gap * (data.length - 1)) / data.length;

        return data.map((value, index) => {
            const barHeight = (value / max) * (height - 4);
            const x = index * (barWidth + gap);
            const y = height - barHeight - 2;
            return { x, y, width: barWidth, height: barHeight };
        });
    }, [data, width, height, gap]);

    if (!data || data.length === 0) {
        return (
            <div
                className={cn('flex items-center justify-center', className)}
                style={{ width, height }}
            >
                <span className="text-xs text-muted-foreground">-</span>
            </div>
        );
    }

    return (
        <svg
            width={width}
            height={height}
            className={cn('overflow-visible', className)}
            viewBox={`0 0 ${width} ${height}`}
        >
            {bars.map((bar, index) => (
                <rect
                    key={index}
                    x={bar.x}
                    y={bar.y}
                    width={bar.width}
                    height={bar.height}
                    fill={color}
                    rx={1}
                />
            ))}
        </svg>
    );
}

interface TrendIndicatorProps {
    value: number;
    className?: string;
    showIcon?: boolean;
}

export function TrendIndicator({ value, className, showIcon = true }: TrendIndicatorProps) {
    const isPositive = value > 0;
    const isNeutral = value === 0;

    return (
        <span
            className={cn(
                'inline-flex items-center gap-0.5 text-xs font-mono px-1.5 py-0.5 rounded',
                isPositive && 'bg-green-500/10 text-green-600 dark:text-green-400',
                isNeutral && 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
                !isPositive && !isNeutral && 'bg-red-500/10 text-red-600 dark:text-red-400',
                className
            )}
        >
            {isPositive ? '+' : ''}{value.toFixed(1)}%
            {showIcon && (
                <svg
                    className="h-3 w-3"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                >
                    {isPositive ? (
                        <path d="M2 8 L6 4 L10 8" />
                    ) : isNeutral ? (
                        <path d="M2 6 L10 6" />
                    ) : (
                        <path d="M2 4 L6 8 L10 4" />
                    )}
                </svg>
            )}
        </span>
    );
}
