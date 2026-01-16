#!/bin/bash
# Apply critical migrations to Supabase

SUPABASE_URL="https://vartrdfjpicphsxnjsgt.supabase.co"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"

echo "[MIGRATE] Applying migrations to Supabase..."

# Apply dex_venues table
echo "[TABLE] Creating dex_venues table..."
psql "postgresql://postgres.vartrdfjpicphsxnjsgt:${SUPABASE_DB_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:6543/postgres" < supabase/migrations/000_dex_venues_table.sql

# Apply trades table
echo "[TABLE] Creating trades table..."
psql "postgresql://postgres.vartrdfjpicphsxnjsgt:${SUPABASE_DB_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:6543/postgres" < supabase/migrations/010_trades_table.sql

# Apply agent_activity table
echo "[TABLE] Creating agent_activity table..."
psql "postgresql://postgres.vartrdfjpicphsxnjsgt:${SUPABASE_DB_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:6543/postgres" < supabase/migrations/011_agent_activity_table.sql

echo "[OK] Migrations applied!"
