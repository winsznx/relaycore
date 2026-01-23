#!/bin/bash

echo "🚀 Relay Core - Frontend Testing Quick Start"
echo "=============================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "✅ .env created. Please edit it with your credentials."
    echo ""
    echo "Required variables:"
    echo "  - WALLET_PRIVATE_KEY (for x402 payments)"
    echo "  - SUPABASE_URL"
    echo "  - SUPABASE_SERVICE_KEY"
    echo "  - SUPABASE_ANON_KEY"
    echo ""
    read -p "Press Enter after editing .env file..."
fi

echo "📦 Installing dependencies..."
npm install

echo ""
echo "🔨 Building project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed! Please fix errors above."
    exit 1
fi

echo "✅ Build successful!"
echo ""
echo "🎯 Starting services..."
echo ""
echo "Terminal 1 (this): Backend API (GraphQL + REST)"
echo "Terminal 2: Frontend (run: npm run dev)"
echo "Terminal 3: MCP Server (run: cd mcp-server && npm run dev)"
echo ""
echo "📍 Service URLs:"
echo "  Frontend:    http://localhost:5173"
echo "  GraphQL API: http://localhost:4000/graphql"
echo "  REST API:    http://localhost:4001/api"
echo "  MCP Server:  http://localhost:3002"
echo ""
echo "📖 Testing Guide: .agent/FRONTEND_TESTING_GUIDE.md"
echo ""
echo "Starting backend in 3 seconds..."
sleep 3

npm run dev:graphql
