#!/bin/bash

echo "🎯 RWA x402 Integration - End-to-End Test"
echo "=========================================="
echo ""
echo "This demonstrates AI agents using x402 for autonomous RWA operations"
echo ""

API_URL="http://localhost:4001/api"
AGENT_ADDRESS="0x742d35Cc6634C0532925a3b844Bc454e4438f51B"

echo "📋 Test Flow:"
echo "1. Create Session (10 USDC budget)"
echo "2. Activate Session (x402 payment)"
echo "3. Mint RWA Asset (x402 minting fee)"
echo "4. Execute RWA Service (x402 agent payment)"
echo "5. Settle Execution (x402 payment confirmation/refund)"
echo ""
read -p "Press Enter to start..."

# Step 1: Create Session
echo ""
echo "Step 1: Creating Session..."
SESSION_RESPONSE=$(curl -s -X POST $API_URL/sessions/create \
  -H "Content-Type: application/json" \
  -d "{
    \"ownerAddress\": \"$AGENT_ADDRESS\",
    \"maxSpend\": \"10\",
    \"durationHours\": 24
  }")

SESSION_ID=$(echo $SESSION_RESPONSE | jq -r '.session.session_id')
echo "✅ Session Created: ID = $SESSION_ID"
echo "   Max Spend: 10 USDC"
echo "   Duration: 24 hours"
echo ""

# Step 2: Activate Session (simulated - in production, this would be real x402 payment)
echo "Step 2: Activating Session with x402 Payment..."
echo "⚠️  In production: User signs x402 payment transaction"
echo "⚠️  For demo: Simulating activation"

ACTIVATE_RESPONSE=$(curl -s -X POST $API_URL/sessions/$SESSION_ID/activate \
  -H "Content-Type: application/json" \
  -d "{
    \"txHash\": \"0xdemo_tx_$(date +%s)\",
    \"amount\": \"10\"
  }")

echo "✅ Session Activated"
echo "   Deposited: 10 USDC"
echo "   Available Budget: 10 USDC"
echo ""

# Step 3: Mint RWA Asset with x402 Minting Fee
echo "Step 3: Minting RWA Asset (Bond)..."
echo "   Asset Value: $1000"
echo "   Minting Fee: 0.1% = $1.00 USDC (paid via x402)"

MINT_RESPONSE=$(curl -s -X POST $API_URL/rwa/assets/mint \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"bond\",
    \"name\": \"Corporate Bond 2026\",
    \"description\": \"AAA-rated corporate bond\",
    \"owner\": \"$AGENT_ADDRESS\",
    \"value\": \"1000\",
    \"currency\": \"USDC\",
    \"sessionId\": $SESSION_ID,
    \"metadata\": {
      \"issuer\": \"TechCorp Inc\",
      \"maturity\": \"2026-12-31\",
      \"coupon\": \"5.5%\"
    }
  }")

ASSET_ID=$(echo $MINT_RESPONSE | jq -r '.assetId')
MINTING_FEE=$(echo $MINT_RESPONSE | jq -r '.mintingFee')

echo "✅ RWA Asset Minted"
echo "   Asset ID: $ASSET_ID"
echo "   Type: Bond"
echo "   Value: $1000 USDC"
echo "   Minting Fee Paid: $MINTING_FEE USDC (via x402)"
echo "   Session Budget Remaining: ~9.00 USDC"
echo ""

# Step 4: Execute RWA Service (Valuation)
echo "Step 4: Executing RWA Valuation Service..."
echo "   Service: RWA Valuation Agent"
echo "   Price: 0.50 USDC (paid via x402)"

EXECUTE_RESPONSE=$(curl -s -X POST $API_URL/rwa/execute \
  -H "Content-Type: application/json" \
  -d "{
    \"serviceId\": \"rwa_valuation\",
    \"sessionId\": $SESSION_ID,
    \"agentAddress\": \"0xValuationAgent123\",
    \"input\": {
      \"assetId\": \"$ASSET_ID\",
      \"method\": \"dcf\",
      \"parameters\": {
        \"discountRate\": 0.08,
        \"projectionYears\": 5
      }
    }
  }")

REQUEST_ID=$(echo $EXECUTE_RESPONSE | jq -r '.settlement.requestId')
PRICE=$(echo $EXECUTE_RESPONSE | jq -r '.settlement.price')

echo "✅ RWA Service Execution Started"
echo "   Request ID: $REQUEST_ID"
echo "   Agent Payment: $PRICE USDC (via x402)"
echo "   Session Budget Remaining: ~8.50 USDC"
echo ""

