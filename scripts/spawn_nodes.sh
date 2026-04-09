#!/bin/bash

# Configuration
PORTS=(26780 26781 26782 26783 26784)

cleanup() {
    echo -e "\n\033[1;31mStopping all nodes...\033[0m"
    for port in "${PORTS[@]}"; do
        "$(dirname "$0")/stop.sh" --port $port > /dev/null 2>&1 || true
    done
    kill -9 $(lsof -ti :27018) > /dev/null 2>&1 || true
    echo -e "\033[1;31mTearing down Native Node Memory MongoDB...\033[0m"
    echo "Cleanup complete. Exiting."
    exit 0
}

# Trap Ctrl-C (SIGINT)
trap cleanup SIGINT

SEED_WALLET=""
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --seed-wallet) SEED_WALLET="$2"; shift 2 ;;
        *) shift ;;
    esac
done

echo "==========================================="
echo "  Spawning 5 Nodes & Seeding 5 Blocks      "
echo "==========================================="

export VERIMUS_GENESIS_TIMESTAMP=$(date +%s000)

echo "1. Cleaning up existing instances..."
for port in "${PORTS[@]}"; do
    "$(dirname "$0")/stop.sh" --port $port > /dev/null 2>&1 || true
done
# Small delay to ensure ports are released
sleep 1

echo "2. Validating and generating keys..."
npm run keygen

echo "Starting Native Hermetic Memory MongoDB (Port 27018 RAM) and Seeding Limits..."
node "$(dirname "$0")/memory_mongo_daemon.mjs" > /dev/null 2>&1 &
sleep 5


echo "3. Starting 5 peer nodes..."
# Start the first one with --mongo to ensure DB is up if needed
# The first node builds the UI, the remaining nodes skip it to avoid concurrent build conflicts
if [ 1 -eq 1 ]; then
    echo "Started Node 1 on port ${PORTS[0]} (Seed Node)"
    "$(dirname "$0")/spawn_node.sh" --watch --mongo-port 27018 --port ${PORTS[0]} --public-address 127.0.0.1:${PORTS[0]} --force > "node_${PORTS[0]}.log" 2>&1 &
else
    echo "Started Node 1 on port ${PORTS[0]}"
    "$(dirname "$0")/spawn_node.sh" --watch --mongo-port 27018 --port ${PORTS[0]} --public-address 127.0.0.1:${PORTS[0]} --force > /dev/null 2>&1 &
fi
# Wait for node startup and UI build completion
sleep 8

# Start the rest
for i in {1..4}; do
    PORT=${PORTS[$i]}
    DISCOVER="127.0.0.1:${PORTS[0]}"
    "$(dirname "$0")/spawn_node.sh" --watch --skip-ui --mongo-port 27018 --port $PORT --discover $DISCOVER --public-address 127.0.0.1:$PORT --force > "node_$PORT.log" 2>&1 &
    echo "Started Node $((i+1)) on port $PORT"
    sleep 3
done

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

DUMMY_WALLET="0xf29CeF8D4dFaBAa1C2d6813561c9AeaF3f97230f"
DUMMY_TIMESTAMP="1775344694641"
DUMMY_SIG="0x5d3b8b5e7b333b6a6e9bb6f93191c2b8428a06ba2459ee2bbc3620294a138e01000c09c47284b918a7da0844e044cea9ae310001108b886922cb500bc07c79e51c"

echo "4. Injecting Baseline Escrow Funding via MongoDB..."
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
for port in "${PORTS[@]}"; do
    # Let the network bootstrap inherently organically...
    # Exclude seeding nodes natively, let them mine Proof-of-Spacetime intrinsically.
    if [ -n "$SEED_WALLET" ]; then
        SEED_WALLET_CHECKSUM=$(node -e "const {ethers} = require('ethers'); console.log(ethers.getAddress('$SEED_WALLET'))")
        mongosh "mongodb://127.0.0.1:27018/secure_storage_db_${port}" --eval "db.balances.updateOne({ walletAddress: '$SEED_WALLET_CHECKSUM' }, { \$set: { balance: \"50000000000000000000000\" } }, { upsert: true });" > /dev/null 2>&1
    fi
    mongosh "mongodb://127.0.0.1:27018/secure_storage_db_${port}" --eval "db.balances.updateOne({ walletAddress: '$DUMMY_WALLET' }, { \$set: { balance: \"500000000000000000000000\" } }, { upsert: true });" > /dev/null 2>&1
done
echo "✅ Baseline balances physically synchronized to DB natively!"

# echo "5. Seeding 5 blocks..."
# for i in {1..5}; do
#     FILE="dummy_seed_$i.txt"
#     echo "Seed data for block $i - Timestamp: $(date)" > "$FILE"
#     # Rotate target nodes for uploads
#     TARGET_PORT=${PORTS[$(( (i-1) % 5 ))]}
#     
#     ABS_PATH="$PWD/$FILE"
#     RESPONSE=$(curl -s -k -X POST -F "files=@$FILE" -F "paths=[\"$ABS_PATH\"]" -F "ownerAddress=$DUMMY_WALLET" -F "ownerSignature=$DUMMY_SIG" -F "timestamp=$DUMMY_TIMESTAMP" "https://127.0.0.1:$TARGET_PORT/api/upload")
#     
#     if [[ $RESPONSE == *"success\":true"* ]]; then
#         echo "✅ Seeded block $i via node on port $TARGET_PORT"
#     else
#         echo "❌ Failed to seed block $i via node on port $TARGET_PORT"
#         echo "Response: $RESPONSE"
#     fi
#     rm "$FILE"
# done
echo "5. [Skipped] Seeding 5 test blocks... (Network requires organic PoSt limits scaling natively)"

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
