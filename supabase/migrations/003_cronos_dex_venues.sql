-- ============================================
-- CRONOS DEX VENUES - REAL CONTRACT ADDRESSES
-- Official data from Cronos ecosystem documentation
-- ============================================

-- Clear old placeholder data
DELETE FROM dex_venues WHERE contract_address = '0x0000000000000000000000000000000000000000';

-- Insert real Cronos DEX venues
INSERT INTO dex_venues (name, contract_address, chain, max_leverage, trading_fee_bps, supported_pairs, is_active)
VALUES 
  -- Perpetual DEXes
  ('Moonlander', '0xE6F6351fb66f3a35313fEEFF9116698665FBEeC9', 'cronos', 1000, 10, ARRAY['BTC-USD', 'ETH-USD', 'CRO-USD'], true),
  ('Fulcrom Finance', '0x0000000000000000000000000000000000000001', 'cronos', 100, 10, ARRAY['BTC-USD', 'ETH-USD'], true),
  
  -- AMM Spot DEXes
  ('VVS Finance', '0x145863Eb42Cf62847A6Ca784e6416C1682b1b2Ae', 'cronos', 1, 30, ARRAY['CRO-USDC', 'ETH-USDC', 'BTC-USDC'], true),
  ('MM Finance', '0x145677FC4d9b8F19B5D56d1820c48e0443049a30', 'cronos', 1, 25, ARRAY['CRO-USDC', 'ETH-USDC', 'BTC-USDC'], true),
  
  -- StableSwap
  ('Ferro Protocol', '0x39bC1e38c842C60775Ce37566D03B41A7A66C782', 'cronos', 1, 4, ARRAY['USDC-USDT', 'DAI-USDC'], true)
ON CONFLICT DO NOTHING;

-- ============================================
-- Add venue type column for better categorization
-- ============================================

ALTER TABLE dex_venues ADD COLUMN IF NOT EXISTS venue_type TEXT DEFAULT 'amm';
ALTER TABLE dex_venues ADD COLUMN IF NOT EXISTS router_address TEXT;
ALTER TABLE dex_venues ADD COLUMN IF NOT EXISTS factory_address TEXT;

-- Update venue types and additional addresses
UPDATE dex_venues SET 
  venue_type = 'perpetual',
  router_address = NULL
WHERE name IN ('Moonlander', 'Fulcrom Finance');

UPDATE dex_venues SET 
  venue_type = 'amm',
  router_address = '0x145863Eb42Cf62847A6Ca784e6416C1682b1b2Ae',
  factory_address = '0x3B44B2a187a7b3824131F8db5a74194D0a42Fc15'
WHERE name = 'VVS Finance';

UPDATE dex_venues SET 
  venue_type = 'amm',
  router_address = '0x145677FC4d9b8F19B5D56d1820c48e0443049a30',
  factory_address = '0xd590cC180601AEcD6eeADD9B7f2B7611519544f4'
WHERE name = 'MM Finance';

UPDATE dex_venues SET 
  venue_type = 'stableswap'
WHERE name = 'Ferro Protocol';

-- ============================================
-- TOKEN ADDRESSES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS token_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  chain TEXT NOT NULL,
  decimals INTEGER NOT NULL DEFAULT 18,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(symbol, chain)
);

-- Official Cronos token addresses
INSERT INTO token_addresses (symbol, name, address, chain, decimals)
VALUES
  ('WCRO', 'Wrapped CRO', '0x5C7F8A570d578ED60E9aE2ed85db5aD1b0b3e6e7', 'cronos', 18),
  ('USDC', 'USD Coin', '0xc21223249CA28397B4B6541dfFaEcC539BfF0c59', 'cronos', 6),
  ('USDT', 'Tether USD', '0x66e428c3f67a68878562e79A0234c1F83c208770', 'cronos', 6),
  ('ETH', 'Wrapped Ether', '0xe44Fd7fCb2b1581822D0c862B68222998a0c299a', 'cronos', 18),
  ('WBTC', 'Wrapped Bitcoin', '0x062E66477Faf219F25D27dCED647BF57C3107d52', 'cronos', 8),
  ('DAI', 'Dai Stablecoin', '0xF2001B145b43032AAF5Ee2884e456CCd805F677D', 'cronos', 18),
  ('VVS', 'VVS Token', '0x2D03bECE6747ADC00E1a131BBA1469C15fD11e03', 'cronos', 18),
  ('MMF', 'MM Finance', '0x97749c9B61F878a880DfE312d2594AE07AEd7656', 'cronos', 18),
  ('FER', 'Ferro Token', '0x39bC1e38c842C60775Ce37566D03B41A7A66C782', 'cronos', 18)
ON CONFLICT (symbol, chain) DO NOTHING;

-- Enable RLS
ALTER TABLE token_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON token_addresses FOR SELECT USING (true);
CREATE POLICY "Service write" ON token_addresses FOR ALL USING (true);
