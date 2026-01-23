---
description: How error boundaries work and common issues
---

## Error Boundary Patterns

The project uses custom error boundaries to handle different types of errors gracefully.

### Web3ErrorBoundary

Located in: `src/lib/web3.tsx`

This error boundary ONLY catches Web3-related errors. It checks if the error message contains keywords like:
- web3
- wagmi
- wallet
- connector
- chain
- rpc
- provider
- ethereum

If the error does NOT match these keywords, it re-throws the error so it can be caught by a more appropriate error boundary or shown in the console.

### Common Issue: "Connection Error" appearing for non-Web3 errors

If you see the "Connection Error" screen for what appears to be a non-Web3 issue:

1. Check the browser console for the actual error
2. The error boundary in `src/lib/web3.tsx` should only catch Web3 errors
3. If it's catching other errors, add more specific keyword checks or fix the underlying rendering error

### Adding New Error Boundaries

When creating new error boundaries:
1. Never catch ALL errors - be specific about what you're handling
2. Re-throw errors you don't handle with `throw error` in `getDerivedStateFromError`
3. Log errors in `componentDidCatch` for debugging
4. Provide clear error messages that distinguish the error type

### Example Pattern

```tsx
static getDerivedStateFromError(error: Error) {
    const isMySpecificError = 
        error.message?.toLowerCase().includes('specific-keyword')
    
    if (isMySpecificError) {
        return { hasError: true }
    }
    throw error  // Re-throw so another boundary can handle it
}
```
