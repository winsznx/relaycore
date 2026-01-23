/**
 * Enhanced Wallet Node
 * Displays user wallet with real balance, pending transactions, and handoff URL generation
 */

import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Wallet, ExternalLink, QrCode, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { WalletNodeData } from '../../types/playground.types';

export interface WalletNodeProps {
    data: WalletNodeData;
    selected?: boolean;
}

export function WalletNode({ data, selected }: WalletNodeProps) {
    const hasPendingTx = data.pendingTransactions.length > 0;

    return (
        <div className="relative">
            <Handle
                type="target"
                position={Position.Left}
                className="!bg-orange-500 !w-3 !h-3"
            />

            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{
                    scale: selected ? 1.05 : 1,
                    opacity: 1
                }}
                className="px-4 py-3 shadow-lg rounded-xl border-2 border-orange-400 bg-gradient-to-br from-orange-50 to-amber-50 min-w-[220px]"
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-orange-500">
                            <Wallet className="h-4 w-4 text-white" />
                        </div>
                        <div>
                            <div className="font-semibold text-sm text-gray-800">
                                {data.label}
                            </div>
                            <div className="text-xs text-gray-500 font-mono">
                                {data.address.slice(0, 6)}...{data.address.slice(-4)}
                            </div>
                        </div>
                    </div>
                    <a
                        href={`https://cronoscan.com/address/${data.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-600 hover:text-orange-700"
                    >
                        <ExternalLink className="h-3 w-3" />
                    </a>
                </div>

                {/* Status Badges */}
                <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs">
                        Chain {data.chainId}
                    </Badge>
                    {data.executionMode === 'real' && (
                        <Badge variant="secondary" className="text-xs">
                            <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse" />
                            LIVE
                        </Badge>
                    )}
                </div>

                {/* Balance */}
                <div className="mb-2">
                    <div className="text-xs text-gray-600 mb-1">Balance:</div>
                    <div className="text-2xl font-bold text-orange-600">
                        {data.balance.toFixed(4)} CRO
                    </div>
                </div>

                {/* Pending Transactions */}
                {hasPendingTx && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                        <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
                            <AlertCircle className="h-3 w-3 text-yellow-600" />
                            <span>Pending Transactions ({data.pendingTransactions.length}):</span>
                        </div>
                        <div className="space-y-1 max-h-[80px] overflow-y-auto">
                            {data.pendingTransactions.slice(0, 3).map((tx, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="flex items-center justify-between text-xs p-2 bg-yellow-50 rounded border border-yellow-200"
                                >
                                    <span className="font-mono text-gray-700 truncate flex-1">
                                        {tx.transactionId.slice(0, 8)}...
                                    </span>
                                    <Badge
                                        variant={
                                            tx.status === 'confirmed' ? 'default' :
                                                tx.status === 'failed' ? 'destructive' :
                                                    'outline'
                                        }
                                        className="text-xs ml-2"
                                    >
                                        {tx.status}
                                    </Badge>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Handoff URL */}
                {data.handoffUrl && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs"
                            onClick={() => window.open(data.handoffUrl, '_blank')}
                        >
                            <QrCode className="h-3 w-3 mr-1" />
                            Sign Transaction
                        </Button>
                    </div>
                )}

                {/* Security Note */}
                <div className="mt-2 pt-2 border-t border-gray-200">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                        <span>No private keys exposed</span>
                    </div>
                </div>
            </motion.div>

            <Handle
                type="source"
                position={Position.Right}
                className="!bg-orange-500 !w-3 !h-3"
            />
        </div>
    );
}

export default WalletNode;
