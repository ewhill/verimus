#!/bin/bash
# Verimus Secure Storage - Network Cleanup Script
# This script removes all MongoDB ledger instances and local physical block/cache storage,
# ensuring the P2P nodes can boot from a perfectly clean slate.

STORAGE_DIR="storage"
DATA_DIR="data"

# Parse arguments for configurable directories
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --storage-dir)
            STORAGE_DIR="$2"
            shift 2
            ;;
        --data-dir)
            DATA_DIR="$2"
            shift 2
            ;;
        *)
            echo "Unknown parameter passed: $1"
            echo "Usage: ./scripts/cleanup.sh [--storage-dir <path>] [--data-dir <path>]"
            exit 1
            ;;
    esac
done

echo "Purging secure_storage_db_* databases in MongoDB..."

# Use native mongosh or mongo CLI tool for cleanup instead of Node runtime dependency
if command -v mongosh &> /dev/null; then
    MONGO_CMD="mongosh"
elif command -v mongo &> /dev/null; then
    MONGO_CMD="mongo"
else
    echo "Error: Neither 'mongosh' nor 'mongo' CLI tools were found. Please install MongoDB."
    exit 1
fi

$MONGO_CMD mongodb://127.0.0.1:27017 --quiet --eval "
    const dbs = db.adminCommand('listDatabases').databases;
    dbs.forEach(d => {
        if (d.name.startsWith('secure_storage_db_')) {
            print(' - Dropping ' + d.name);
            db.getSiblingDB(d.name).dropDatabase();
        }
    });
"

if [ -d "$PWD/mongo_data" ]; then
    echo "Removing local embedded mongo db state (mongo_data)..."
    rm -rf "$PWD/mongo_data"
fi

if [ -n "$STORAGE_DIR" ] && [ -d "$STORAGE_DIR" ]; then
    echo "Removing physical block storage ($STORAGE_DIR)..."
    rm -rf "$STORAGE_DIR"
fi

if [ -n "$DATA_DIR" ] && [ -d "$DATA_DIR" ]; then
    echo "Removing local cache data ($DATA_DIR)..."
    rm -rf "$DATA_DIR"
fi

echo "Cleanup successfully completed!"
