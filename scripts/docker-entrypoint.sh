#!/bin/bash
set -e

echo "==========================================="
echo "       Verimus Docker Node Initiating      "
echo "==========================================="

# If the user provides a mnemonic, convert it to a private key
if [ ! -z "$EVM_WALLET_MNEMONIC" ] && [ -z "$PEER_EVM_PRIVATE_KEY" ]; then
    echo "[*] Recovering wallet from provided EVM_WALLET_MNEMONIC..."
    export PEER_EVM_PRIVATE_KEY=$(node -e "
        const { Wallet } = require('ethers');
        const w = Wallet.fromPhrase(process.env.EVM_WALLET_MNEMONIC);
        console.log(w.privateKey);
    ")
fi

if [ -z "$PEER_EVM_PRIVATE_KEY" ]; then
    echo "[!] No PEER_EVM_PRIVATE_KEY or EVM_WALLET_MNEMONIC set in environment."
    echo "[*] Generating a new ephemeral wallet for testing purposes..."
    
    # Generate wallet safely and output it
    NEW_WALLET_JSON=$(node -e "
        const { Wallet } = require('ethers');
        const w = Wallet.createRandom();
        console.log(JSON.stringify({ address: w.address, mnemonic: w.mnemonic.phrase, privateKey: w.privateKey }));
    ")
    
    export PEER_EVM_PRIVATE_KEY=$(node -e "console.log(JSON.parse(process.argv[1]).privateKey)" "$NEW_WALLET_JSON")
    
    MNEMONIC=$(node -e "console.log(JSON.parse(process.argv[1]).mnemonic)" "$NEW_WALLET_JSON")
    ADDRESS=$(node -e "console.log(JSON.parse(process.argv[1]).address)" "$NEW_WALLET_JSON")

    echo -e "\n==========================================="
    echo "       ✨ NEW WALLET GENERATED ✨          "
    echo "==========================================="
    echo "Address:     $ADDRESS"
    echo "Seed Phrase: $MNEMONIC"
    echo "Private Key: $PEER_EVM_PRIVATE_KEY"
    echo "==========================================="
    echo -e "SAVE THIS SEED PHRASE. IT WILL NOT BE SHOWN AGAIN.\n"
fi

# Natively synthesize self-signed EC bounds gracefully bypassing GitHub explicit '.pem' tracking exclusions
if [ ! -f "https.key.pem" ] || [ ! -f "https.cert.pem" ]; then
    echo "[*] Natively generating ephemeral physical TLS certificates securely for TCP 26780 bindings..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout https.key.pem -out https.cert.pem -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
    echo "[*] TLS configuration mapped structurally!"
fi

# Enable environment injections naturally for CredentialProvider mappings
export STORAGE_CREDS_ACTIVE="true"

echo "[*] Starting Node instance via tsx..."
# Launch the index.ts node directly passing all additional runtime flags
exec npx tsx index.ts "$@"
