-- Clear all seed/demo data from Relay Core database
-- Run this in Supabase SQL Editor to start fresh

-- Clear trades
DELETE FROM trades WHERE user_address LIKE '0x%';

-- Clear daily stats
DELETE FROM daily_stats;

-- Clear reputations
DELETE FROM reputations;

-- Clear services
DELETE FROM services;

-- Clear price feeds (these are replaced by real Pyth data anyway)
DELETE FROM price_feeds;

-- Clear DEX venues (keep only real ones if any)
DELETE FROM dex_venues WHERE contract_address IN (
  '0x1234567890abcdef1234567890abcdef12345678',
  '0xabcdef1234567890abcdef1234567890abcdef12',
  '0x7890abcdef1234567890abcdef1234567890abcd'
);

-- Clear agent activity
DELETE FROM agent_activity;

-- Clear agent reputation
DELETE FROM agent_reputation;

-- Clear payments
DELETE FROM payments;

SELECT 'All seed data cleared! Database is now empty and production-ready.' as result;
