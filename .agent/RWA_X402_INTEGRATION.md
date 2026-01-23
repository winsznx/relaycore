# RWA x402 Integration - Complete Flow Explanation

## Overview
RWA (Real-World Asset) tokenization is fully integrated with x402 payment protocol. Here's the complete flow from minting to settlement.

## 1. RWA Minting with x402 Payment

### Frontend Flow (`/src/pages/RWAServices.tsx`)
```
User fills mint form → handleMintAsset() → POST /api/rwa/assets/mint
```

### Backend Processing (`/src/api/rwa.ts` → `/src/services/rwa/rwa-agent-service.ts`)

**Step 1: Calculate Minting Fee**
```typescript
// Line 100-101 in rwa-agent-service.ts
const assetValue = parseFloat(request.value);
const mintingFee = Math.max(0.01, assetValue * 0.001).toFixed(4);
// Formula: 0.1% of asset value, minimum 0.01 USDC
```

**Step 2: x402 Payment via Session Budget** (Lines 104-152)
```typescript
if (request.sessionId) {
    // 1. Check session has enough budget
    const remaining = deposited - released;
    if (remaining < mintingFee) throw Error;
    
    // 2. Record payment in session_payments table
    await supabase.from('session_payments').insert({
        session_id: request.sessionId,
        agent_address: 'relay_protocol',
        agent_name: 'RWA Minting Fee',
        amount: mintingFee,
        payment_method: 'x402',  // ← x402 gasless payment
        metadata: { assetId, assetType, assetValue, type: 'rwa_minting_fee' }
    });
    
    // 3. Update session released amount
    await supabase.from('escrow_sessions').update({
        released: (released + mintingFee).toString()
    });
}
```

**Step 3: Create Asset & Lifecycle Event** (Lines 154-226)
```typescript
// Store asset in rwa_assets table
await supabase.from('rwa_assets').insert({ ...asset });

// Log mint event in rwa_lifecycle_events table
await logLifecycleEvent({
    eventType: 'mint',
    actor: request.owner,
    data: { request, mintingFee }
});
```

**Step 4: Handoff Signing** (Lines 214-226)
```typescript
return {
    assetId,
    handoffRequired: true,
    mintingFee,
    handoffData: {
        action: 'rwa_mint',
        asset: { assetId, type, name, value, currency, owner },
        deadline: Date.now() + 300000  // 5 min
    }
};
```

### Frontend Handoff (`/src/pages/RWAServices.tsx` lines 499-573)
```typescript
// User signs EIP-712 typed data
const signature = await signer.signTypedData(domain, types, value);

// Confirm mint with signature
await fetch(`/api/rwa/assets/${assetId}/confirm`, {
    method: 'POST',
    body: JSON.stringify({ txHash: signature, signedData })
});
```

---

## 2. RWA State Transitions with x402

### State Machine Flow
```
pending → minted → active → redeemed
              ↓      ↓
            frozen ←┘
```

### Transition Costs (via x402)
- `pending → minted`: FREE (handoff signature only)
- `minted → active`: 0.05 USDC (verifier role)
- `minted → frozen`: FREE (admin role)
- `active → frozen`: FREE (admin role)
- `active → redeemed`: 0.10 USDC (redeemer role)
- `frozen → active`: 0.05 USDC (admin role)
- `frozen → redeemed`: 0.10 USDC (admin role)

### State Transition API
**Endpoint**: `POST /api/rwa/assets/:assetId/state`
```typescript
// Lines 352-402 in rwa-agent-service.ts
await updateAssetState(assetId, newStatus, actor, reason);

// Validates state transition
const validTransitions = {
    pending: ['minted'],
    minted: ['active', 'frozen'],
    active: ['frozen', 'redeemed'],
    frozen: ['active', 'redeemed'],
    redeemed: []
};

// Logs lifecycle event
await logLifecycleEvent({
    eventType: newStatus === 'frozen' ? 'freeze' : 
               newStatus === 'active' ? 'unfreeze' : 
               newStatus === 'redeemed' ? 'redeem' : 'update',
    actor,
    data: { previousStatus, newStatus, reason }
});
```

---

## 3. RWA Service Execution with x402

### Agent Execution Flow (`/src/services/rwa/rwa-agent-service.ts` lines 408-514)
```typescript
async executeService(serviceId, sessionId, agentAddress, input) {
    // 1. Get service price
    const price = service.price_per_call || '1.00';
    
    // 2. Check session budget
    const remaining = deposited - released;
    if (remaining < price) throw Error;
    
    // 3. Record x402 payment
    await supabase.from('session_payments').insert({
        session_id: sessionId,
        agent_address: agentAddress,
        agent_name: serviceId,
        amount: price,
        payment_method: 'x402',  // ← x402 gasless
        metadata: { requestId, serviceId, input, type: 'rwa_execution' }
    });
    
    // 4. Update session released
    await supabase.from('escrow_sessions').update({
        released: (released + price).toString()
    });
    
    // 5. Create execution request
    await supabase.from('rwa_execution_requests').insert({
        request_id: requestId,
        service_id: serviceId,
        session_id: sessionId,
        agent_address: agentAddress,
        price,
        sla_terms: { maxLatencyMs: 5000, proofFormat: 'signed' },
        status: 'pending'
    });
}
```

---

## 4. RWA Settlement with SLA Verification

