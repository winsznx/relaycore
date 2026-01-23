import { supabase } from './src/lib/supabase.js';
import fs from 'fs';

const sql = fs.readFileSync('supabase/migrations/20260121_agent_invocations.sql', 'utf8');

// Split by semicolon and execute each statement
const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

console.log(`Executing ${statements.length} SQL statements...`);

for (const statement of statements) {
    try {
        const { error } = await supabase.rpc('exec', { sql: statement + ';' });
        if (error) {
            console.error('Statement failed:', statement.substring(0, 100));
            console.error('Error:', error);
        } else {
            console.log('✓', statement.substring(0, 60) + '...');
        }
    } catch (err) {
        console.error('Failed:', err);
    }
}

console.log('Migration complete');
process.exit(0);
