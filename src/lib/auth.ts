import { SiweMessage } from 'siwe';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function authenticateWallet(message: string, signature: string) {
    const siweMessage = new SiweMessage(message);
    const { data: fields } = await siweMessage.verify({ signature });

    // Create/update Supabase user
    // Note: This relies on a custom authentication provider or logic in Supabase
    // For standard usage, you might use supabase.auth.signInWithIdToken if configured,
    // or a custom RPC. The architecture doc suggests signInWithIdToken with 'custom'.

    const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google', // Placeholder, 'custom' is not a standard provider string in types usually, but might be supported dynamically
        token: fields.address // This is illustrative from ARCHITECTURE.md
    });

    // Alternative: if not using standard auth, just verify and return the address
    return { address: fields.address, data, error };
}
