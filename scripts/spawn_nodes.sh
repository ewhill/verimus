#!/bin/bash

# Configuration
PORTS=(26780 26781 26782 26783 26784)

cleanup() {
    echo -e "\n\033[1;31mStopping all nodes...\033[0m"
    for port in "${PORTS[@]}"; do
        "$(dirname "$0")/stop.sh" --port $port > /dev/null 2>&1 || true
    done
    pkill -f "mongod --dbpath" || true
    echo "Cleanup complete. Exiting."
    exit 0
}

# Trap Ctrl-C (SIGINT)
trap cleanup SIGINT

echo "==========================================="
echo "  Spawning 5 Nodes & Seeding 5 Blocks      "
echo "==========================================="

echo "1. Cleaning up existing instances..."
for port in "${PORTS[@]}"; do
    "$(dirname "$0")/stop.sh" --port $port > /dev/null 2>&1 || true
done
# Small delay to ensure ports are released
sleep 1

echo "Starting MongoDB..."
mkdir -p "$PWD/mongo_data"
mongod --dbpath "$PWD/mongo_data" --bind_ip 127.0.0.1 > /dev/null 2>&1 &
sleep 3


echo "2. Validating and generating keys..."
npm run keygen


echo "3. Starting 5 peer nodes..."
# Start the first one with --mongo to ensure DB is up if needed
# The first node builds the UI, the remaining nodes skip it to avoid concurrent build conflicts
"$(dirname "$0")/spawn_node.sh" --watch --mongo --port ${PORTS[0]} --public-address 127.0.0.1:${PORTS[0]} --force > /dev/null 2>&1 &
echo "Started Node 1 on port ${PORTS[0]} (Seed Node)"
# Wait for node startup and UI build completion
sleep 8

# Start the rest
for i in {1..4}; do
    PORT=${PORTS[$i]}
    DISCOVER="127.0.0.1:${PORTS[0]}"
    "$(dirname "$0")/spawn_node.sh" --watch --skip-ui --port $PORT --discover $DISCOVER --public-address 127.0.0.1:$PORT --force > /dev/null 2>&1 &
    echo "Started Node $((i+1)) on port $PORT"
    sleep 3
done

echo "3.5. Injecting offline genesis funds into database resolving test net limits natively..."
sleep 5
node "$(dirname "$0")/seed_funds.mjs"

echo "Waiting for network convergence..."
MAX_RETRIES=30
RETRY_COUNT=0
# Wait until the seed node (port 26780) sees 4 connected peers.
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    # Suppress output, ignore self-signed certs, extract connectedCount
    CONNECTED_COUNT=$(curl -s -k "https://127.0.0.1:${PORTS[0]}/api/peers" | grep -o '"connectedCount":[0-9]*' | cut -d ':' -f 2)
    
    # If the endpoint returns empty (e.g. server starting up), default to 0
    if [ -z "$CONNECTED_COUNT" ]; then
        CONNECTED_COUNT=0
    fi

    if [ "$CONNECTED_COUNT" == "4" ]; then
        echo "✅ Network converged! All nodes are connected."
        break
    fi
    echo "Waiting for peers to connect ($CONNECTED_COUNT/4)..."
    sleep 2
    RETRY_COUNT=$((RETRY_COUNT+1))
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo -e "\033[1;33mWarning: Network did not fully converge within the time limit. Seeding might fail.\033[0m"
fi

echo "4. Seeding 5 blocks..."
for i in {1..5}; do
    FILE="dummy_seed_$i.txt"
    echo "Seed data for block $i - Timestamp: $(date)" > "$FILE"
    # Rotate target nodes for uploads
    TARGET_PORT=${PORTS[$(( (i-1) % 5 ))]}
    
    ABS_PATH="$PWD/$FILE"
    RESPONSE=$(curl -s -k -X POST -F "files=@$FILE" -F "paths=[\"$ABS_PATH\"]" "https://127.0.0.1:$TARGET_PORT/api/upload")
    
    if [[ $RESPONSE == *"success\":true"* ]]; then
        echo "✅ Seeded block $i via node on port $TARGET_PORT"
    else
        echo "❌ Failed to seed block $i via node on port $TARGET_PORT"
        echo "Response: $RESPONSE"
    fi
    rm "$FILE"
done

echo -e '\n\033[1;32m==========================================='
echo "  Nodes are running and active!            "
echo -e '===========================================\033[0m'
for port in "${PORTS[@]}"; do
    echo -e "Node UI: \033[1;34mhttps://localhost:$port\033[0m"
done
echo "==========================================="
echo -e "Press \033[1;33mCtrl-C\033[0m to stop all nodes and exit."

# Keep the script alive to maintain the trap
while true; do
    sleep 1
done
