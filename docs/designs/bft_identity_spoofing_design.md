# Architectural Design: Eliminating P2P Identity Spoofing

## 1. Background

During recent migrations, the Verimus node architecture shifted toward robust, decoupled keys: it relies on RSA keys for secure socket routing, and standard secp256k1 EVM key-pairs for consensus operations, financial settlement, and reputation tracking. Because these cryptographic elements are mathematically distinct with no inherent overlap, malicious actors exploit parsing layers by connecting through valid RSA connections but supplying arbitrary victim `walletAddress` parameters in their `HelloMessage`. When the perpetrator then spams the network, the `ReputationManager` assigns the systemic penalty against the innocent `walletAddress` across the network infrastructure. Resolving this critical spoofing vector demands a cryptographic bridge without shattering established P2P abstractions.

---

## 2. Alternatives Considered

### Alternative A: Challenge-Response Integration

Instead of forcing the validation through the `HelloMessage` handshake, the P2P connection constructs a standard socket loop tracking the `RSA Public Key`. Following connection validation, the local node's `ConsensusEngine` dispatches an `EVMIdentityChallenge` network payload across the socket with a random nonce, requiring the remote peer to sign the payload using their `ethers.Wallet` before network mapping completes.

**Pros:**

- **Strict Decoupling:** Secure P2P networking code remains ignorant of any financial identity logic or secp256k1 hashing dependencies.
- **Dynamic Security:** Relies on runtime nonce generation, nullifying playback attacks.

**Cons:**

- **Complex Protocol States:** Transitioning from an "UNTRUSTED_SOCKET" into a "VERIFIED_EVM_NODE" demands cascading callbacks breaking setup connection loops.
- **Race Vulnerabilities:** Any messages overlapping during the challenge-response validation logic require extensive queued buffering or risk dropping critical mempool configurations.

### Alternative B: Complete Deprecation of RSA (secp256k1 ECIES Routing)

Rewrite the `p2p/lib/*` socket components to rely exclusive on `secp256k1`-backed cryptography (matching Ethereum's devp2p or standard ECIES noise frameworks). Utilizing the exact node `ethers.Wallet` for both routing handshakes and consensus signatures unifies the network infrastructure.

**Pros:**

- **Inherent Security:** Eliminates the dual-identity framework resolving protocol overhead.
- **Zero Spoofing Factor:** The transport channel physical encryption establishes the identity tying the socket to the EVM ledger infrastructure.

**Cons:**

- **Massive Scope Bleed:** Restructuring the entire WebSocket architecture diverges from the scoped roadmap blocking immediate node stability milestones.
- **Timeline Constraints:** The required testing period to secure the new primitives across multi-node execution networks exceeds the current sprint timeline constraints.

---

## 3. Proposed Solution: Static Boot Injection Payload (Cross-Layer Bridge)

Instead of dragging EVM cryptographic boundaries across the `Client.js` networking parameters, or implementing an exhaustive challenge-response protocol, the optimal resolution verifies bounds **during node boot phase in `PeerNode.ts`**.

During edge initialization, the physical node aggregates the local `RSA Public Key` string. The standard `ethers.Wallet` signs this deterministic sequence, generating a secure `identityProofSignature`.

This local string signature and the `walletAddress` parameter are passed as static config options downward into the `Peer` component instance. The `Client.js` connection component attaches this pre-computed `identityProofSignature` string to the `HelloMessage.body`.

Upon receipt, the parsing `Client.js` runs a singular `ethers.verifyMessage()` check using the provided RSA public key parameter and the signature, validating protocol compliance.

### Comparative Analysis & Conclusion

While the **Static Boot Injection Payload** provides a fast patch mitigating the immediate ownership vulnerability, it fundamentally preserves technical debt by maintaining two distinct cryptographic domains (RSA for sockets, Secp256k1 for consensus).

**Alternative A** injects excessive async state buffering across P2P protocols causing brittle integration networks.

Therefore, leadership has unblocked the scope boundaries and formally pivoted to adopt **Alternative B (Complete Deprecation of RSA & ECIES Routing)**. Unifying the protocol completely eradicates the spoofing vector intrinsically while significantly decreasing the codebase dependency footprint.

This monumental architectural upgrade is tracked extensively in the [Secp256k1 Transport & Identity Refactor Roadmap](./secp256k1_transport_refactor_roadmap.md).
