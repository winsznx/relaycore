# RelayCore Agent Project

A production-grade AI agent built with RelayCore.

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Add your RELAYCORE_API_KEY to .env
   ```

3. **Start development**
   ```bash
   relaycore dev
   ```

## Project Structure

```
.
├── apps/
│   ├── agent-server/     # MCP-compatible agent runtime
│   └── web/              # Next.js frontend dashboard
├── packages/
│   ├── config/           # Shared configuration
│   └── types/            # Shared TypeScript types
└── relaycore.config.ts   # RelayCore configuration
```

## Available Commands

- `relaycore dev` - Start development environment
- `relaycore agent register` - Register a new agent
- `relaycore service register` - Register a new service
- `relaycore auth status` - Check authentication status

## Documentation

Visit [docs.relaycore.io](https://docs.relaycore.io) for full documentation.

## Support

- Discord: [discord.gg/relaycore](https://discord.gg/relaycore)
- Email: support@relaycore.io
