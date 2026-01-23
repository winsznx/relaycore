# Relay Core CLI & Scaffold Architecture

> **Mission**: Democratize Agentic Finance by reducing the "Hello World" time to < 30 seconds.

This document outlines the end-to-end architecture for the Relay Core developer tooling, consisting of a CLI for lifecycle management (`relay`) and a scaffolding tool (`create-relay-app`).

---

## 1. The Scaffold: `create-relay-app`

**Goal**: Instant project bootstrapping with best practices baked in.

### **Architecture**
- **Technology**: Node.js executable, `prompts` for interactivity, `degit` or local template copying.
- **Templates**: Stored in a monorepo or fetched from a "templates" repository to keep the tool lightweight.

### **Template Strategy**
We will provide three tier-based templates:

#### **A. `starter-agent` (The "Hello World")**
*   **Stack**: TypeScript, Hono (lightweight, runs anywhere), `@relaycore/sdk`.
*   **Features**:
    *   Pre-configured `.well-known/agent-card.json`.
    *   Simple `GET /` endpoint.
    *   `src/index.ts` with basic `RelayAgent` instantiation.
*   **Use Case**: Simple script agents, cron jobs.

#### **B. `service-provider` (The "Earner")**
*   **Stack**: TypeScript, Express (robust), `@relaycore/sdk`.
*   **Features**:
    *   **x402 Middleware** pre-wired on `/api/protected`.
    *   **Payment Verification** logic stubbed out.
    *   **Swagger/OpenAPI** auto-generation (for MCP discovery).
*   **Use Case**: Selling data (prices, news), compute (inference), or access (gateways).

#### **C. `mcp-agent` (The "Brain")**
*   **Stack**: TypeScript, `@modelcontextprotocol/sdk`, `@relaycore/sdk`.
*   **Features**:
    *   Full MCP Server implementation.
    *   Exposes tools for Claude/LLMs.
    *   Integrates Relay for settlement behind the tools.
*   **Use Case**: Complex AI agents plugged into Claude Desktop or other MCP clients.

---

## 2. The CLI: `relay`

**Goal**: Manage agent identity, reputation, and development workflow.

### **Technical Stack**
- **Framework**: `cac` or `commander`.
- **State Management**: `conf` or `dot-json` for storing local config (`~/.relay/config.json`).
- **Key Management**: `ethers` `Wallet` (encrypted keystore locally).

### **Command Architecture**

#### **Auth & Identity**
*   `relay login`: Interactively recover wallet via seed phrase or private key.
*   `relay init`: Generates a fresh `agent-card.json` in the current directory.
*   `relay whoami`: Displays current Agent ID, Wallet Address, and Reputation Score (fetched from API).

#### **Development Loop (The "Killer Feature")**
*   `relay listen [--port 3000] [--path /webhooks]`:
    *   **Problem**: x402 payments are async. Developing locally with a real blockchain interaction is hard because the Facilitator can't call `localhost`.
    *   **Solution**: Creates a proxy tunnel (like `ngrok` but specific to Relay).
    *   **Flow**:
        1.  CLI starts a tunnel.
        2.  Registers a temporary webhook endpoint with Relay Gateway.
        3.  When a payment settles on-chain, Relay Gateway calls the temp endpoint -> CLI -> `localhost:3000`.
        4.  Allows testing "Real Money" flows on Testnet without deploying.

#### **Registry Operations**
*   `relay register`: Validates `agent-card.json` and pushes it to the Registry (via smart contract or Gateway API).
*   `relay update`: Updates metadata URL or capabilities.
*   `relay services list`: Interactive list of available services (wraps SDK discovery).

#### **Financials**
*   `relay balance`: Shows USDC balance on Cronos.
*   `relay withdraw [address] [amount]`: Withdraws earned funds to a cold wallet.

---

## 3. Developer Flow (The "Happy Path")

1.  **Bootstrap**:
    ```bash
    npx create-relay-app my-agent --template service-provider
    cd my-agent
    npm install
    ```

2.  **Configure**:
    *   Edit `.env` (add private key or run `relay login` to link global identity).
    *   Edit `src/service.ts` to define the business logic.

3.  **Dev**:
    ```bash
    npm run dev
    # In another terminal
    relay listen --port 3000
    ```

4.  **Test**:
    *   Use `relay invoke` (or the Playground) to send a test request.
    *   See the logs in terminal: "Payment Challenge sent", "Payment Verified", "Service Delivered".

5.  **Publish**:
    ```bash
    relay register
    ```
    *   Agent is now live on the decentalized registry.
    *   Visible in the Relay Marketplace immediately.

---

## 4. Integration with Core Project

*   **SDK Dependency**: Both CLI and Scaffold heavily depend on `@relaycore/sdk`.
    *   *Action*: Ensure SDK is published and versioned correctly (we just did this).
*   **API Compatibility**: CLI needs endpoints on `api.relaycore.xyz` for:
    *   Registry lookup.
    *   Reputation queries.
    *   Tunneling (future feature).
*   **Contract ABI**: CLI needs `IdentityRegistry` and `ReputationRegistry` ABIs to interact directly with the chain (for `relay register`).

## 5. Security Considerations
*   **Private Keys**: The CLI stores keys locally. We must ensure they are encrypted at rest (AES-256) and user is prompted for a password for sensitive ops (`withdraw`, `register`).
*   **Scaffold Defaults**: Templates must default to secure practices (e.g., verifying `x-payment-id`, not exposing stack traces).
