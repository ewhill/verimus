# P2P Network Security Model

The Verimus P2P library executes isolated handshake methodologies guaranteeing explicit PKI endpoints and symmetrical end-to-end encryption.

### Identity Architecture
- Each active participant defines their connection via `RSA-2048`. The network mandates deriving public identifiers matching exact wallet schemas.
- Connecting hosts generate independent `RSAKeyPair` instances, proving node ownership across signatures.

### Payload Authentication & AEAD Encryptors
- Inbound and Outbound payload bodies are converted to a `Buffer` utilizing `aes-256-gcm` authenticated algorithms.
- Using dynamic initialization vectors (IVs) and symmetric keys transacted over socket endpoints, external observers cannot decipher logical frames.
- GCM calculates an `authTag` integrated via the `Message` framework properties protecting the data against tampering and padding-oracle attacks.

### Sybil Defense & Hashcash Mechanics
- **Identity Pinning**: Sockets actively implement `expectedSignature` mapping to defeat localized MITM spoofing. Unknown intermediaries lacking corresponding RSA Private Keys are explicitly severed.
- **Proof of Work (PoW)**: Peer exchanges compute localized 5-minute Hashcash Nonces natively bounding computation limits. Replay attacks are mitigated structurally utilizing windowing matrices restricting stale hash cascades.
- **Timestamp Drift Protection**: Replayed messages manifesting 5-minute external drift anomalies are dropped automatically bypassing signature computations.

### Robust Execution Bounds
- **Prototype Pollution Shielding**: Outward TCP interfaces block Remote Code Execution directly denying implicit object iteration vectors like `__proto__` and `constructor` mapping.
- **Safe Evaluation Streams**: Network deserialization streams wrap execution handlers defensively mitigating event-loop synchronous crashes induced via malformed JSON injections.
- **Memory Maps**: Disconnected WebSocket execution frames implicitly sever themselves from memory clusters closing node interval leaks resolving long-term V8 server stability routines.
