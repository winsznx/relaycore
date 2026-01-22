# Mintlify Documentation Deployment Guide

## Documentation Structure Complete

All 25+ MDX pages created:

**Getting Started**
- introduction.mdx
- quickstart.mdx
- installation.mdx

**Core Concepts**
- essentials/architecture.mdx
- essentials/x402-protocol.mdx
- essentials/sessions.mdx
- essentials/rwa-settlement.mdx
- essentials/agent-discovery.mdx

**Guides**
- guides/first-payment.mdx
- guides/create-session.mdx
- guides/register-agent.mdx
- guides/build-service.mdx

**SDK**
- sdk/overview.mdx
- sdk/agent-sdk.mdx
- sdk/service-sdk.mdx
- sdk/session-management.mdx
- sdk/error-handling.mdx

**MCP Server**
- mcp/overview.mdx
- mcp/installation.mdx
- mcp/tools-reference.mdx
- mcp/authentication.mdx

**API Reference**
- api-reference/overview.mdx
- api-reference/graphql.mdx
- api-reference/rest-endpoints.mdx
- api-reference/websockets.mdx

**Contracts**
- contracts/escrow-session.mdx
- contracts/identity-registry.mdx
- contracts/reputation-registry.mdx

**Deployment**
- deployment/local-development.mdx
- deployment/production.mdx
- deployment/environment-variables.mdx

---

## Deployment Steps

### Option 1: Mintlify Cloud (Recommended)

1. **Sign up at Mintlify**
   ```bash
   # Visit https://mintlify.com
   # Create account with GitHub
   ```

2. **Connect Repository**
   - Click "New Documentation"
   - Select `winsznx/relaycore` repository
   - Set docs directory: `/docs`
   - Set branch: `main`

3. **Configure Custom Domain**
   - Go to Settings → Custom Domain
   - Add domain: `docs.relaycore.xyz`
   - Copy CNAME record provided

4. **Update DNS**
   Add CNAME record to relaycore.xyz:
   ```
   Type: CNAME
   Name: docs
   Value: cname.mintlify.com
   TTL: 3600
   ```

5. **Deploy**
   - Push to GitHub
   - Mintlify auto-deploys on commit
   - Visit https://docs.relaycore.xyz

### Option 2: Self-Hosted via Vercel

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy Docs**
   ```bash
   cd /Users/macbook/relaycore
   vercel --prod
   ```

3. **Configure Domain**
   ```bash
   vercel domains add docs.relaycore.xyz
   ```

4. **Set Root Directory**
   In Vercel dashboard:
   - Root Directory: `docs`
   - Build Command: `mintlify build`
   - Output Directory: `.mintlify`

---

## Local Preview

Test documentation locally before deploying:

```bash
# Install Mintlify CLI (if not already installed)
npm install -g mintlify

# Preview docs
cd /Users/macbook/relaycore/docs
npx mintlify dev
```

Visit http://localhost:3000

---

## Post-Deployment Checklist

- [ ] Verify docs.relaycore.xyz resolves
- [ ] Test all navigation links
- [ ] Verify search functionality
- [ ] Check mobile responsiveness
- [ ] Test code block syntax highlighting
- [ ] Verify Mermaid diagrams render
- [ ] Test card groups and accordions
- [ ] Add Google Analytics (optional)
- [ ] Set up feedback widget
- [ ] Configure OpenAPI spec for API reference

---

## Continuous Deployment

**Mintlify Cloud:**
- Auto-deploys on push to main
- No configuration needed

**Vercel:**
- Auto-deploys on push to main
- Configure in vercel.json:
  ```json
  {
    "buildCommand": "cd docs && npx mintlify build",
    "outputDirectory": "docs/.mintlify"
  }
  ```

---

## Next Steps

1. Push docs to GitHub
2. Sign up for Mintlify account
3. Connect repository
4. Configure docs.relaycore.xyz CNAME
5. Deploy and verify
