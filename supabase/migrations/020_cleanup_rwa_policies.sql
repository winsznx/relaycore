-- Fix duplicate rwa_assets policies
-- Drop all existing policies and recreate with correct names

DROP POLICY IF EXISTS "Public read rwa assets" ON rwa_assets;
DROP POLICY IF EXISTS "Public read rwa_assets" ON rwa_assets;
DROP POLICY IF EXISTS "Service write rwa_assets" ON rwa_assets;
DROP POLICY IF EXISTS "Service insert rwa_assets" ON rwa_assets;
DROP POLICY IF EXISTS "Service update rwa_assets" ON rwa_assets;
DROP POLICY IF EXISTS "Service delete rwa_assets" ON rwa_assets;

CREATE POLICY "rwa_assets_select" ON rwa_assets
    FOR SELECT USING (true);

CREATE POLICY "rwa_assets_insert" ON rwa_assets
    FOR INSERT WITH CHECK (is_service_role());

CREATE POLICY "rwa_assets_update" ON rwa_assets
    FOR UPDATE USING (is_service_role()) WITH CHECK (is_service_role());

CREATE POLICY "rwa_assets_delete" ON rwa_assets
    FOR DELETE USING (is_service_role());
