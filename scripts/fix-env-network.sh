#!/bin/bash

# Fix .env CRONOS_NETWORK value
# The Facilitator SDK expects 'cronos-testnet' or 'cronos-mainnet', not just 'testnet'

echo "Fixing CRONOS_NETWORK in .env..."

if [ -f ".env" ]; then
    # Replace testnet with cronos-testnet
    sed -i.bak 's/^CRONOS_NETWORK=testnet$/CRONOS_NETWORK=cronos-testnet/' .env
    sed -i.bak 's/^CRONOS_NETWORK=mainnet$/CRONOS_NETWORK=cronos-mainnet/' .env
    
    echo "✓ Updated .env"
    echo "  CRONOS_NETWORK is now set to cronos-testnet"
    
    # Show the change
    grep "CRONOS_NETWORK" .env
else
    echo "✗ .env file not found"
    exit 1
fi
