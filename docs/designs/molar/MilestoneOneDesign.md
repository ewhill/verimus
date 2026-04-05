# Design Document: P2P Cryptography Overhaul (Molar Milestone 1)

## Background & Problem Statement
The Molar roadmap dictates that Verimus transitions strictly to Ethereum-standard (secp256k1) representations to accomplish full MetaMask integration. Currently, the P2P transport layer (`p2p/lib/*`) natively generates and binds Node IDs via 4096-bit RSA keys. `RSAKeyPair.js` heavily utilizes Node native `crypto.publicEncrypt` and `crypto.privateDecrypt` for securing initial peer handshakes and network payloads before tunneling.

The incoming roadmap proposed unifying these keys entirely—forcing the P2P transport to exclusively use the Node's single `secp256k1` Web3 identity for both top-level ledger economy tracking and low-level network transport encryption.

## Alternative Approaches Considered

As we dive into cryptographic execution, we must evaluate exactly how to map Elliptic Curves (secp256k1) directly into the Node `crypto` ecosystem alongside the current P2P transport logic.

### Alternative 1: Bridging native secp256k1 via ECIES (Elliptic Curve Integrated Encryption Scheme)
Because elliptic curves cannot natively "encrypt" generalized payloads in the direct mathematical manner that RSA's `publicEncrypt` allows, we must bolt on ECIES to replace the legacy `encrypt`/`decrypt` routes inside `p2p/lib/*`. This strategy requires us to mathematically generate ephemeral keys, execute strict Elliptic-Curve Diffie-Hellman (ECDH) against the inbound node's public key, parse a derived symmetric AES key, and natively wrap and decrypt the payload arrays.

**Pros:**
- Strictly adheres to the "Unified Key" mandate from the Molar roadmap.
- Defines a single source of cryptographic truth globally per node.

**Cons:**
- **Extreme Complexity:** ECIES abstraction is completely absent from Node's native `crypto` module. We would be forced to either import massive legacy external utility libraries or manually write raw ECDH / AES-GCM wrapping logic natively inside `Client.js` buffers.
- **Extreme Risk:** Attempting to hand-roll ECDH secret derivation and salt management within the P2P tunnel introduces catastrophic network fragmentation and zero-day vulnerabilities.

### Alternative 2: Full LibP2P 'Noise' Protocol Handshake Rewrite
Discard the custom localized encryption logic inside Verimus internally. Rewrite `p2p/lib/Client.js` and `p2p/lib/Server.js` from the ground up leveraging the standardized Noise protocol framework natively seen in IPFS/Ethereum networks to support secp256k1 transport tunneling.

**Pros:**
- Truly enterprise-grade, industry-standard networking capability.
- Resolves the P2P tunneling natively without custom ECIES glue logic.

**Cons:**
- **Catastrophic Scope Creep:** We would be functionally ripping out the *entire* custom networking infrastructure that Verimus runs on. This would derail the MetaMask wallet integration indefinitely and destroy all backward-compatible tests simply to achieve a unified Node ID.

## Proposed Solution (Pivoted)

### Maintain Decoupled P2P Transport (RSA) with Distinct Wallet Accounts (EVM)
As we rigorously weigh the mathematical realities of Elliptic Curve cryptography versus RSA mechanisms, replacing `RSAKeyPair.js` structurally inside the existing custom P2P socket boundary represents a thoroughly unreasonable engineering hazard. 

Through comparative analysis, it is overwhelmingly evident that we must **change our opinion on the proposed approach**. We must abandon the "Unified Keys" approach. 

**Defending the Pivot to Decoupled Architecture:**
1. **Mathematical Reality:** `crypto.publicEncrypt` fundamentally expects an RSA cipher context. Web3 and EVM secp256k1 parameters are explicitly engineered for digital signatures (ECDSA), not for the generalized payload encryption executed inside our P2P handshakes. 
2. **Security & Standard Isolation:** In nearly all tier-1 blockchain infrastructures, a Node's underlying physical transport identity (libp2p Ed25519) is inherently distinct mathematically from the End-User's financial wallet identity (Ethereum secp256k1). Forcing them together yields no technical advantage while drastically multiplying integration fragility.

**The Refined Directive:**
We should officially **ABANDON Milestone 1 (P2P Cryptography Overhaul)** as it was originally scoped in the Molar Roadmap. The P2P overlay must continue to naturally leverage its isolated 4096-bit RSA structures for highly secure local mesh socket transmission. 

Instead of fighting the mathematical limitations of transport bounds, we will shift focus exclusively to **Milestone 2**: updating the Ledger Data Models and `WalletManager` arrays to globally parse distinct MetaMask EVM addresses, confidently accepting the strictly Decoupled RSA (Network) / EVM (Economy) ecosystem architecture.
