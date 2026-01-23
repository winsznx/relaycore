#!/bin/bash

# LangGraph Dependencies Installation Script
# Run this to install all required dependencies for the chatbot refactor

echo "Installing LangGraph dependencies..."
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# Install dependencies
echo "Running: npm install @langchain/langgraph @langchain/core @langchain/anthropic chromadb zod --legacy-peer-deps"
echo ""

npm install @langchain/langgraph @langchain/core @langchain/anthropic chromadb zod --legacy-peer-deps

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Dependencies installed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Run 'npm run build:graphql' to verify the build"
    echo "2. Run 'npm run dev:graphql' to start the server"
    echo "3. Test the chat endpoint with:"
    echo "   curl -X POST http://localhost:4000/api/chat \\"
    echo "     -H 'Content-Type: application/json' \\"
    echo "     -d '{\"message\": \"What is the current BTC price?\"}'"
    echo ""
else
    echo ""
    echo "✗ Installation failed"
    echo ""
    echo "If you see permission errors, try:"
    echo "  sudo npm install @langchain/langgraph @langchain/core @langchain/anthropic chromadb zod --legacy-peer-deps"
    echo ""
    echo "Or fix npm permissions:"
    echo "  sudo chown -R $(whoami) ~/.npm"
    echo ""
    exit 1
fi
