# Summit Milestone 2 Design: P2P Socket Encryption Overhaul

## 1. Background

With the native `secp256k1` ECDH primitives established inside `CryptoUtils.ts` (Milestone 1), the immediate subsequent challenge mandates overhauling the localized `p2p/lib` transport architecture to consume these functions. Historically, the `Client.js` connection upgrade lifecycle involved a highly coupled RSA exchange sequence: nodes broadcast their RSA public keys via `HelloMessage`, generating transient AES keys locally and nesting them inside a `SetupCipherMessage` encrypted asynchronously via the remote peer's RSA payload. This framework preserves enormous technical debt and necessitates eliminating all RSA generation schemas from `Peer.js` and `Client.js`, replacing the connection framework with a robust, native ECDH pipeline.

---

## 2. Alternatives Considered

### Alternative A: Transport Layer TLS Handshake Injection

Instead of processing payloads at the JavaScript WebSocket encapsulation layer (`Client.js`), we inject the node's `evmPrivateKey` straight down into NodeJS' core OpenSSL `/ TLS` configuration mapping. This forces native `wss://` sockets to validate `secp256k1` certificates implicitly underneath the application layer.
**Pros:**

- **Execution Speed:** Offloads encryption operations to the heavily optimized system operating OS boundaries.
- **Layer Simplification:** Entirely negates the need for custom AES-GCM wrapping within Node.js arrays.
**Cons:**
- **Environmental Volatility:** Overriding default Node.js TLS constraints to accept custom `ethers.Wallet` elliptic-curve certificates frequently triggers cross-platform regressions (Windows vs Linux OpenSSL bindings).
- **Socket Blindness:** Eradicating encryption boundaries beneath `Client.js` hinders application-level debugging and custom timeout orchestrations inherently required for consensus logic tracking.

### Alternative B: Zero-Round-Trip (0-RTT) Discovery Ephemeral Mapping

Modify the network discovery components to share the static `EVM Public Keys` dynamically across the DHT or configuration files prior to direct handshakes. The connecting node immediately derives the shared secret by acting against the remote node's static key prior to connection, immediately beaming encrypted traffic bounds upon `onOpen`.
**Pros:**

- **Hyperspeed Handshake:** Slices latency by encrypting the initial routing requests explicitly out-of-the-gate without pre-exchange overhead.
**Cons:**
- **Lost Forward Secrecy:** Since the remote key is static, the connection lacks true interactive ephemeral security bounds.
- **Discovery Bottleneck:** Bootstrap nodes parsing inbound connections without knowing the connecting physical EVM public key would lack the mathematical parameters to derive the matching decryption matrix gracefully.

---

## 3. Proposed Solution: Concurrent Interactive Ephemeral Exchange (Simplified XX Pattern)

Instead of risking OpenSSL structural injection or forcing static boundaries across discovery protocols, the optimal solution refactors the `Client.js` standard upgrade boundaries gracefully. We deprecate both `HelloMessage` and `SetupCipherMessage`, consolidating them into a singular concise schema: **`EphemeralExchangeMessage`**.

1. Immediately upon establishing a raw `WebSocket` connection, both nodes generate a transient ephemeral session via `CryptoUtils` and sign the generated temporary public key mapping with their core `ethers.Wallet`.
2. Both extremities dispatch this signature alongside the ephemeral public key inside the unencrypted `EphemeralExchangeMessage`.
3. Parallel execution guarantees both sides digest the remote parameters roughly concurrently. The receiving `Client.js` invokes `ethers.verifyMessage` determining EVM ownership.
4. The verified parameters are piped into `CryptoUtils.computeSessionSecret(localEphemeralPrivateKey, remoteEphemeralPublicKey)` to deterministically resolve the 32-Byte localized AES-GCM key physically.
5. The `upgradePromise_` naturally resolves bounds, mapping all future WebSockets payloads sequentially into standard symmetrical buffers.

### Comparative Analysis & Conclusion

**Alternative A** dictates substantial hardware constraint modifications mapping outside the scope of JavaScript boundary limits, presenting an extreme deployment risk. **Alternative B** shatters Perfect Forward Secrecy while dramatically compounding genesis discovery tracking dependencies.

The **Concurrent Interactive Ephemeral Exchange** approach aligns with the ECDH primitives designed in Milestone 1. It distills two redundant RSA payload loops down to a single symmetrical exchange sequence. By maintaining encryption capabilities directly inside the generic Node.js module logic, we retain intense observability during consensus testing metrics while finalizing the deprecated removal of RSA constructs across the local project completely.
