# Grapevine: Metamask Integration & Client-Side Encryption Architecture Roadmap

This technical overhaul fundamentally changes the Verimus permission mapping. Historically, the local node's public key assumed total ownership of uploaded data. This roadmap decouples the **Logical Data Owner** (identified by a consumer Web3 Metamask Wallet) from the **Network Originator** (the Verimus Node acting as a broker/gateway).

## Architectural Paradigm: "Signer As Oracle"

Because Metamask is natively built exclusively for EVM (Ethereum Virtual Machine) chains, it cannot interface seamlessly with Verimus out-of-the-box via Custom RPCs, as Verimus utilizes proprietary peer-discovery and payload distribution rather than standard EVM execution traces. Furthermore, building custom "Metamask Snaps" (plugins) introduces severe operational friction requiring arbitrary user installations.

To bypass EVM constraints while fully leveraging Metamask, this roadmap completely adopts the **"Signer As Oracle"** pattern:
1. Metamask is completely decoupled from P2P networking and simply leveraged via `ethers.js` strictly as a cryptographic Identity Provider constraint.
2. The UI asks the wallet to sign standard `personal_sign` or structured `EIP-712` requests locally before submitting files (e.g. `Approve Verimus Block Upload`).
3. The Originator Node cryptographically parses the Ethereum logic via `ethers.utils.verifyMessage`, extracts the 0x-Address as the immutable `ownerAddress`, and then natively structures our proprietary network formats downstream.

This approach guarantees zero modifications are required for Metamask end-users while keeping our blockchain pure from EVM baggage.

### Cryptographic Identity Bridge (Address Space Mapping)

This model establishes a **Cryptographic Identity Bridge** rather than a traditional Financial Smart-Contract Bridge. It inherently adopts the Ethereum Secp256k1 namespace as the Verimus internal user identity constraint system:
1. **Owning Blocks:** Because the Verimus codebase evaluates Secp256k1 signatures seamlessly, the `0x...` Ethereum string is written immutably as the `ownerAddress` of isolated data blocks. The Verimus network actively guards data drops demanding continuous challenge-response Metamask signatures to query payloads.
2. **Owning $VERI Tokens:** If `$VERI` is an internal P2P token, the Verimus `WalletManager` will natively map escrow balances matching the injected `0x...` strings logically on-chain. Alternatively, if `$VERI` ever launches as an external ERC-20 overlay, this architecture allows Verimus Originators to mathematically verify ERC-20 transfers directly on external layer-2s to seamlessly authorize internal storage limit orders instantly bridging financial logic intuitively.

## Architecture: Metamask Native Encryption & Dual-Escrow

Based on user requirements, the system will explicitly adopt advanced Metamask APIs to seamlessly emulate the platform's current functionality, retaining AES storage internally on the public ledger without compromising security:

### 1. Embedded Payload Encryption (`eth_getEncryptionPublicKey`)
It is entirely possible to store the AES keys inside the `STORAGE_CONTRACT` itself using Metamask's native asymmetric encryption. 
- During upload, the React UI will prompt Metamask via `ethereum.request({ method: 'eth_getEncryptionPublicKey' })`.
- The UI encrypts the generated AES key locally using this Metamask-provided public key (via `eth-sig-util`).
- The *encrypted* AES key is submitted to the Verimus Originator Node and embedded natively into the `BlockPrivate` payload.
- Upon downloading, the encrypted key is pulled from the blockchain by the user, and the UI triggers `ethereum.request({ method: 'eth_decrypt' })` to seamlessly decrypt the AES key on-the-fly and reconstruct the files, completely shielding the Originator Node from raw data.

### 2. Multi-Party P2P Escrow (User + Originator Stake)
To ensure skin-in-the-game, the Verimus ledger will execute a dual-sided native escrow sequence:
- **Authorization:** P2P Limit Orders require the Web3 user to have a native `$VERI` balance mapped to their `0x...` address inside the Verimus Ledger natively. By signing the Upload EIP-712 request, the user mathematically authorizes the Originator Node to act as a Smart-Broker over those funds.
- **Dual-Freeze:** `WalletManager.ts` will freeze the necessary $VERI from the User's balance (for data storage costs) AND freeze a concurrent "Originator Stake" from the Node's own public key balance (for network brokering accountability).
- **Settlement:** Both native locks are committed permanently to the host nodes and stakeholders exclusively once cryptographic consensus verifies successful Shard Matrix dispersal.

