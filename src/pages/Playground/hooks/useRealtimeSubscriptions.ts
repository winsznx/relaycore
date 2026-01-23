import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { PlaygroundNode } from '../types/playground.types';

interface UseRealtimeSubscriptionsOptions {
    walletAddress?: string;
    onPaymentUpdate: (payment: any) => void;
    onAgentActivityUpdate: (activity: any) => void;
    onRwaStateUpdate: (state: any) => void;
    onNodeUpdate: (nodeId: string, updates: Partial<PlaygroundNode>) => void;
}

export function useRealtimeSubscriptions(options: UseRealtimeSubscriptionsOptions) {
    const { walletAddress, onPaymentUpdate, onAgentActivityUpdate, onRwaStateUpdate } = options;

    useEffect(() => {
        if (!walletAddress) return;

        const paymentsChannel = supabase
            .channel('playground_payments')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'payments',
                filter: `from_address=eq.${walletAddress}`
            }, (payload) => {
                console.log('Payment update:', payload.new);
                onPaymentUpdate(payload.new);
            })
            .subscribe();

        const agentActivityChannel = supabase
            .channel('playground_agent_activity')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'agent_activity'
            }, (payload) => {
                console.log('Agent activity update:', payload.new);
                onAgentActivityUpdate(payload.new);
            })
            .subscribe();

        const rwaStatesChannel = supabase
            .channel('playground_rwa_states')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'rwa_states'
            }, (payload) => {
                console.log('RWA state update:', payload.new);
                onRwaStateUpdate(payload.new);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(paymentsChannel);
            supabase.removeChannel(agentActivityChannel);
            supabase.removeChannel(rwaStatesChannel);
        };
    }, [walletAddress, onPaymentUpdate, onAgentActivityUpdate, onRwaStateUpdate]);
}
