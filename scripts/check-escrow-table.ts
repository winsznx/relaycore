#!/usr/bin/env tsx

/**
 * Check if escrow_sessions table exists
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing environment variables');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkTable() {
    console.log('🔍 Checking for escrow_sessions table...\n');

    try {
        const { data, error, count } = await supabase
            .from('escrow_sessions')
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.log('❌ Table does NOT exist');
            console.log(`   Error: ${error.message}\n`);
            console.log('📝 Next steps:');
            console.log('   1. Go to: https://supabase.com/dashboard/project/vartrdfjpicphsxnjsgt/sql');
            console.log('   2. Copy the contents of: supabase/migrations/012_escrow_sessions.sql');
            console.log('   3. Paste and run it in the SQL Editor\n');
            return false;
        }

        console.log('✅ Table EXISTS!');
        console.log(`   Total sessions: ${count || 0}\n`);

        // Also check for other related tables
        const tables = ['escrow_payments', 'escrow_refunds', 'escrow_audit_log'];
        for (const table of tables) {
            const { error: tableError } = await supabase
                .from(table)
                .select('*', { head: true });

            if (tableError) {
                console.log(`❌ ${table} table missing`);
            } else {
                console.log(`✅ ${table} table exists`);
            }
        }

        return true;
    } catch (err) {
        console.error('❌ Error:', err);
        return false;
    }
}

checkTable();
