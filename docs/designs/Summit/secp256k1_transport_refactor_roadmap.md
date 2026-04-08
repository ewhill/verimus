# Roadmap: Secp256k1 Transport & Identity Refactor

**Objective:** Completely rewrite the Verimus P2P networking bounds to use native `secp256k1` elliptic curve cryptography for both transport encryption and socket identity. This deprecates the legacy RSA key pairing, resolving identity spoofing vulnerabilities natively at the protocol level.

## Milestone 1: Core Cryptographic Primitive Integration

Introduce the low-level functions required for Elliptic-Curve Diffie-Hellman (ECDH) key exchanges relying exclusively on the node's `ethers.Wallet`.
**Deliverables:**

- Generate ECDH shared secret utility scripts mapping `secp256k1` keys.
- Construct the new symmetrical AES-GCM session-key generation pipeline relying on the ECDH output.
**Success Criteria:**
- Test handlers can securely encrypt and decrypt simulated arbitrary payloads using two distinct `ethers.Wallet` instances without relying on any RSA scaffolding.

## Milestone 2: P2P Socket Encryption Overhaul

Strip out all localized `RSAKeyPair` dependencies from the core networking classes (`Client.js`, `Peer.js`, `Server.js`) and wire the structural ECDH primitives into the connection lifecycle.
**Deliverables:**

- Refactor `Client.js` upgrade loops to establish transport encryption via the new ECDH parameters.
- Remove all `.pem` buffer parsing and RSA verification bounds across the codebase.
**Success Criteria:**
- Nodes can establish a secure `wss://` socket and decrypt payloads efficiently using standard `ethers` wallet keys exclusively.

## Milestone 3: Deprecate `HelloMessage` Identity Overheads

With the connection intrinsically encrypted via the EVM private key, the socket *is* the identity. Remove arbitrary identity payloads.
**Deliverables:**

- Delete localized `walletAddress`, `nonce`, and `signature` fields from `HelloMessage.js` and `SetupCipherMessage.js`.
- Extract remote wallet addresses deterministically from the established ECDH session constraints.
**Success Criteria:**
- Local nodes populate `connection.remoteCredentials_.walletAddress` intrinsically from the socket crypto context rather than relying on transmitted metadata.

## Milestone 4: Refactor Upstream Architectures

Reroute the `ReputationManager`, `ConsensusEngine`, and `SyncEngine` to ingest the new native limits implicitly.
**Deliverables:**

- Update `ReputationManager` ban arrays to interface strictly with EVM wallet addresses rather than RSA signatures.
- Adjust `ConsensusEngine` payload verification blocks reflecting the strict uniform identities.
**Success Criteria:**
- Slashing operations and systemic audits correctly flag the integrated `secp256k1` targets accurately without relying on secondary lookup architectures.

## Milestone 5: Legacy Cleanup & End-to-End Validation

Remove all legacy scripts, update generation bounds, and finalize the integration test harness.
**Deliverables:**

- Strip `.peer.pem` and local RSA generation entirely from `scripts/spawn_nodes.sh`, `GenerateKeys.ts`, and test bootstraps.
- Migrate all `p2p/lib` integration mocks to utilize local Ethereum key generation frameworks.
**Success Criteria:**
- `npm test` executes with `0` failures across the entire protocol.
- `npx tsc --noEmit` and `eslint` display zero errors.
- A functional 4-node mock network can deploy and achieve ledger consensus without RSA configuration files.
