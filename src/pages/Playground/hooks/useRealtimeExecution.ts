/**
 * Realtime Execution Hook
 * Connects Playground to live database events and drives node state updates
 */

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type {
    ExecutionMode,
    RealtimeUpdate,
    ExecutionLogEntry,
    PlaygroundNode,
    PlaygroundEdge
} from '../types/playground.types';

export interface UseRealtimeExecutionOptions {
    mode: ExecutionMode;
    onNodeUpdate: (nodeId: string, data: Partial<any>) => void;
    onEdgeUpdate: (edgeId: string, data: Partial<any>) => void;
    onLogEntry: (entry: ExecutionLogEntry) => void;
}

export function useRealtimeExecution({
    mode,
    onNodeUpdate,
    onEdgeUpdate,
    onLogEntry
}: UseRealtimeExecutionOptions) {
    const [isConnected, setIsConnected] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

    // Subscribe to x402 payment updates
    useEffect(() => {
        if (mode !== 'real') return;

        const channel = supabase
            .channel('playground-x402-payments')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'x402_payments'
                },
                (payload) => {
                    const payment = payload.new as any;

                    onLogEntry({
                        id: `payment-${payment.payment_id}`,
                        timestamp: new Date(),
                        level: payment.status === 'settled' ? 'success' : 'info',
                        category: 'payment',
                        message: `x402 Payment ${payment.status}: ${payment.amount} ${payment.token_address}`,
                        metadata: payment
                    });

                    // Update any x402 gate nodes
                    onNodeUpdate(`x402-${payment.payment_id}`, {
                        paymentStatus: payment.status,
                        settlementTxHash: payment.settlement_tx_hash,
                        blockNumber: payment.settlement_block,
                        status: payment.status === 'settled' ? 'completed' : 'blocked'
                    });

                    setLastUpdate(new Date());
                }
            )
            .subscribe((status) => {
                setIsConnected(status === 'SUBSCRIBED');
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [mode, onNodeUpdate, onLogEntry]);

    // Subscribe to escrow session events
    useEffect(() => {
        if (mode !== 'real') return;

        const channel = supabase
            .channel('playground-escrow-sessions')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'escrow_sessions'
                },
                (payload) => {
                    const session = payload.new as any;

                    onLogEntry({
                        id: `session-${session.session_id}`,
                        timestamp: new Date(),
                        level: 'info',
                        category: 'session',
                        message: `Session ${session.is_active ? 'active' : 'closed'}: ${session.session_id}`,
                        metadata: session
                    });

                    onNodeUpdate(`session-${session.session_id}`, {
                        deposited: parseFloat(session.deposited || '0'),
                        released: parseFloat(session.released || '0'),
                        remaining: parseFloat(session.deposited || '0') - parseFloat(session.released || '0'),
                        isActive: session.is_active,
                        status: session.is_active ? 'executing' : 'completed'
                    });

                    setLastUpdate(new Date());
                }
            )
            .subscribe((status) => {
                setIsConnected(status === 'SUBSCRIBED');
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [mode, onNodeUpdate, onLogEntry]);

    // Subscribe to MCP invocations (agent tool calls)
    useEffect(() => {
        if (mode !== 'real') return;

        const channel = supabase
            .channel('playground-mcp-invocations')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'mcp_invocations'
                },
                (payload) => {
                    const invocation = payload.new as any;

                    onLogEntry({
                        id: `mcp-${invocation.invocation_id}`,
                        timestamp: new Date(invocation.created_at),
                        level: invocation.result_status === 'success' ? 'success' : 'error',
                        category: 'agent',
                        message: `Agent tool call: ${invocation.tool_name} - ${invocation.result_status}`,
                        metadata: invocation
                    });

                    if (invocation.agent_id) {
                        onNodeUpdate(`agent-${invocation.agent_id}`, {
                            status: 'executing',
                            toolCalls: invocation
                        });
                    }

                    setLastUpdate(new Date());
                }
            )
            .subscribe((status) => {
                setIsConnected(status === 'SUBSCRIBED');
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [mode, onNodeUpdate, onLogEntry]);

    // Subscribe to on-chain transactions (indexer)
    useEffect(() => {
        if (mode !== 'real') return;

        const channel = supabase
            .channel('playground-onchain-tx')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'on_chain_transactions'
                },
                (payload) => {
                    const tx = payload.new as any;

                    onLogEntry({
                        id: `tx-${tx.tx_hash}`,
                        timestamp: new Date(tx.timestamp),
                        level: tx.status === 'success' ? 'success' : 'error',
                        category: 'indexer',
                        message: `Transaction ${tx.status}: ${tx.tx_hash.slice(0, 10)}...`,
                        metadata: tx
                    });

                    // Update indexer node
                    onNodeUpdate('indexer-main', {
                        blockHeight: tx.block_number,
                        lastUpdate: new Date(tx.timestamp),
                        dataFreshness: 'live'
                    });

                    setLastUpdate(new Date());
                }
            )
            .subscribe((status) => {
                setIsConnected(status === 'SUBSCRIBED');
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [mode, onNodeUpdate, onLogEntry]);

    // Fetch initial indexer state
    const fetchIndexerState = useCallback(async () => {
        if (mode !== 'real') return;

        try {
            const { data, error } = await supabase
                .from('indexer_state')
                .select('*')
                .order('updated_at', { ascending: false })
                .limit(1)
                .single();

            if (error) throw error;

            if (data) {
                onNodeUpdate('indexer-main', {
                    blockHeight: data.last_block || 0,
                    lastUpdate: new Date(data.updated_at),
                    dataFreshness: 'live'
                });
            }
        } catch (error) {
            console.error('Failed to fetch indexer state:', error);
            onLogEntry({
                id: `error-${Date.now()}`,
                timestamp: new Date(),
                level: 'error',
                category: 'indexer',
                message: `Failed to fetch indexer state: ${error}`,
            });
        }
    }, [mode, onNodeUpdate, onLogEntry]);

    useEffect(() => {
        fetchIndexerState();
    }, [fetchIndexerState]);

    return {
        isConnected,
        lastUpdate,
        refetch: fetchIndexerState
    };
}
