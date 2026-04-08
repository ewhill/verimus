# Milestone 2 Task Breakdown: P2P Socket Encryption Overhaul

**Objective:** Implement the "Concurrent Interactive Ephemeral Exchange" replacing the legacy RSA sequential payload hooks (`HelloMessage` and `SetupCipherMessage`) within the `Client.js` boundaries. This implements the ECIES framework over WebSocket streams utilizing the primitives developed in Milestone 1.

## Core Components Modified

- `p2p/lib/messages/EphemeralExchangeMessage.js` (Create)
- `p2p/lib/messages/HelloMessage.js` (Delete/Deprecate)
- `p2p/lib/messages/SetupCipherMessage.js` (Delete/Deprecate)
- `p2p/lib/Client.js`
- `p2p/lib/Peer.js`
- `peer_node/PeerNode.ts`
- `p2p/test/Client.test.js`

---

## Tasks

### Task 1: Create `EphemeralExchangeMessage` Definition

**Context:** We need a unified message wrapper to exchange the minted `ethers` transient public keys alongside their EIP-191 ownership proof.
**File:** `p2p/lib/messages/EphemeralExchangeMessage.js`
**Action:**

1. Create a class extending the base `Message.js` primitive.
2. Ensure the constructor accepts and parses `ephemeralPublicKey`, `signature`, and `walletAddress`.
3. Provide rigorous getter and setter structures validating payload boundaries.

### Task 2: Purge Legacy RSA Configuration Boundaries

**Context:** Stop the P2P transport node constructors from maintaining or importing `.pem` file streams or generating localized `RSAKeyPair` components.
**Files:** `p2p/lib/Peer.js`, `peer_node/PeerNode.ts`
**Action:**

1. Open `PeerNode.ts` and eliminate the deprecated `keyPaths.privateKey` and `crypto.createPublicKey` RSA hooks.
2. In `Peer.js`, remove `peerRSAKeyPair_` initialization. Update the `credentials` object mapping passed to `Client.js` to contain the localized `evmPrivateKey` (or `ethers.Wallet` instance) alongside the derived `walletAddress`.

### Task 3: Refactor `Client.js` Upgrade Lifecycle

**Context:** Strip the staggered asynchronous sequential pipeline out of the connection upgrade cycle without shattering existing timeout bounds.
**File:** `p2p/lib/Client.js`
**Action:**

1. Delete the `sendHeloPromise_`, `receiveHeloPromise_`, `sendSetupCipherPromise_`, and `receiveSetupCipherPromise_` pipelines.
2. Construct a distinct `ephemeralExchangePromise`. Upon initialization, generate a localized ephemeral session via `CryptoUtils.generateEphemeralSession()`, sign it via the injected `credentials.evmPrivateKey`, and transmit the new `EphemeralExchangeMessage`.
3. Refactor `upgrade()` to await this singular `ephemeralExchangePromise` wrapping traditional timeout bounds.

### Task 4: Implement Handshake Verification & Session Storage

**Context:** Intercept the remote side's incoming ephemeral exchange guaranteeing the AES symmetrical cipher is loaded into the decipher wrappers.
**File:** `p2p/lib/Client.js`
**Action:**

1. Construct the `ephemeralExchangeHandler(message, connection)`.
2. Extract the remote `ephemeralPublicKey` and `signature`. Verify `ethers.verifyMessage(ephemeralPublicKey, signature)` resolves identically to the transmitted `walletAddress`. Drop and close the connection upon verification mismatch.
3. Execute `CryptoUtils.computeSessionSecret(localEphemeralPrivateKey, remoteEphemeralPublicKey)`.
4. Store the resulting 32-Byte localized AES buffer as `this.cipher_.key`, terminating the handshake lifecycle.
5. **Teardown Protocol:** Execute `delete this.ephemeralWallet_` to unassign the transient private key from memory, guaranteeing Perfect Forward Secrecy.

### Task 5: P2P Socket Testing Integration Migration

**Context:** Existing integration tests rely on pseudo-RSA setups masking standard unit isolation execution runs.
**File:** `p2p/test/*` (specifically `Client.test.js` or equivalent WebSocket mocks)
**Action:**

1. Refactor test bootstrap structures swapping transient `RSAKeyPair` dependencies with mock `ethers.Wallet.createRandom()` assignments.
2. Execute the overarching handshake unit test ensuring `EphemeralExchangeMessage` payloads pass across local dummy WebSockets outputting the correct matching AES ciphers.
