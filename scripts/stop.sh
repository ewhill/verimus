#!/bin/bash

# Extract port flag
PORT=""
for ((i=1; i<=$#; i++)); do
    if [ "${!i}" == "--port" ]; then
        next=$((i+1))
        PORT="${!next}"
    fi
done

if [ -z "$PORT" ]; then
    echo "Usage: ./stop.sh --port <port>"
    exit 1
fi

echo "Stopping processes on port $PORT..."
# Find PIDs tied to the port and kill them cleanly
PIDS=$(lsof -ti :$PORT)
if [ ! -z "$PIDS" ]; then
    kill -9 $PIDS 2>/dev/null || true
fi
