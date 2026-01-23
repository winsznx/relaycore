/**
 * Activity Stream Panel
 * Bottom panel showing chronological execution log with filtering
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Filter, Download, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { ExecutionLogEntry } from '../../types/playground.types';

export interface ActivityStreamProps {
    executionLog: ExecutionLogEntry[];
    onClose: () => void;
}

export function ActivityStream({ executionLog, onClose }: ActivityStreamProps) {
    const [filter, setFilter] = useState<'all' | 'agent' | 'payment' | 'session' | 'indexer' | 'system'>('all');
    const [search, setSearch] = useState('');

    const filteredLog = (executionLog || []).filter(entry => {
        const matchesFilter = filter === 'all' || entry.category === filter;
        const matchesSearch = search === '' ||
            entry.message.toLowerCase().includes(search.toLowerCase()) ||
            entry.nodeId?.toLowerCase().includes(search.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const exportLog = () => {
        const csv = [
            ['Timestamp', 'Level', 'Category', 'Message', 'Node ID'].join(','),
            ...filteredLog.map(entry => [
                new Date(entry.timestamp).toISOString(),
                entry.level,
                entry.category,
                `"${entry.message.replace(/"/g, '""')}"`,
                entry.nodeId || ''
            ].join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `execution-log-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const getLevelColor = (level: string) => {
        switch (level) {
            case 'success': return 'text-green-600 bg-green-50';
            case 'error': return 'text-red-600 bg-red-50';
            case 'warning': return 'text-yellow-600 bg-yellow-50';
            default: return 'text-blue-600 bg-blue-50';
        }
    };

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'agent': return '🤖';
            case 'payment': return '💳';
            case 'session': return '🔐';
            case 'indexer': return '📊';
            default: return '⚙️';
        }
    };

    return (
        <div className="h-80 bg-white border-t border-gray-200 flex flex-col">
            {/* Header */}
            <div className="p-3 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-gray-600" />
                    <h3 className="font-semibold text-sm text-gray-900">Activity Stream</h3>
                    <Badge variant="outline" className="text-xs">
                        {filteredLog.length} events
                    </Badge>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={exportLog}>
                        <Download className="h-3 w-3 mr-1" />
                        Export CSV
                    </Button>
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="p-3 border-b border-gray-200 flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-400" />
                <div className="flex gap-1 flex-1">
                    {(['all', 'agent', 'payment', 'session', 'indexer', 'system'] as const).map(cat => (
                        <button
                            key={cat}
                            onClick={() => setFilter(cat)}
                            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${filter === cat
                                ? 'bg-gray-900 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </button>
                    ))}
                </div>
                <div className="relative w-48">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
                    <Input
                        type="text"
                        placeholder="Search..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-7 h-8 text-xs"
                    />
                </div>
            </div>

            {/* Log Entries */}
            <div className="flex-1 overflow-y-auto p-3">
                <AnimatePresence mode="popLayout">
                    {filteredLog.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                            <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No activity yet</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {filteredLog.map((entry) => (
                                <motion.div
                                    key={entry.id}
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="flex items-start gap-2 p-2 rounded hover:bg-gray-50 transition-colors"
                                >
                                    <span className="text-lg flex-shrink-0">
                                        {getCategoryIcon(entry.category)}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge
                                                variant="outline"
                                                className={`text-xs ${getLevelColor(entry.level)}`}
                                            >
                                                {entry.level}
                                            </Badge>
                                            <Badge variant="outline" className="text-xs capitalize">
                                                {entry.category}
                                            </Badge>
                                            <span className="text-xs text-gray-500">
                                                {new Date(entry.timestamp).toLocaleTimeString()}
                                            </span>
                                            {entry.nodeId && (
                                                <span className="text-xs text-gray-400 font-mono">
                                                    {entry.nodeId.slice(0, 8)}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-700">{entry.message}</p>
                                        {entry.metadata && (
                                            <details className="mt-1">
                                                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                                                    View metadata
                                                </summary>
                                                <pre className="mt-1 text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                                                    {JSON.stringify(entry.metadata, null, 2)}
                                                </pre>
                                            </details>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

export default ActivityStream;
