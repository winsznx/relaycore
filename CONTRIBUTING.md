# Contributing Guidelines

This document outlines the rules and guidelines for contributing to Relay Core. All contributors are expected to follow these standards to maintain code quality and project consistency.

## 1. Commit Messages

Use clear, descriptive commit messages that explain what was changed and why.

Format: `<Verb in present tense> <action>`

Valid examples:
- Added escrow session creation endpoint
- Updated RWA settlement agent with SLA verification
- Fixed rate limiting logic in escrow service
- Refactored MCP tools for consistency

Invalid examples:
- Fixed stuff
- WIP
- Changes
- Final commit

For larger changes, use multi-line commit messages:
```
Add ACPS escrow integration

- Implemented EscrowAgentService with session lifecycle management
- Added security features: rate limiting, blacklisting, nonce tracking
- Created Supabase migration for escrow tables
- Integrated with MCP server (7 new tools)
```

Before opening a PR, squash related commits into logical units using `git rebase -i`.

## 2. Issues

Open an issue when:
1. A significant code change is required (50+ lines)
2. Proposing new features or enhancements
3. Reporting bugs or unexpected behavior
4. Suggesting code refactoring
5. Identifying areas needing test coverage

Use issue templates when available. Label issues appropriately (bug, enhancement, documentation, etc.).

## 3. Branches and Pull Requests

The `main` branch contains production-ready code. Never commit directly to main.

Branch naming conventions:
- Feature branches: `feature/acps-escrow-integration`
- Bug fixes: `fix/rate-limit-overflow`
- Documentation: `docs/mcp-guide-update`
- Issue references: `issue-123-rwa-settlement`

Valid branch names:
- `feature/rwa-settlement-agent`
- `fix/escrow-refund-logic`
- `docs/api-reference`

Invalid branch names:
- `my-changes`
- `test-branch`
- `final-version`

Pull request requirements:
1. Clear title describing the change
2. Description of what was implemented and why
3. Link to related issues
4. All tests passing
5. No merge conflicts with main

## 4. Code Style

### TypeScript and JavaScript
- Follow the Airbnb JavaScript Style Guide
- Use TypeScript strict mode
- Prefer async/await over callbacks
- Use meaningful variable and function names
- Document public APIs with JSDoc comments

### React Components
- Use functional components with hooks
- Keep components focused and composable
- Use TypeScript interfaces for props
- Follow the container/presentational pattern where appropriate

### Solidity Contracts
- Follow Solidity style guide
- Use NatSpec comments for public functions
- Prefer explicit over implicit
- Include comprehensive error messages

### General Guidelines
- No emojis in code, logs, or SDK output
- Use logger utility instead of console.log
- Handle errors explicitly
- Write self-documenting code with clear naming
- Keep functions small and focused

## 5. Testing

All new features should include tests:
- Unit tests for business logic
- Integration tests for API endpoints
- Contract tests for Solidity code

Run tests before submitting PRs:
```bash
pnpm test
pnpm typecheck
```

## 6. Documentation

Update documentation when:
- Adding new features
- Changing API interfaces
- Modifying configuration options
- Updating deployment procedures

Documentation should be:
- Clear and concise
- Technically accurate
- Include code examples where helpful
- Use gender-neutral language

## 7. Security

Security is critical for a payment infrastructure project:
- Never commit secrets, keys, or credentials
- Use environment variables for configuration
- Follow the principle of least privilege
- Report security vulnerabilities privately

Sensitive files that must never be committed:
- `.env` files
- Private keys
- API credentials
- Database connection strings

## 8. Code Review

All code changes require review before merging:
- Be respectful and constructive in reviews
- Focus on code quality, not personal preferences
- Explain the reasoning behind suggestions
- Approve only when confident in the changes

## 9. Project Structure

Maintain the established project structure:
```
relaycore/
  contracts/           # Solidity smart contracts
  mcp-server/          # MCP server for agent integration
  src/
    components/        # React UI components
    pages/             # Page components
    services/          # Business logic and APIs
    lib/               # Shared utilities
  supabase/
    migrations/        # Database migrations
```

When adding new directories or significantly modifying structure, discuss in an issue first.

## 10. Communication

- Use GitHub issues for bug reports and feature requests
- Use pull request comments for code discussions
- Be respectful and professional in all communications
- Assume good intent from other contributors

Thank you for contributing to Relay Core.
