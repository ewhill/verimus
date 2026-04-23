#!/bin/bash

# Configuration
PORTS=(26780 26781 26782 26783 26784)

cleanup() {
    echo -e "\n\033[1;31mStopping all nodes...\033[0m"
    for port in "${PORTS[@]}"; do
        "$(dirname "$0")/stop.sh" --port $port > /dev/null 2>&1 || true
    done
    kill -9 $(lsof -ti :27018) > /dev/null 2>&1 || true
    echo -e "\033[1;31mTearing down MongoDB...\033[0m"
    echo "Cleanup complete. Exiting."
    exit 0
}

generateUiPassword() {
    # Generate a random 12-character alphanumeric password
    PASSWORD=$(openssl rand -base64 9 | tr -dc 'a-zA-Z0-9' | head -c 12)
    echo $PASSWORD
}

# Trap Ctrl-C (SIGINT)
trap cleanup SIGINT

echo "==========================================="
echo "  Spawning 5 Nodess  "
echo "==========================================="
export UI_PASSWORD="$(generateUiPassword)"

export VERIMUS_GENESIS_TIMESTAMP=$(date +%s000)
export NODE_TLS_REJECT_UNAUTHORIZED=0

echo "1. Cleaning up existing instances..."
for port in "${PORTS[@]}"; do
    "$(dirname "$0")/stop.sh" --port $port > /dev/null 2>&1 || true
done
# Small delay to ensure ports are released
sleep 1

echo "2. Validating and generating keys..."
export PATH=$PATH:/opt/homebrew/bin:/opt/homebrew/opt/node/bin
npm run keygen

DB_PATH="/tmp/verimus-mongo-prod"

echo "Starting System Native MongoDB (Port 27018) for strictly pure network bounds natively..."
rm -rf "$DB_PATH"
mkdir -p "$DB_PATH"
mongod --port 27018 --dbpath "$DB_PATH" > /dev/null 2>&1 &
sleep 5


echo "3. Starting 5 peer nodes..."
# The first node builds the UI, the remaining nodes skip it to avoid concurrent build conflicts
echo "Started Node 1 on port ${PORTS[0]} (Seed Node)"
"$(dirname "$0")/spawn_node.sh" --watch --mongo-port 27018 --port ${PORTS[0]} --public-address 127.0.0.1:${PORTS[0]} --force > "node_${PORTS[0]}.log" 2>&1 &
# Wait for node startup and UI build completion
sleep 8

# Start the rest
for i in {1..4}; do
    PORT=${PORTS[$i]}
    DISCOVER="127.0.0.1:${PORTS[0]}"
    "$(dirname "$0")/spawn_node.sh" --watch --mongo-port 27018 --port $PORT --discover $DISCOVER --public-address 127.0.0.1:$PORT --force > "node_$PORT.log" 2>&1 &
    echo "Started Node $((i+1)) on port $PORT"
    echo "UI Password for Node $((i+1)): $UI_PASSWORD"
    sleep 3
done

echo "Waiting for network convergence..."
MAX_RETRIES=30
RETRY_COUNT=0
# Wait until the seed node (port 26780) sees 4 connected peers.
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    # Suppress output, ignore self-signed certs, extract connectedCount
    CONNECTED_COUNT=$(curl -s -k -u "admin:$UI_PASSWORD" "https://127.0.0.1:${PORTS[0]}/api/peers" | grep -o '"connectedCount":[0-9]*' | cut -d ':' -f 2)
    
    # If the endpoint returns empty (e.g. server starting up), default to 0
    if [ -z "$CONNECTED_COUNT" ]; then
        CONNECTED_COUNT=0
    fi

    if [ "$CONNECTED_COUNT" -ge 4 ]; then
        echo "✅ Network converged! All nodes are connected."
        break
    fi
    echo "Waiting for peers to connect: $CONNECTED_COUNT/4"
    sleep 2
    RETRY_COUNT=$((RETRY_COUNT+1))
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo -e "\033[1;33mWarning: Network did not fully converge within the time limit. Seeding might fail.\033[0m"
fi

echo -e '\n\033[1;32m==========================================='
echo "  Nodes are running and active!            "
echo -e '===========================================\033[0m'
for port in "${PORTS[@]}"; do
    echo -e "Node UI: \033[1;34mhttps://localhost:$port\033[0m"
    if [ -f "$PROJECT_ROOT/keys/peer_${port}.evm.address" ]; then
        ADDR=$(cat "$PROJECT_ROOT/keys/peer_${port}.evm.address")
        MNEMONIC="[Not Stored]"
        if [ -f "$PROJECT_ROOT/keys/peer_${port}.evm.mnemonic" ]; then
           MNEMONIC=$(cat "$PROJECT_ROOT/keys/peer_${port}.evm.mnemonic")
        fi
        echo -e "  Wallet Address: \033[1;33m$ADDR\033[0m"
        echo -e "  Seed Phrase: \033[1;30m$MNEMONIC\033[0m"
    fi
done
echo "==========================================="
echo -e "Press \033[1;33mCtrl-C\033[0m to stop all nodes and exit."

# Keep the script alive to maintain the trap
while true; do
    sleep 1
done