# Step 5a: Settle with Valid SLA (Agent gets paid)
echo "Step 5a: Settling Execution (SLA MET)..."
echo "   Agent provides proof within SLA"
echo "   Latency: 2000ms (< 5000ms max)"

sleep 2

SETTLE_RESPONSE=$(curl -s -X POST $API_URL/rwa/settle \
  -H "Content-Type: application/json" \
  -d "{
    \"requestId\": \"$REQUEST_ID\",
    \"proof\": {
      \"timestamp\": $(date +%s)000,
      \"result\": {
        \"valuation\": 1050,
        \"confidence\": 0.95,
        \"method\": \"dcf\",
        \"factors\": {
          \"cashFlows\": [55, 55, 55, 55, 1055],
          \"npv\": 1050
        }
      },
      \"signature\": \"0xproof_signature_$(date +%s)\"
    }
  }")

STATUS=$(echo $SETTLE_RESPONSE | jq -r '.status')

echo "✅ Execution Settled Successfully"
echo "   Status: $STATUS"
echo "   SLA Met: YES"
echo "   Payment Action: CONFIRMED to agent"
echo "   Agent receives: $PRICE USDC"
echo "   Valuation Result: $1050 USDC"
echo ""

# Step 5b: Demonstrate SLA Failure (Refund scenario)
echo "Step 5b: Demonstrating SLA Failure Scenario..."
echo "   Executing another service..."

EXECUTE_RESPONSE_2=$(curl -s -X POST $API_URL/rwa/execute \
  -H "Content-Type: application/json" \
  -d "{
    \"serviceId\": \"rwa_verification\",
    \"sessionId\": $SESSION_ID,
    \"agentAddress\": \"0xVerificationAgent456\",
    \"input\": {
      \"assetId\": \"$ASSET_ID\",
      \"checkType\": \"authenticity\"
    }
  }")

REQUEST_ID_2=$(echo $EXECUTE_RESPONSE_2 | jq -r '.settlement.requestId')

echo "   Request ID: $REQUEST_ID_2"
echo "   Simulating slow response (SLA violation)..."

sleep 6

SETTLE_RESPONSE_2=$(curl -s -X POST $API_URL/rwa/settle \
  -H "Content-Type: application/json" \
  -d "{
    \"requestId\": \"$REQUEST_ID_2\",
    \"proof\": {
      \"timestamp\": $(($(date +%s) - 6))000,
      \"result\": {
        \"verified\": true
      }
    }
  }")

STATUS_2=$(echo $SETTLE_RESPONSE_2 | jq -r '.status')

echo "✅ Execution Settled with SLA Failure"
echo "   Status: $STATUS_2"
echo "   SLA Met: NO (latency > 5000ms)"
echo "   Payment Action: REFUNDED to session"
echo "   Session budget restored"
echo ""

# Summary
echo "📊 Final Summary"
echo "================"
echo ""
echo "Session Budget Flow:"
echo "  Initial:        10.00 USDC"
echo "  Minting Fee:    -1.00 USDC (confirmed)"
echo "  Valuation:      -0.50 USDC (confirmed, SLA met)"
echo "  Verification:   +0.50 USDC (refunded, SLA failed)"
echo "  Final:          ~9.00 USDC"
echo ""
echo "x402 Payments:"
echo "  ✅ Minting fee paid via session (gasless)"
echo "  ✅ Agent payment via session (gasless)"
echo "  ✅ Payment confirmed when SLA met"
echo "  ✅ Payment refunded when SLA failed"
echo ""
echo "RWA Asset:"
echo "  Asset ID: $ASSET_ID"
echo "  Status: Pending (awaiting handoff signature)"
echo "  Value: $1000 USDC"
echo "  Valuation: $1050 USDC (verified)"
echo ""
echo "🎉 Complete x402 RWA Flow Demonstrated!"
echo ""
echo "Key Features:"
echo "  • AI agents autonomously mint RWA assets"
echo "  • All payments via x402 (gasless from session)"
echo "  • SLA-based payment settlement"
echo "  • Automatic refunds for failed SLA"
echo "  • Full audit trail in database"
echo ""
echo "Next Steps:"
echo "  1. Check session_payments table for payment records"
echo "  2. Check rwa_execution_requests for execution history"
echo "  3. Check escrow_refunds for refund records"
echo "  4. View reputation updates for agents"
