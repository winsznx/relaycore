# RelayCore CLI

The official command-line interface for **RelayCore**, the agentic finance infrastructure on Cronos. This tool scaffolds projects, manages identities, and spins up local development environments for autonomous agents.

📚 **Full Documentation**: [docs.relaycore.xyz/cli](https://docs.relaycore.xyz/cli/overview)

## Features

- **🚀 Scaffold Projects**: Generate production-ready Agent, Service, or Full-Stack templates.
- **🔐 Identity Management**: Register agents and services on-chain (Cronos).
- **🛠️ Local Development**: Run a full local stack with MCP server, Next.js dashboard, and hot-reloading.
- **🤖 MCP Integration**: Built-in support for Model Context Protocol servers.

## Installation

```bash
npm install -g @relaycore/cli

# or via pnpm
pnpm add -g @relaycore/cli
```

## Quick Start

### 1. Initialize a Project
Create a new agent project with a standard directory structure:

```bash
relaycore init my-agent
# Select template: Agent (MCP), Service (Express), or Full Stack
cd my-agent
```

### 2. Login & Authenticate
Authenticate your machine to interact with the RelayCore network:

```bash
relaycore auth login
# Opens browser to authenticate and saves session
```

### 3. Register Identity
Before you can transact, your agent needs an on-chain identity (Relay ID):

```bash
# Register an Agent (Consumer)
relaycore agent register
# Prompts for: Name, Description, Capabilities

# Register a Service (Provider)
relaycore service register
# Prompts for: Service Category, Input/Output Schemas, Price
```

### 4. Start Development Environment
Run your agent locally with the RelayCore harness:

```bash
relaycore dev
```
This command:
- Starts your **MCP Server** (port 3001)
- Luanches the **Relay Dashboard** (port 3000)
- Connects to **Cronos Testnet** via your local wallet configuration
- Watches for file changes

## Commands Reference

### `init`
```bash
relaycore init <project-name>
```
Scaffolds a new project. You will be prompted to choose a template:
- **Agent**: Minimal MCP server template.
- **Service**: Express.js service provider template.
- **Full**: Monorepo with both + Next.js frontend.

### `auth`
```bash
relaycore auth login   # Login via web
relaycore auth logout  # clear local session
relaycore auth whoami  # Show current user details
```

### `agent`
```bash
relaycore agent register    # Interactively register new agent
relaycore agent list        # List agents owned by you
relaycore agent update      # Update metadata for existing agent
```

### `service`
```bash
relaycore service register  # Register new service
relaycore service list      # List your services
```

### `dev`
```bash
relaycore dev
```
Starts the development studio. Requires a valid `relaycore.config.ts` in the project root.

## Configuration

The CLI looks for a `.env` file in your project root for local overrides:

```bash
RELAY_API_URL=https://api.relaycore.xyz  # Default
RELAY_ENV=testnet                        # default: testnet
PRIVATE_KEY=...                          # Optional: For script deploy
```

## License

MIT
