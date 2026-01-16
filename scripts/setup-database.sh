#!/bin/bash

# Relay Core - Database Setup Script
# This script helps you set up the Supabase database

echo "[DB] Relay Core - Database Setup"
echo "================================"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "[ERROR] Supabase CLI not found!"
    echo ""
    echo "Install it with:"
    echo "  npm install -g supabase"
    echo "  or"
    echo "  brew install supabase/tap/supabase"
    echo ""
    exit 1
fi

echo "[OK] Supabase CLI found"
echo ""

# Check for environment variables
if [ -z "$VITE_SUPABASE_URL" ]; then
    echo "[WARN] VITE_SUPABASE_URL not set"
    echo ""
    echo "Please set your Supabase credentials:"
    echo "  1. Create a project at https://supabase.com"
    echo "  2. Copy .env.example to .env"
    echo "  3. Add your Supabase URL and keys"
    echo ""
    read -p "Do you want to continue anyway? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "[INFO] Available migrations:"
echo "  1. 001_relay_core_schema.sql - Core tables (payments, indexer, reputation)"
echo "  2. 002_complete_schema.sql - Extended tables (services, outcomes, trades)"
echo "  3. 003_security_tables.sql - Security (rate limits, audit logs)"
echo ""

read -p "Run all migrations? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "[RUN] Running migrations..."
    echo ""
    
    # Run migrations
    for migration in supabase/migrations/*.sql; do
        echo "[MIGRATE] Running $(basename $migration)..."
        supabase db push --file "$migration" || {
            echo "[ERROR] Migration failed: $migration"
            exit 1
        }
        echo "[OK] Success"
        echo ""
    done
    
    echo "[DONE] All migrations completed!"
else
    echo "[SKIP] Skipped migrations"
    echo ""
    echo "To run manually:"
    echo "  supabase db push --file supabase/migrations/001_relay_core_schema.sql"
    echo "  supabase db push --file supabase/migrations/002_complete_schema.sql"
    echo "  supabase db push --file supabase/migrations/003_security_tables.sql"
fi

echo ""
echo "[OK] Database setup complete!"