### 3. Hybrid Cryptographic Infrastructure
From a security and performance standpoint, the system will explicitly adopt a **Hybrid Cryptographic Design** rather than forcing the entire internal P2P network onto Ethereum curves:
- **P2P Node Layer (Ed25519):** Inter-node communication, storage chunk handoffs, Merkle structural validations, and gossip protocol handshakes will continue to utilize optimized, high-performance `Ed25519` cryptography. This shields the core network performance from EVM baggage.
- **Consumer Layer (Secp256k1):** The consensus engine will natively accept Ethereum signed payloads (Secp256k1) universally from UI clients. Upon validation via `ethers.js`, the Node securely casts the Ethereum public keys as isolated, strict metadata strings recursively inside the Ed25519-signed `Block` limits. 
- **The Result:** Users enjoy 100% native Metamask usability without performance degradation within the node's underlying Shard Matrix storage protocol.

## Proposed Implementation Phases

### Phase 1: Client-Side Encryption Decoupling
Currently, `UploadHandler.ts` intercepts raw files, streams them into a Zip, generates an AES key, and then pipes the ciphertext into the Erasure matrices.
- **UI Architecture:** Implement a WebWorker in the React frontend to construct the zip and apply AES-256-GCM encryption natively in the browser. 
- **API Endpoints:** Modify the `/api/upload` endpoint to explicitly bypass backend AES generation. The endpoint will assume the incoming `FormData` blob is mathematically opaque.
- **Key Management:** The frontend will download the `aesKey` to the user's machine locally, or store it offline securely. The backend `BlockPrivate` payload will no longer possess or broadcast the literal AES key.

### Phase 2: Web3 UI Integration 
- **Dependencies:** Install `ethers.js` within the `ui/` directory.
- **Component Design:** Build a `<WalletConnection />` modal supporting standard `window.ethereum` injection.
- **State Management:** Map the connected `userAddress` to the global Zustand `store/index.js`, persisting identity across the React application.
- **EIP-712 Signatures:** Before the UI submits the encrypted payload to `/api/upload`, it will prompt Metamask to sign a verification string (e.g., `Requesting Verimus Originator Proxy for payload hash: 0x...`). 

### Phase 3: Backend Gateway (Originator Role)
- **Signature Verification:** `UploadHandler.ts` will strictly require `userAddress` and `signature` strings attached to the upload form data. It will dynamically recover the signer identity via `ethers.utils.verifyMessage()` and block mismatches.
- **Payload Overhaul:** Modify the `StorageContractPayload` type inside `types/index.d.ts` to logically include an `ownerAddress` variable. 
- **Block Proposal:** The Verimus node processes the shard matrix normally and signs the pending `STORAGE_CONTRACT` block with its *own* Node private key, effectively serving as the Originator gateway for the Web3 user.

### Phase 4: Access Control & Auditing
- **Download Guardrails:** The `/api/download/:hash` routes will be updated to respect the block's embedded `ownerAddress`. If a download is requested via the UI, the frontend must issue a fresh challenge-response Metamask signature to prove active ownership.
- **Consensus Security:** Network peers verifying the incoming block will confirm the Originator Node mathematically signed the block, while logging the `ownerAddress` for immutable ledger tracing.

## Verification Plan

### Automated Tests
- Unit test `UploadHandler` utilizing `ethers.Wallet.createRandom()` to securely mock a Metamask payload submission.
- Ensure `streamErasureBundle` natively accepts and disperses pre-encrypted blobs without structural padding mismatches. 

### Manual Verification
- Launch the UI locally with a Metamask browser extension active.
- Connect wallet -> encrypt and upload dummy file -> Verify node broadcasts block matching the Metamask address.
- Clear browser data, reload, and verify that attempting to download the file prompts a Metamask signing challenge to decrypt.
