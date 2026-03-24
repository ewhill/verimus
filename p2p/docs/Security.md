# P2P Network Security Model

The Verimus P2P library executes isolated handshake methodologies guaranteeing explicit PKI endpoints and symmetrical end-to-end encryption.

### Identity Architecture
- Each active participant defines their connection via `RSA-2048`. The network mandates deriving public identifiers matching exact wallet schemas.
- Connecting hosts generate independent `RSAKeyPair` instances, proving node ownership across signatures.

### Payload Authentication & AEAD Encryptors
- Inbound and Outbound payload bodies are converted to a `Buffer` utilizing `aes-256-gcm` authenticated algorithms.
- Using dynamic initialization vectors (IVs) and symmetric keys transacted over socket endpoints, external observers cannot decipher logical frames.
- GCM calculates an `authTag` integrated via the `Message` framework properties protecting the data against tampering and padding-oracle attacks.

### Sybil Defense & Reputation Mechanics
- Handshake validations require the node signing messages using its unique private RSA credentials. In tandem with global application bindings, nodes misbehaving during protocol exchanges or repeating duplicate payloads endlessly receive reputation penalties resulting in `disconnect()` commands upon dipping underneath trust thresholds.
