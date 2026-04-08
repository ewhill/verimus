# Summit Milestone 4 Design: Upstream Architecture Refactor

## 1. Background

With the foundation of the transport layer locked into implicit EVM identity extraction (Milestones 1-3), the resulting P2P `connection.remoteCredentials_` object no longer manages or provides legacy RSA Public Keys (`rsaKeyPair`). However, the broader Verimus consensus subsystems (`ReputationManager`, `SyncEngine`, `BftCoordinator`) historically identify and penalize connected peers by parsing this exact deprecated RSA public key. If the system boots without upgrading these components, any penalization event or state transition map relying on the old `pubKey` interface will crash tracking `undefined` objects. The architecture must standardize identity ingestion across all downstream subsystems.

---

## 2. Alternatives Considered

### Alternative A: Proxy Identity Shim (Legacy Emulation)

To reduce code fragmentation inside dense consensus components, a middleware proxy hook intercepts events emitted from `PeerNode.ts`. Whenever an upstream component expects to parse the legacy `remoteCredentials_.rsaKeyPair?.public` property, the proxy generates a deterministically hashed "mock RSA string" derived from the verified `walletAddress`.

**Pros:**

- **Refactor Mitigation:** Reduces required file modifications because existing subsystems continue processing legacy string structures without crashing.
- **Immediate Test Compliance:** Integration tests built prioritizing string sizes or RSA regex patterns pass without rewriting block configurations.

**Cons:**

- **Dangerous Technical Debt:** Emulating deprecated cryptographic frameworks masks the true underlying architecture, tricking future developers into trusting an illusion.
- **Database Bloat:** The `peerCollection` within MongoDB continues tracking fake RSA string properties instead of authentic EVM wallet indexes.

### Alternative B: Connection UUID Tracking (Abstracted Peer IDs)

Instead of forcing the `ReputationManager` to ingest the cryptographic EVM wallet address, the transport layer assigns an ephemeral Random UUID string (e.g., `libp2p` PeerId) to every inbound connection stream. The subsystems ban and track operations against this abstract `UUID`, while `PeerNode.ts` maintains a mapping dictionary pointing UUIDs back to their physical `walletAddress`.

**Pros:**

- **Standard Protocol Architecture:** Mirrors frameworks like IPFS where connection identifiers decouple from physical consensus identifiers.
- **Socket Isolation:** Permits a single physical wallet to maintain multiple distinct routing socket connections without cross-pollinating memory pointers.

**Cons:**

- **Map Overengineering:** Requires building complex state-machine mapping dictionaries mapping session UUIDs to ledger blocks whenever the consensus engines evaluate penalties.
- **State Fragmentation:** Banning a session UUID requires cascading loop triggers to locate the correlating EVM wallet and ban all related cross-session UUID boundaries.

---

## 3. Proposed Solution: Direct EVM Address Unification

Instead of insulating the consensus engines with proxies or state dictionaries, we rewrite the overarching engine Maps, arrays, and MongoDB collections to consume the 42-character `walletAddress` as the primary key.

1. Update the `ReputationManager` signature limits from parsing 400-character RSA PEM inputs down to processing standard Ethereum hex patterns (`0x...`).
2. Adjust `BftCoordinator.ts` routing to track pending blocks and block proposals against the peer `walletAddress` connecting the socket.
3. Modify `PeerNode.ts` ban event listeners to emit `SLASHING_TRANSACTION` payloads utilizing the `walletAddress` parameters.

By propagating the EVM identities established in Milestone 3 straight up into the overarching application routing bounds, we complete the network unification.

### Comparative Analysis & Conclusion

While **Alternative A** mitigates integration timelines by injecting emulated strings, retaining mock RSA architectures guarantees domain confusion down the road. **Alternative B** creates a complex ephemeral mapping state-machine, delaying processing variables inside high-performance consensus blocks.

**Direct EVM Address Unification** completes the core mandate outlined in the Summit roadmap. Transforming the subsystems to track, map, and ban EVM variables simplifies MongoDB indexing routines and closes structural gaps. Slashing transactions map to identical peer ban hooks because both layers speak the exact identity language.
