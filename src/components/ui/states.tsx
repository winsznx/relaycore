/**
 * Production UI Components
 * 
 * Features:
 * - Skeleton loading states
 * - Error boundaries
 * - Empty states
 * - Toast notifications
 * - Accessibility support
 */

import React, { Component, type ReactNode } from 'react';
import { Loader2, AlertCircle, RefreshCw, WifiOff, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

// ============================================
// SKELETON COMPONENTS
// ============================================

interface SkeletonProps {
    className?: string;
    animate?: boolean;
}

export function Skeleton({ className = '', animate = true }: SkeletonProps) {
    return (
        <div
            className={`bg-gray-200 rounded ${animate ? 'animate-pulse' : ''} ${className}`}
            role="status"
            aria-label="Loading..."
        />
    );
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
    return (
        <div className={`space-y-2 ${className}`}>
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton
                    key={i}
                    className={`h-4 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
                />
            ))}
        </div>
    );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
    return (
        <Card className={`border-0 shadow-sm ${className}`}>
            <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-3 w-1/3" />
                    </div>
                </div>
                <SkeletonText lines={2} />
                <div className="flex justify-between">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-6 w-16" />
                </div>
            </CardContent>
        </Card>
    );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex gap-4 px-4 py-2 bg-gray-50 rounded-t-lg">
                {Array.from({ length: cols }).map((_, i) => (
                    <Skeleton key={i} className="h-4 flex-1" />
                ))}
            </div>
            {/* Rows */}
            {Array.from({ length: rows }).map((_, rowIdx) => (
                <div key={rowIdx} className="flex gap-4 px-4 py-3 border-b border-gray-100">
                    {Array.from({ length: cols }).map((_, colIdx) => (
                        <Skeleton key={colIdx} className="h-4 flex-1" />
                    ))}
                </div>
            ))}
        </div>
    );
}

export function SkeletonStats({ count = 3 }: { count?: number }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: count }).map((_, i) => (
                <Card key={i} className="border-0 shadow-sm bg-gray-50/50">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                            <Skeleton className="h-10 w-10 rounded-lg" />
                            <Skeleton className="h-5 w-20 rounded-full" />
                        </div>
                        <Skeleton className="h-8 w-24 mb-2" />
                        <Skeleton className="h-4 w-16" />
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

// ============================================
// LOADING STATES
// ============================================

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    text?: string;
    className?: string;
}

export function LoadingSpinner({ size = 'md', text, className = '' }: LoadingSpinnerProps) {
    const sizeClasses = {
        sm: 'h-4 w-4',
        md: 'h-8 w-8',
        lg: 'h-12 w-12',
    };

    return (
        <div className={`flex flex-col items-center justify-center gap-3 ${className}`} role="status">
            <Loader2 className={`${sizeClasses[size]} animate-spin text-gray-400`} />
            {text && <p className="text-sm">{text}</p>}
            <span className="sr-only">Loading...</span>
        </div>
    );
}

export function LoadingOverlay({ text = 'Loading...' }: { text?: string }) {
    return (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
            <LoadingSpinner size="lg" text={text} />
        </div>
    );
}

export function LoadingPage() {
    return (
        <div className="min-h-[400px] flex items-center justify-center">
            <LoadingSpinner size="lg" text="Loading content..." />
        </div>
    );
}

// ============================================
// ERROR STATES
// ============================================

interface ErrorStateProps {
    title?: string;
    message?: string;
    onRetry?: () => void;
    retrying?: boolean;
    className?: string;
}

export function ErrorState({
    title = 'Something went wrong',
    message = 'An unexpected error occurred. Please try again.',
    onRetry,
    retrying = false,
    className = '',
}: ErrorStateProps) {
    return (
        <div className={`flex flex-col items-center justify-center p-8 text-center ${className}`} role="alert">
            <div className="h-16 w-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
                <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
            <p className="text-gray-500 max-w-md mb-6">{message}</p>
            {onRetry && (
                <Button onClick={onRetry} disabled={retrying} variant="outline">
                    {retrying ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Retrying...
                        </>
                    ) : (
                        <>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Try Again
                        </>
                    )}
                </Button>
            )}
        </div>
    );
}

export function NetworkError({ onRetry }: { onRetry?: () => void }) {
    return (
        <ErrorState
            title="Connection Lost"
            message="Unable to connect to the server. Please check your internet connection."
            onRetry={onRetry}
        />
    );
}

export function NotFoundError() {
    return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="text-6xl font-bold text-gray-200 mb-4">404</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Page Not Found</h3>
            <p className="text-gray-500 dark:text-gray-300">The page you're looking for doesn't exist.</p>
        </div>
    );
}

// ============================================
// EMPTY STATES
// ============================================

interface EmptyStateProps {
    icon?: ReactNode;
    title: string;
    description?: string;
    action?: ReactNode;
    className?: string;
}

export function EmptyState({
    icon,
    title,
    description,
    action,
    className = '',
}: EmptyStateProps) {
    return (
        <div className={`flex flex-col items-center justify-center p-8 text-center ${className}`}>
            {icon && <div className="mb-4">{icon}</div>}
            <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
            {description && <p className="text-gray-500 max-w-md mb-6">{description}</p>}
            {action}
        </div>
    );
}

export function NoResultsState({ searchTerm }: { searchTerm?: string }) {
    return (
        <EmptyState
            icon={
                <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center">
                    <Search className="h-8 w-8 text-gray-400 dark:text-gray-400" />
                </div>
            }
            title={searchTerm ? `No results for "${searchTerm}"` : 'No results found'}
            description="Try adjusting your search or filters."
        />
    );
}

export function OfflineState() {
    return (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-gray-900 text-white p-4 rounded-lg shadow-lg flex items-center gap-3 z-50">
            <WifiOff className="h-5 w-5 text-yellow-400 shrink-0" />
            <div>
                <p className="font-medium">You're offline</p>
                <p className="text-sm text-gray-400 dark:text-gray-400">Some features may be unavailable</p>
            </div>
        </div>
    );
}

// ============================================
// ERROR BOUNDARY
// ============================================

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        console.error('Error caught by boundary:', error, errorInfo);
        this.props.onError?.(error, errorInfo);

        // Send to error tracking service
        if (typeof window !== 'undefined') {
            // Only import Sentry in browser
            import('@/lib/monitoring').then(({ captureException }) => {
                captureException(error, {
                    componentStack: errorInfo.componentStack,
                    errorBoundary: true,
                });
            }).catch(console.error);
        }
    }

    handleRetry = (): void => {
        this.setState({ hasError: false, error: null });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-[300px] flex items-center justify-center p-8">
                    <ErrorState
                        title="Something went wrong"
                        message={this.state.error?.message || 'An unexpected error occurred'}
                        onRetry={this.handleRetry}
                    />
                </div>
            );
        }

        return this.props.children;
    }
}

// ============================================
// ASYNC BOUNDARY (Combines Loading + Error)
// ============================================

interface AsyncBoundaryProps<T> {
    isLoading: boolean;
    isError: boolean;
    error?: { message: string } | null;
    data: T | null;
    loadingFallback?: ReactNode;
    errorFallback?: ReactNode;
    emptyFallback?: ReactNode;
    onRetry?: () => void;
    children: (data: T) => ReactNode;
}

export function AsyncBoundary<T>({
    isLoading,
    isError,
    error,
    data,
    loadingFallback,
    errorFallback,
    emptyFallback,
    onRetry,
    children,
}: AsyncBoundaryProps<T>): React.ReactElement {
    if (isLoading) {
        return <>{loadingFallback || <LoadingSpinner size="md" />}</>;
    }

    if (isError) {
        return (
            <>
                {errorFallback || (
                    <ErrorState
                        message={error?.message}
                        onRetry={onRetry}
                    />
                )}
            </>
        );
    }

    if (!data || (Array.isArray(data) && data.length === 0)) {
        return (
            <>
                {emptyFallback || (
                    <EmptyState
                        title="No data"
                        description="There's nothing here yet."
                    />
                )}
            </>
        );
    }

    return <>{children(data)}</>;
}

// ============================================
// TOAST NOTIFICATIONS (Simple Implementation)
// ============================================

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
}

let toastListeners: Array<(toasts: Toast[]) => void> = [];
let toasts: Toast[] = [];

function notifyListeners() {
    toastListeners.forEach(listener => listener([...toasts]));
}

export const toast = {
    show(type: ToastType, title: string, message?: string, duration = 5000): string {
        const id = `toast_${Date.now()}`;
        toasts.push({ id, type, title, message, duration });
        notifyListeners();

        if (duration > 0) {
            setTimeout(() => {
                this.dismiss(id);
            }, duration);
        }

        return id;
    },

    success(title: string, message?: string) {
        return this.show('success', title, message);
    },

    error(title: string, message?: string) {
        return this.show('error', title, message);
    },

    warning(title: string, message?: string) {
        return this.show('warning', title, message);
    },

    info(title: string, message?: string) {
        return this.show('info', title, message);
    },

    dismiss(id: string) {
        toasts = toasts.filter(t => t.id !== id);
        notifyListeners();
    },

    subscribe(listener: (toasts: Toast[]) => void) {
        toastListeners.push(listener);
        return () => {
            toastListeners = toastListeners.filter(l => l !== listener);
        };
    },
};

// Toast container component
export function ToastContainer() {
    const [currentToasts, setToasts] = React.useState<Toast[]>([]);

    React.useEffect(() => {
        return toast.subscribe(setToasts);
    }, []);

    if (currentToasts.length === 0) return null;

    const typeStyles = {
        success: 'bg-green-50 border-green-200 text-green-800',
        error: 'bg-red-50 border-red-200 text-red-800',
        warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
        info: 'bg-blue-50 border-blue-200 text-blue-800',
    };

    return (
        <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
            {currentToasts.map(t => (
                <div
                    key={t.id}
                    className={`p-4 rounded-lg border shadow-lg animate-in slide-in-from-right ${typeStyles[t.type]}`}
                    role="alert"
                >
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="font-medium">{t.title}</p>
                            {t.message && <p className="text-sm opacity-80 mt-1">{t.message}</p>}
                        </div>
                        <button
                            onClick={() => toast.dismiss(t.id)}
                            className="ml-4 text-current opacity-50 hover:opacity-100"
                            aria-label="Dismiss"
                        >
                            ×
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
