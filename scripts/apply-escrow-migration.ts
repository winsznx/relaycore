#!/usr/bin/env tsx

/**
 * Apply Escrow Sessions Migration
 * Runs the 012_escrow_sessions.sql migration on Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function applyMigration() {
    console.log('📦 Applying escrow sessions migration...\n');

    // Read the migration file
    const migrationPath = join(__dirname, '../supabase/migrations/012_escrow_sessions.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    try {
        // Check if table already exists
        const { data: existingTable, error: checkError } = await supabase
            .from('escrow_sessions')
            .select('session_id')
            .limit(1);

        if (!checkError) {
            console.log('✅ escrow_sessions table already exists!');
            console.log('📊 Checking table structure...\n');

            const { count } = await supabase
                .from('escrow_sessions')
                .select('*', { count: 'exact', head: true });

            console.log(`   Total sessions: ${count || 0}`);
            return;
        }

        // Table doesn't exist, apply migration
        console.log('🔧 Creating escrow_sessions tables...');

        // Split SQL into individual statements and execute
        const statements = migrationSQL
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const statement of statements) {
            if (statement.length > 0) {
                const { error } = await supabase.rpc('exec_sql', { sql: statement });
                if (error) {
                    console.error(`❌ Error executing statement: ${error.message}`);
                }
            }
        }

        console.log('✅ Migration applied successfully!\n');

        // Verify tables were created
        const { data: sessions } = await supabase
            .from('escrow_sessions')
            .select('*')
            .limit(1);

        console.log('✅ Verified: escrow_sessions table is ready');

    } catch (err) {
        console.error('❌ Migration failed:', err);
        console.log('\n💡 You may need to run this SQL manually in Supabase SQL Editor:');
        console.log('   https://supabase.com/dashboard/project/_/sql\n');
        process.exit(1);
    }
}

applyMigration();
