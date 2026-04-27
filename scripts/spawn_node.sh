#!/bin/bash

WATCH_MODE=false
SKIP_UI=false
EXTRA_ARGS=()

# Parse the args isolating flags
for arg in "$@"; do
    if [[ "$arg" == "--watch" ]]; then
        WATCH_MODE=true
    elif [[ "$arg" == "--skip-ui" ]]; then
        SKIP_UI=true
    elif [[ "$arg" == "--headless" ]]; then
        HEADLESS=true
        SKIP_UI=true
        EXTRA_ARGS+=("$arg")
    else
        EXTRA_ARGS+=("$arg")
    fi
done

echo "==========================================="
echo "       Spawning Verimus Node               "
echo "==========================================="

export PATH=$PATH:/opt/homebrew/bin:/opt/homebrew/opt/node/bin

if [ "$WATCH_MODE" = true ]; then
    echo "Starting in WATCH mode (auto-refresh enabled)..."
    if [ "$HEADLESS" != true ] && [ "$SKIP_UI" != true ]; then
        echo "[1/2] Starting UI watcher in background..."
        npm run watch:ui &
        UI_PID=$!
    else
        echo "[1/2] Skipping UI watcher (--headless or --skip-ui active)"
        UI_PID=""
    fi

    # Extract port for local logging bounds
    PORT_VAL="26780"
    for ((i=0; i<${#EXTRA_ARGS[@]}; ++i)); do
        if [[ "${EXTRA_ARGS[i]}" == "--port" ]]; then
            PORT_VAL="${EXTRA_ARGS[i+1]}"
        fi
    done

    # Calculate a staggered delay based on the port to prevent network collapse on file changes
    STAGGER_DELAY=$(((PORT_VAL - 26780) * 2 + 1))
    if [ "$STAGGER_DELAY" -lt 1 ]; then
        STAGGER_DELAY=1
    fi
    
    echo "[2/2] Starting Peer Node watcher with ${STAGGER_DELAY}s restart stagger..."
    npx nodemon --delay ${STAGGER_DELAY} -x tsx -e ts --ignore data/ --ignore storage/ index.ts "${EXTRA_ARGS[@]}" > "/tmp/watch_node_${PORT_VAL}.log" 2>&1 &
    NODE_PID=$!
    
    # Trap Ctrl-C to cleanly kill background watchers without zombie processes
    trap "echo -e '\nStopping Watchers...'; kill $UI_PID $NODE_PID 2>/dev/null; exit 0" SIGINT SIGTERM
    
    # Wait holding active shell focus 
    if [ ! -z "$UI_PID" ]; then
        wait $UI_PID $NODE_PID
    else
        wait $NODE_PID
    fi
else
    echo "Starting in STANDARD mode..."
    
    if [[ "$SKIP_UI" != "true" ]]; then
        echo "[1/2] Building UI statically..."
        npm run build:ui
    fi

    echo "[2/2] Starting Peer Node..."
    npm run start:node -- "${EXTRA_ARGS[@]}"
fi
