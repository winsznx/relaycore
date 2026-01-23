import { useState, useEffect } from 'react';
import { supabase } from './supabase';

interface Session {
    session_id: string;
    owner_address: string;
    max_spend: string;
    deposited: string;
    released: string;
    spent: string;
    status: string;
    expires_at: string;
    created_at: string;
}

export function useUserSessions(walletAddress: string | null) {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!walletAddress) {
            setSessions([]);
            return;
        }

        const fetchSessions = async () => {
            setLoading(true);
            setError(null);

            try {
                const { data, error: fetchError } = await supabase
                    .from('escrow_sessions')
                    .select('*')
                    .eq('owner_address', walletAddress.toLowerCase())
                    .eq('is_active', true)
                    .order('created_at', { ascending: false });

                if (fetchError) throw fetchError;

                setSessions(data || []);
            } catch (err) {
                setError(err as Error);
                setSessions([]);
            } finally {
                setLoading(false);
            }
        };

        fetchSessions();
    }, [walletAddress]);

    const refetch = async () => {
        if (!walletAddress) return;

        setLoading(true);
        try {
            const { data } = await supabase
                .from('escrow_sessions')
                .select('*')
                .eq('owner_address', walletAddress.toLowerCase())
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            setSessions(data || []);
        } catch (err) {
            setError(err as Error);
        } finally {
            setLoading(false);
        }
    };

    return { sessions, loading, error, refetch };
}

export function getAvailableBalance(session: Session): number {
    const deposited = parseFloat(session.deposited || '0');
    const released = parseFloat(session.released || '0');
    return Math.max(0, deposited - released);
}

export function formatSessionDisplay(session: Session): string {
    const available = getAvailableBalance(session);
    return `Session #${session.session_id} (${available.toFixed(2)} USDC available)`;
}
