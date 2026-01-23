#!/bin/bash
# Railway Environment Variable Upload Script
# Usage: ./upload-railway-env.sh <service-name>

SERVICE=$1
ENV_FILE=${2:-.env}

if [ -z "$SERVICE" ]; then
  echo "Usage: ./upload-railway-env.sh <service-name> [env-file]"
  echo "Services: graphql-api, indexers, mcp-server"
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE not found"
  exit 1
fi

echo "Uploading environment variables to Railway service: $SERVICE"
echo "From file: $ENV_FILE"
echo ""

# Read .env file and upload each variable
while IFS='=' read -r key value; do
  # Skip comments and empty lines
  [[ $key =~ ^#.*$ ]] && continue
  [[ -z $key ]] && continue
  
  # Remove quotes from value
  value=$(echo "$value" | sed 's/^"\(.*\)"$/\1/' | sed "s/^'\(.*\)'$/\1/")
  
  # Skip VITE_ variables for backend services
  if [[ "$SERVICE" != "graphql-api" ]] && [[ $key =~ ^VITE_ ]]; then
    continue
  fi
  
  echo "Setting $key..."
  railway variables --service "$SERVICE" --set "$key=$value" --skip-deploys
done < "$ENV_FILE"

echo ""
echo "✓ All variables uploaded for service: $SERVICE"
echo "Run 'railway up --service $SERVICE' to deploy with new variables"
