#!/bin/bash

STOP_MONGO=false
PEER_PORT="26780"

# Parse arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --mongo) STOP_MONGO=true ;;
        --port) PEER_PORT="$2"; shift ;;
        --mongo-host) shift ;; # Ignore options parsed by start.sh if accidentally passed
        --mongo-port) shift ;;
        --force) shift ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done

# Find PIDs of running node processes from PID file
PID_FILE="/tmp/node_${PEER_PORT}.pid"

if [ -f "$PID_FILE" ]; then
    NODE_PID=$(cat "$PID_FILE")

    if kill -0 "$NODE_PID" 2>/dev/null; then
        echo "Found running node process: $NODE_PID"
        echo "Stopping node..."
        
        # Send termination signal
        kill "$NODE_PID"

        # Wait up to 5 seconds for them to stop
        NODE_STOPPED=false
        for i in {1..5}; do
            if kill -0 "$NODE_PID" 2>/dev/null; then
                sleep 1
            else
                echo "Node successfully stopped."
                rm -f "$PID_FILE"
                NODE_STOPPED=true
                break
            fi
        done

        # Force kill if still running
        if [ "$NODE_STOPPED" = false ]; then
            echo "Process did not stop gracefully. Force killing..."
            kill -9 "$NODE_PID"
            rm -f "$PID_FILE"
            echo "Node successfully stopped."
        fi
    else
        echo "Process $NODE_PID is not running. Cleaning up PID file."
        rm -f "$PID_FILE"
    fi
else
    echo "No running node process found (no PID file)."
fi

if [ "$STOP_MONGO" = true ]; then
    echo "Stopping MongoDB..."
    MONGO_PIDS=$(pgrep -f "mongod" || echo "")
    if [ -n "$MONGO_PIDS" ]; then
        kill $MONGO_PIDS
        echo "MongoDB stopped."
    else
        echo "No running MongoDB process found."
    fi
fi
