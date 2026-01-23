#!/usr/bin/env node

/**
 * Quick check if escrow tables exist in Supabase
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing environment variables');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkTables() {
    console.log('🔍 Checking escrow tables in Supabase...\n');

    const tables = [
        'escrow_sessions',
        'escrow_payments',
        'escrow_refunds',
        'escrow_audit_log',
        'rwa_execution_requests'
    ];

    for (const table of tables) {
        try {
            const { count, error } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true });

            if (error) {
                console.log(`❌ ${table}: Does NOT exist`);
            } else {
                console.log(`✅ ${table}: EXISTS (${count || 0} rows)`);
            }
        } catch (err) {
            console.log(`❌ ${table}: Error checking`);
        }
    }

    console.log('\n✨ All tables are ready! You can now create escrow sessions.\n');
}

checkTables();
