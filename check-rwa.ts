// Quick database check script
import { supabase } from './src/lib/supabase';

async function checkRWAAssets() {
    console.log('Fetching latest RWA assets...\n');

    const { data: assets, error } = await supabase
        .from('rwa_assets')
        .select('asset_id, name, status, value, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Latest 5 RWA Assets:');
    console.table(assets);

    // Get lifecycle events for the newest asset
    if (assets && assets.length > 0) {
        const newestAsset = assets[0];
        console.log(`\nLifecycle events for: ${newestAsset.asset_id}`);

        const { data: events } = await supabase
            .from('rwa_lifecycle_events')
            .select('event_type, actor, timestamp, tx_hash')
            .eq('asset_id', newestAsset.asset_id)
            .order('timestamp', { ascending: false });

        console.table(events);
    }
}

checkRWAAssets().then(() => process.exit(0));
