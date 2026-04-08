# Summit Milestone 1 Design: Secp256k1 Core Cryptography

## 1. Background

The first milestone of the "Summit" roadmap demands a complete phase-out of the `RSAKeyPair` paradigm in favor of native `secp256k1` (Elliptic-Curve) cryptography for P2P networking bounds. The historical architecture relied on an incoming socket generating random AES bytes to encrypt the channel, wrapping those AES bytes within a bulky RSA asymmetric payload, and transmitting it. To adopt an industry-standard routing model tied directly to the node's EVM identity (`ethers.Wallet`), we must establish robust Elliptic-Curve Diffie-Hellman (ECDH) primitives. This enables two nodes to mathematically derive an identical shared secret symmetric cipher without transmitting the actual AES keys across the wire, permanently anchoring the transport to the `secp256k1` identities.

---

## 2. Alternatives Considered

### Alternative A: Raw Node.js `crypto.createECDH` (Static Key Exchange)

Node.js exports low-level C++ binary primitives allowing nodes to extract the 32-byte private sequence from their `ethers.Wallet` and inject it directly into `crypto.createECDH('secp256k1')`. The P2P network exchanges static public keys to compute a shared AES initialization vector.

**Pros:**

- **Execution Speed:** Bypasses JavaScript wrappers directly executing inside optimized native C++ binaries.
- **Dependency Reduction:** Leverages internal standard libraries without integrating external NPM noise payloads.

**Cons:**

- **Zero Forward Secrecy:** Because the ECDH sequence utilizes the permanent static node EVM key, the derived session key is identical across every connection. If a validator's node is compromised in the future, all historical intercepted packet streams can be retroactively decrypted.
- **Buffer Formatting:** Managing raw uncompressed `0x04` payload offsets manually via native Node `crypto` is notoriously error-prone compared to modern wrappers.

### Alternative B: External Cryptography Libraries (`elliptic` or `secp256k1` NPM bindings)

Import explicit, industry-standard NPM packages (such as `ethereum-cryptography`) dedicated exclusively to handling ECIES constructs and ECDH pipelines.

**Pros:**

- **Turnkey Operation:** Pre-packaged ECIES encryption routines prevent developers from manually orchestrating AES padding or initialization vector configurations.

**Cons:**

- **Dependency Bloat:** Adds critical external supply-chain dependencies extending the security audit footprint for primitives we should theoretically already possess.
- **Redundant Scope:** We already import robust Web3 cryptography via `ethers.js`, rendering external crypto payload parsers largely redundant architecture bloat.

---

## 3. Proposed Solution: Native `ethers.js` ECDH with Ephemeral Session Bounds (PFS)

Instead of relying on rigid, raw C++ buffers or importing bloated external dependencies, we utilize the native curve utilities already maintained natively within our core dependency, `ethers.js`.

To prevent the catastrophic lack of Perfect Forward Secrecy (PFS) present in static exchanges, our primitive will implement an **Ephemeral ECDH Keypad**.

1. Upon connection initiation, the `CryptoUtils` pipeline generates a random, transient `ethers.Wallet.createRandom()` session key.
2. The core persistent EVM node identity (`ethers.Wallet`) statically signs the transient session's public key (proving ownership of the connection).
3. We execute `ethers.SigningKey.computeSharedSecret(transientPrivateKey, remoteTransientPublicKey)`.
4. We hash the resulting 64-byte coordinate through `crypto.createHash('sha256')` to isolate an identical 32-byte symmetric AES-GCM session token on both sides.

### Comparative Analysis & Conclusion

While **Alternative A** offers raw binary speed, it fails basic modern cryptographic security boundaries by neglecting Perfect Forward Secrecy (PFS), leaving our architecture vulnerable to retroactive interception. **Alternative B** enforces PFS but requires installing external ECIES dependencies, heavily increasing repository payload sizes.

The **Native `ethers.js` Ephemeral ECDH** approach is vastly superior. By establishing short-lived, transient secp256k1 keys per connection and extracting the shared secret natively via `ethers`, we gain military-grade Forward Secrecy without sacrificing performance or adding a single external NPM boundary package. Once the connection closes, the transient wallet drops out of memory, destroying the decryption capability forever while the initial digital signature continues to definitively prove EVM node identity compliance.
