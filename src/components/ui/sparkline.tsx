'use client';

import { useMemo, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface SparklineProps {
    data: number[];
    width?: number;
    height?: number;
    className?: string;
    color?: string;
    fillOpacity?: number;
    strokeWidth?: number;
    labels?: string[];
    formatValue?: (value: number) => string;
    interactive?: boolean;
}

export function Sparkline({
    data,
    width = 80,
    height = 24,
    className,
    color = 'currentColor',
    fillOpacity = 0.1,
    strokeWidth = 1.5,
    labels,
    formatValue = (v) => v.toLocaleString(),
    interactive = true,
}: SparklineProps) {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

    const { path, points } = useMemo(() => {
        if (!data || data.length < 2) return { path: null, points: [] };

        const max = Math.max(...data);
        const min = Math.min(...data);
        const range = max - min || 1;

        const pointsArr = data.map((value, index) => {
            const x = (index / (data.length - 1)) * width;
            const y = height - ((value - min) / range) * (height - 4) - 2;
            return { x, y, value };
        });

        const linePath = pointsArr
            .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
            .join(' ');

        const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

        return { path: { linePath, areaPath }, points: pointsArr };
    }, [data, width, height]);

    const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        if (!interactive || !points.length) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const segmentWidth = width / (points.length - 1);
        const index = Math.min(Math.max(Math.round(x / segmentWidth), 0), points.length - 1);

        setHoveredIndex(index);
        setTooltipPos({ x: points[index].x, y: points[index].y });
    }, [interactive, points, width]);

    const handleMouseLeave = useCallback(() => {
        setHoveredIndex(null);
    }, []);

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
        <div className={cn('relative', className)} style={{ width, height }}>
            <svg
                width={width}
                height={height}
                className="overflow-visible cursor-crosshair"
                viewBox={`0 0 ${width} ${height}`}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
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
                {interactive && hoveredIndex !== null && (
                    <>
                        {/* Vertical line at hover position */}
                        <line
                            x1={tooltipPos.x}
                            y1={0}
                            x2={tooltipPos.x}
                            y2={height}
                            stroke={color}
                            strokeWidth={1}
                            strokeDasharray="2,2"
                            opacity={0.5}
                        />
                        {/* Dot at data point */}
                        <circle
                            cx={tooltipPos.x}
                            cy={tooltipPos.y}
                            r={3}
                            fill={color}
                            stroke="white"
                            strokeWidth={1.5}
                        />
                    </>
                )}
            </svg>
            {interactive && hoveredIndex !== null && (
                <div
                    className="absolute z-50 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded shadow-lg pointer-events-none whitespace-nowrap"
                    style={{
                        left: Math.min(tooltipPos.x + 8, width - 60),
                        top: Math.max(tooltipPos.y - 28, 0),
                        transform: tooltipPos.x > width - 60 ? 'translateX(-100%)' : undefined
                    }}
                >
                    <div>{formatValue(points[hoveredIndex].value)}</div>
                    {labels && labels[hoveredIndex] && (
                        <div className="text-gray-400">{labels[hoveredIndex]}</div>
                    )}
                </div>
            )}
        </div>
    );
}

interface MiniBarChartProps {
    data: number[];
    width?: number;
    height?: number;
    className?: string;
    color?: string;
    hoverColor?: string;
    gap?: number;
    labels?: string[];
    formatValue?: (value: number) => string;
    interactive?: boolean;
}

export function MiniBarChart({
    data,
    width = 80,
    height = 24,
    className,
    color = 'currentColor',
    hoverColor,
    gap = 2,
    labels,
    formatValue = (v) => v.toLocaleString(),
    interactive = true,
}: MiniBarChartProps) {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    const bars = useMemo(() => {
        if (!data || data.length === 0) return [];

        const max = Math.max(...data) || 1;
        const barWidth = (width - gap * (data.length - 1)) / data.length;

        return data.map((value, index) => {
            const barHeight = Math.max((value / max) * (height - 4), 2);
            const x = index * (barWidth + gap);
            const y = height - barHeight - 2;
            return { x, y, width: barWidth, height: barHeight, value };
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
        <div className={cn('relative', className)} style={{ width, height }}>
            <svg
                width={width}
                height={height}
                className="overflow-visible"
                viewBox={`0 0 ${width} ${height}`}
            >
                {bars.map((bar, index) => (
                    <rect
                        key={index}
                        x={bar.x}
                        y={bar.y}
                        width={bar.width}
                        height={bar.height}
                        fill={interactive && hoveredIndex === index ? (hoverColor || color) : color}
                        opacity={interactive && hoveredIndex !== null && hoveredIndex !== index ? 0.5 : 1}
                        rx={1}
                        className={interactive ? 'cursor-pointer transition-opacity' : ''}
                        onMouseEnter={() => interactive && setHoveredIndex(index)}
                        onMouseLeave={() => interactive && setHoveredIndex(null)}
                    />
                ))}
            </svg>
            {interactive && hoveredIndex !== null && (
                <div
                    className="absolute z-50 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded shadow-lg pointer-events-none whitespace-nowrap"
                    style={{
                        left: Math.min(bars[hoveredIndex].x + bars[hoveredIndex].width / 2, width - 50),
                        top: Math.max(bars[hoveredIndex].y - 28, -24),
                        transform: 'translateX(-50%)'
                    }}
                >
                    <div>{formatValue(bars[hoveredIndex].value)}</div>
                    {labels && labels[hoveredIndex] && (
                        <div className="text-gray-400">{labels[hoveredIndex]}</div>
                    )}
                </div>
            )}
        </div>
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
