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

if [ "$WATCH_MODE" = true ]; then
    echo "Starting in WATCH mode (auto-refresh enabled)..."
    if [ "$HEADLESS" != true ]; then
        echo "[1/2] Starting UI watcher in background..."
        npm run watch:ui &
        UI_PID=$!
    else
        echo "[1/2] Skipping UI watcher natively (--headless active)"
        UI_PID=""
    fi

    echo "[2/2] Starting Peer Node watcher..."
    # Launch nodemon passing port and configs natively over npm "--" bindings
    
    # Extract port for local logging bounds
    PORT_VAL="unknown"
    for ((i=0; i<${#EXTRA_ARGS[@]}; ++i)); do
        if [[ "${EXTRA_ARGS[i]}" == "--port" ]]; then
            PORT_VAL="${EXTRA_ARGS[i+1]}"
        fi
    done
    
    npm run watch:node -- "${EXTRA_ARGS[@]}" > "/tmp/watch_node_${PORT_VAL}.log" 2>&1 &
    NODE_PID=$!
    
    # Trap Ctrl-C to cleanly kill background watchers exclusively avoiding zombie processes
    trap "echo -e '\nStopping Watchers...'; kill $UI_PID $NODE_PID 2>/dev/null; exit 0" SIGINT SIGTERM
    
    # Wait recursively holding active shell focus 
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
