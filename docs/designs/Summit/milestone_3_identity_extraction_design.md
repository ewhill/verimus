# Summit Milestone 3 Design: Deterministic Identity Extraction

## 1. Background
With the foundation of native ECDH encryption operating across WebSocket boundaries (Milestone 2), the protocol must confront how physical node identities are correlated to physical connections. The network previously allowed peers to self-declare their identity by broadcasting an explicit `walletAddress` string inside the legacy `HelloMessage`. Relying on explicit, unverified payload fields for identity fundamentally exposes the ledger to Sybil impersonation and reputation spoofing logic. The immediate objective mandates extracting the remote node's EVM wallet sequence exclusively from cryptographic mathematics rather than relying on transmitted metadata fields.

---

## 2. Alternatives Considered

### Alternative A: Explicit Payload Validation 
The transport layer continues to transmit the self-declared `walletAddress` string parameter alongside the new `EphemeralExchangeMessage`. The receiving parsing hook extracts this field and compares it against the standard mathematical recovery sequence (`ethers.verifyMessage`). If the explicitly declared field matches the cryptographically recovered address, the system binds the connection to the field variable.

**Pros:**
- **Debugging Verbosity:** Provides direct, human-readable logging errors ("Claimed Address string X does not match Recovered Signature Y").
- **Backward Compatibility:** Retains traditional object structures minimizing downstream adjustments inside legacy P2P discovery schemas.

**Cons:**
- **Payload Redundancy:** Transmitting a 42-character JSON sequence across the wire generates wasteful protocol overhead for data that is already mathematically intrinsic to the signature parameters.
- **Parsing Hazards:** If a downstream developer bypasses the verification block and accesses the `message.walletAddress` structure directly in the future, the spoofing vulnerability is reintroduced.

### Alternative B: Centralized Peer-to-Peer Identity Registry
Nodes query a centralized or on-chain `ValidatorRegistry` during socket handshakes using transient networking IPs. The connection is unencrypted until the registry confirms the IP mappings to the expected `walletAddress`.

**Pros:**
- **Network-Wide Consensus Alignment:** Eliminates localized spoofing entirely since all identities form absolute consensus.

**Cons:**
- **Centralization Vulnerability:** Dictates severe bottlenecks violating decentralized networking constraints. Genesis networks deploying with a blank registry state would face a chicken-and-egg connection deadlock.

---

## 3. Proposed Solution: Implicit Signature Derivation (Cryptographic Truth)

Instead of trusting arbitrary object parameters or reaching out to external oracle tracking variables, we adopt absolute localized mathematical authority. We physically delete the `walletAddress` variable from all networking protocols and handshake schemas. 

1. Both parties dispatch their transient `ephemeralPublicKey` alongside their core EIP-191 `signature`. 
2. Upon receipt of the `EphemeralExchangeMessage`, the parsing node executes a generalized recovery extraction: `const recoveredEVMAddress = ethers.verifyMessage(parsedEphemeralKey, parsedSignature)`.
3. The system maps the socket to this recovered variable sequence mapping it as `connection.remoteCredentials_.walletAddress = recoveredEVMAddress`. 

Because it is computationally unfeasible to generate a valid signature for a public key without holding the correlating EVM private key, the `recoveredEVMAddress` constitutes absolute, irrefutable identity.

### Comparative Analysis & Conclusion

While **Alternative A** appeals to legacy parsing mechanisms, retaining arbitrary self-declared identity fields preserves bad architectural habits and opens the door for future developers to mistakenly trust unverified fields. **Alternative B** creates a networking deadlock abandoning the core philosophy of decoupled peer routing limits.

**Implicit Signature Derivation** is the definitive framework. By forcing the `Client.js` connection arrays to adopt the exact `recoveredEVMAddress` without looking for JSON declarations, the socket encapsulates the identity. This eliminates spoofing vectors at a structural level since nodes cannot claim an identity they cannot cryptographically enforce.
