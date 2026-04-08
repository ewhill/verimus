# Milestone 1 Task Breakdown: Secp256k1 Core Cryptography

**Objective:** Implement the core Elliptic-Curve Diffie-Hellman (ECDH) logic within the generalized cryptography utilities, proving functionality independently from the P2P connection logic (which will be overhauled in Milestone 2).

## Core Components Modified

- `crypto_utils/CryptoUtils.ts`
- `crypto_utils/test/CryptoUtils.test.ts`

---

## Tasks

### Task 1: Generate Ephemeral Session Key Utilities

**Context:** To guarantee Perfect Forward Secrecy (PFS), the network relies on short-lived secp256k1 keys.
**File:** `crypto_utils/CryptoUtils.ts`
**Action:**

1. Implement and export `generateEphemeralSession()`. This should simply execute and return `ethers.Wallet.createRandom()`.
2. Implement and export `signEphemeralPayload(ephemeralPublicKey: string, persistentEvmPrivateKey: string)`. This establishes our EIP-191 ownership proof by structuring `new ethers.Wallet(persistentEvmPrivateKey).signMessage(ephemeralPublicKey)`.

### Task 2: Implement Native ECDH Shared Secret Derivation

**Context:** We must derive a symmetrical 32-byte AES key deterministically between two opposing ephemeral wallets using pure `ethers` math.
**File:** `crypto_utils/CryptoUtils.ts`
**Action:**

1. Implement and export `computeSessionSecret(localEphemeralPrivateKey: string, remoteEphemeralPublicKey: string): Buffer`.
2. Internally, utilize the `ethers.SigningKey.computeSharedSecret(localEphemeralPrivateKey, remoteEphemeralPublicKey)` function.
3. Because `computeSharedSecret` returns a raw coordinate hex string, you must pipe that resulting hex string through Node's `crypto.createHash('sha256').update(sharedSecret).digest()`.
4. Return the resulting 32-Byte buffer (This acts as the symmetric session key for AES-GCM).

### Task 3: Expose Standard Symmetrical Cipher Utilities

**Context:** We need clean generic wrappers mapping AES-GCM encryption natively to be injected into `Client.js` eventually in Milestone 2.
**File:** `crypto_utils/CryptoUtils.ts`
**Action:**

1. Implement `encryptSessionPayload(plainTextBuffer: Buffer, sessionKeyBuffer: Buffer)` returning an object containing `{ encryptedBuffer: Buffer, iv: Buffer, authTag: Buffer }`.
2. Implement `decryptSessionPayload(encryptedBuffer: Buffer, sessionKeyBuffer: Buffer, iv: Buffer, authTag: Buffer)`.
3. Use `crypto.createCipheriv('aes-256-gcm', sessionKeyBuffer, iv)` under the hood asserting strict AEAD integrity bounding.

### Task 4: Construct ECIES ECDH Unit Testing

**Context:** Milestone 1 officially concludes when these primitives are heavily stressed and verified securely in isolation.
**File:** `crypto_utils/test/CryptoUtils.test.ts`
**Action:**

1. Write an integration block simulating an end-to-end "Alice to Bob" ECDH execution.
2. Instantiate two static `ethers.Wallet` accounts representing Alice and Bob entirely.
3. Validate `signEphemeralPayload` securely verifies via `ethers.verifyMessage`.
4. Validate both Alice and Bob compute the exact same 32-byte hash buffer via `computeSessionSecret` simultaneously.
5. Validate `encryptSessionPayload` securely encapsulates a mock string from Alice natively executing `decryptSessionPayload` flawlessly by Bob yielding the original string cleanly.
