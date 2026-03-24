# Phase 0: Permissionless Transport Layer

## Objective
To enable true decentralized participation in Project Clementine, the network must shed its reliance on a permissioned, shared transport key (the global "Ring" RSA key). 

This pivotal Phase 0 upgrade mandates copying the `ringnet` library locally, rebranding it to a native `p2p` module, and refactoring its connection handshake sequences to authorize peers solely via their personal cryptographic identities.

---

## 1. Forking `Ringnet` to `p2p`
Because `ringnet` acts as the core engine powering our WebSockets and message routing, and since it is internally owned contextually, we will decouple the project from the external package registry mapping.

### Implementation Mechanism
- Terminate the dependency `ringnet` mapping inside `package.json`.
- Physically copy the raw source code of the `ringnet` library into a top-level directory `p2p/` within the `Verimus` repository.
- Refactor all internal project imports (e.g., inside `PeerNode.ts` and `SyncEngine.ts`) mapping from `'ringnet'` directly to `'../p2p'`.

---

## 2. Permissionless Identity Handshakes
The legacy `ringnet` structure requires an identical private `.pem` key provided upon instantiation. Without this key, external WebSocket upgrade requests are forcefully severed.

### The Cryptographic Shift
- **Removing the Master Key:** Strip the global shared `ring` parameter requirement from the `p2p` configuration initialization arrays.
- **Personal RSA Signatures:** Modify the WebSocket handshake sequence (`challenge` / `response`) to demand a standard signature verified strictly against the peer's personal Public Key, preventing spoofing without requiring a shared password.
- **Routing Identification:** Make the Peer's Public Key their definitive Network ID binding. A successful TCP upgrade merely proves cryptographic ownership of an identity, nothing else.

---

## 3. Trust Delegation
In a permissionless environment, malicious actors will seamlessly join the default peer discovery endpoints. Transport layer security should not care about malicious payloads, only valid cryptographic signatures.

### Application Layer Governance
- By removing the transport layer gatekeeper, all structural filtering is officially delegated to the native `ReputationManager` and `ConsensusEngine`.
- If a connected node attempts spam routing, sends unverified block hashes, or generates invalid JSON schemas, the Application Layer instantly slashes their reputation bound.
- If the bound mathematically hits 0, the `ReputationManager` initiates a targeted `p2p.banPeer(publicKey)` pipeline, severing the physical socket connection dynamically.

---

## 4. Execution Task Checklist

- [x] Copy the `ringnet` source directory natively into `p2p/`.
- [x] Uninstall the legacy `ringnet` npm package and execute `npm install`.
- [x] Mass refactor all import domains globally shifting from the external package to the local `p2p/` entrypoint.
- [x] Refactor the `p2p/` Handshake logic (or equivalent challenge logic) to evaluate unique RSA signatures rather than symmetric or shared key verifications.
- [x] Refactor `spawn_nodes.sh`, `index.ts`, and our `GenerateKeys.ts` routines to eliminate passing global `ring.pem` files during peer boots.
- [x] Validate `npm test` to ensure native mocking schemas pointing to the P2P layer reflect the missing master key logic flawlessly.
