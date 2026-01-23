import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

interface Session {
    session_id: string;
    owner_address: string;
    max_spend: string;
    deposited: string;
    released: string;
    spent?: string;
    payment_count?: number;
    is_active: boolean;
    expires_at?: string;
    expiry?: string;
}

export function useActiveSessions(userAddress: string | null) {
    return useQuery({
        queryKey: ['active-sessions', userAddress],
        queryFn: async () => {
            if (!userAddress) return [];

            const { data, error } = await supabase
                .from('escrow_sessions')
                .select('*')
                .eq('owner_address', userAddress.toLowerCase())
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Failed to fetch sessions:', error);
                return [];
            }

            // Use released as spent (amount already paid out from session)
            // For new sessions: released=0, so remaining = max_spend - 0 = max_spend
            // For used sessions: released>0, so remaining = max_spend - released
            return (data || []).map((session: any) => ({
                ...session,
                spent: session.released || '0',
                max_spend: session.max_spend || session.deposited || '0',
                expires_at: session.expires_at || session.expiry
            })) as Session[];
        },
        enabled: !!userAddress,
        staleTime: 30000,
    });
}
