# Publishing the Relay Core SDK

The SDK has been refactored to be self-contained and ready for the npm registry.

## Prerequisites
1. You need an npm account.
2. You must belong to the `relaycore` organization on npm (or change the package name).

## Steps

1. **Login to npm**
   ```bash
   npm login
   ```

2. **Build the SDK**
   Ensure dependencies are installed and build:
   ```bash
   cd src/sdk
   npm install
   npm run build
   ```
   *Success means you see `dist/` folder with .js and .d.ts files.*

3. **Publish**
   ```bash
   npm publish --access public
   ```

## Troubleshooting
- **"You do not have permission to publish"**: 
  - Check if you are logged in: `npm whoami`
  - Check if you own `@relaycore`. If not, change `"name"` in `package.json` to `@<your-username>/relaycore-sdk`.

- **Build fails**:
  - Ensure all dependencies are installed (`npm install`).
  - Check `tsup.config.ts` if new native dependencies are added.
