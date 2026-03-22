#!/bin/bash

# Default values
START_MONGO=false
MONGO_DB_PATH="/tmp/mongo_test_db"
MONGO_LOG_PATH="/tmp/mongo_test.log"
MONGO_HOST="127.0.0.1"
MONGO_PORT="27017"
PEER_PORT="26780"
FORCE_KILL=false

# Parse arguments first pass to get port
ARGS=("$@")
for ((i=0; i<$#; i++)); do
    if [[ "${ARGS[i]}" == "--port" ]]; then
        PEER_PORT="${ARGS[i+1]}"
    fi
done

NODE_LOG_FILE="/tmp/node_${PEER_PORT}.log"
PID_FILE="/tmp/node_${PEER_PORT}.pid"

EXTRA_ARGS=()
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --mongo) START_MONGO=true ;;
        --mongo-host) MONGO_HOST="$2"; EXTRA_ARGS+=("$1" "$2"); shift ;;
        --mongo-port) MONGO_PORT="$2"; EXTRA_ARGS+=("$1" "$2"); shift ;;
        --port) PEER_PORT="$2"; EXTRA_ARGS+=("$1" "$2"); shift ;;
        --force) FORCE_KILL=true ;;
        *) EXTRA_ARGS+=("$1") ;;
    esac
    shift
done

# Start MongoDB conditionally
if [ "$START_MONGO" = true ]; then
    echo "Starting MongoDB..."
    mkdir -p "$MONGO_DB_PATH"
    
    # Check if mongod is already running on the configured port
    if nc -z "$MONGO_HOST" "$MONGO_PORT" 2>/dev/null; then
        echo "MongoDB is already running on $MONGO_HOST:$MONGO_PORT."
    else
        mongod --dbpath="$MONGO_DB_PATH" --logpath="$MONGO_LOG_PATH" --port="$MONGO_PORT" --bind_ip="$MONGO_HOST" --fork
        echo "MongoDB started on $MONGO_HOST:$MONGO_PORT."
    fi
else
    echo "Skipping MongoDB startup (--mongo flag not provided)."
fi

# Check if Node is already running
if [ -f "$PID_FILE" ]; then
    NODE_PID=$(cat "$PID_FILE")
    if kill -0 "$NODE_PID" 2>/dev/null; then
        if [ "$FORCE_KILL" = true ]; then
            echo "Found running node process ($NODE_PID). Killing..."
            "$(dirname "$0")/stop.sh"
        else
            read -p "Found running node process ($NODE_PID). Kill it? [y/N]: " choice
            case "$choice" in 
              y|Y ) echo "Killing..."; "$(dirname "$0")/stop.sh";;
              n|N ) echo "Aborting start."; exit 0;;
              * ) echo "Aborting start."; exit 0;;
            esac
        fi
    else
        echo "Stale PID file found. Cleaning up."
        rm -f "$PID_FILE"
    fi
fi

# Start the Node.js application in background
echo "Starting Node.js server..."
nohup node index.js "${EXTRA_ARGS[@]}" > "$NODE_LOG_FILE" 2>&1 &
NODE_PID=$!
echo $NODE_PID > "$PID_FILE"

echo "Node server started with PID: $NODE_PID"
echo "Logging output to: $NODE_LOG_FILE"