### Settlement Flow (`/src/services/rwa/rwa-agent-service.ts` lines 521-669)
```typescript
async settleExecution(requestId, proof) {
    // 1. Calculate SLA metrics
    const latencyMs = Date.now() - proof.timestamp;
    const slaMetValid = latencyMs <= maxLatencyMs && proofFormatValid;
    
    if (!slaMetValid) {
        // SLA FAILED: Refund to session
        await supabase.from('escrow_sessions').update({
            released: (released - price).toString()  // Refund
        });
        
        await supabase.from('escrow_refunds').insert({
            session_id, amount: price, reason: 'SLA not met'
        });
    } else {
        // SLA MET: Confirm payment to agent
        await supabase.from('session_payments').update({
            metadata: { ...metadata, confirmed: true, settledAt: now }
        });
        
        // Record outcome for reputation
        await supabase.from('outcomes').insert({
            payment_id: requestId,
            outcome_type: 'success',
            latency_ms: latencyMs
        });
    }
}
```

---

## 5. Indexer Integration

### RWA State Indexer (`/src/services/indexer/rwa-state-indexer.ts`)
**Purpose**: Tracks RWA lifecycle events and state transitions

**What it indexes**:
- Asset creation and minting
- State transitions (minted → active → redeemed)
- Ownership changes
- Freeze/unfreeze events
- Settlement completions

**Database Tables**:
- `rwa_assets` - Asset records
- `rwa_lifecycle_events` - All state changes
- `rwa_execution_requests` - Service execution requests
- `session_payments` - x402 payments (minting fees + service fees)
- `escrow_refunds` - SLA failure refunds

---

## 6. Playground Integration

### Available RWA Nodes

1. **ServiceRwaSettlementNode** (`/src/pages/Playground/components/nodes/ServiceRwaSettlementNode.tsx`)
   - Executes RWA services with x402 payment
   - Handles settlement with SLA verification
   
2. **ServiceRwaStateIndexerNode** (`/src/pages/Playground/components/nodes/ServiceRwaStateIndexerNode.tsx`)
   - Queries RWA state and lifecycle events
   - Monitors asset transitions

### Execution Engines

**Real Execution** (`/src/pages/Playground/engine/RealExecutionEngine.ts`)
- Calls actual RWA API endpoints
- Uses real x402 session payments
- Records in database

**Mock Execution** (`/src/pages/Playground/engine/MockExecutionEngine.ts`)
- Simulates RWA operations
- No actual payments
- For testing flows

---

## 7. Complete Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ USER MINTS RWA ASSET                                        │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Frontend: POST /api/rwa/assets/mint                         │
│ - type, name, value, owner, sessionId                       │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Backend: rwa-agent-service.mintAsset()                      │
│ 1. Calculate fee: Math.max(0.01, value * 0.001)             │
│ 2. Check session budget                                     │
│ 3. INSERT session_payments (x402 payment)                   │
│ 4. UPDATE escrow_sessions (released += fee)                 │
│ 5. INSERT rwa_assets (status: pending)                      │
│ 6. INSERT rwa_lifecycle_events (type: mint)                 │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Frontend: User signs EIP-712 handoff data                   │
│ POST /api/rwa/assets/:id/confirm                            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Backend: rwa-agent-service.confirmMint()                    │
│ 1. UPDATE rwa_assets (status: minted, tx_hash)              │
│ 2. INSERT rwa_lifecycle_events (confirmed: true)            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ RWA State Indexer: Tracks all events                        │
│ - Monitors rwa_lifecycle_events table                       │
│ - Updates state machine visualization                       │
│ - Feeds Playground nodes                                    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Transaction History: Shows in Dashboard                     │
│ - Query: session_payments WHERE type='rwa_minting_fee'      │
│ - Displays: "RWA Minting Fee" with amount                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Key x402 Integration Points

### Where x402 is Used:
1. **Minting Fee Payment** (session_payments table)
   - `payment_method: 'x402'`
   - `agent_name: 'RWA Minting Fee'`
   - Deducted from session budget

2. **Service Execution Payment** (session_payments table)
   - `payment_method: 'x402'`
   - `agent_name: <serviceId>`
   - Deducted from session budget

3. **State Transition Fees** (future implementation)
   - Would use same session_payments mechanism
   - Costs defined in state machine endpoint

### Why x402?
- **Gasless**: No ETH needed for gas
- **Session-based**: Pre-funded escrow
- **Atomic**: Payment + execution together
- **Refundable**: SLA failures trigger refunds
- **Trackable**: All payments in session_payments table

---

## 9. How Agents Interact

### Agent Flow:
```
1. Agent discovers RWA service via meta-agent
2. Agent creates escrow session with budget
3. Agent calls RWA mint/execute with sessionId
4. Backend deducts from session budget (x402)
5. Agent receives handoff data or execution result
6. Agent signs/confirms transaction
7. Settlement verifies SLA
8. If SLA met: agent keeps payment
9. If SLA failed: payment refunded to session
```

### Database Tables Agents Touch:
- `escrow_sessions` - Session budget tracking
- `session_payments` - x402 payment records
- `rwa_assets` - Asset ownership
- `rwa_lifecycle_events` - State changes
- `rwa_execution_requests` - Service calls
- `outcomes` - Reputation data

---

## Summary

**x402 is the payment layer** that enables:
- Gasless RWA minting
- Session-based agent payments
- SLA-enforced settlements
- Automatic refunds on failures

**The indexer tracks** all RWA events and makes them queryable

**The Playground visualizes** the complete flow with real execution

**Everything is connected** through the session_payments table which is the source of truth for all x402 transactions.
