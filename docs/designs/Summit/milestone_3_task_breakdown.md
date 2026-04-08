# Milestone 3 Task Breakdown: Deterministic Identity Extraction

**Objective:** Implement "Implicit Signature Derivation" to scrub explicit identity declarations from the routing JSON payloads. This eliminates connection spoofing by forcing the client to extract the node's authoritative EVM EVM address mathematically from the signature execution alone.

## Core Components Modified

- `p2p/lib/messages/EphemeralExchangeMessage.js`
- `p2p/lib/Client.js`
- `p2p/test/Client.test.js`

---

## Tasks

### Task 1: Delete Explicit Payload Variable Parameters

**Context:** The exchange packet no longer requires the node to announce its identity since the signature inherently possesses that information in the mathematics.
**File:** `p2p/lib/messages/EphemeralExchangeMessage.js`
**Action:**

1. Locate the constructor function and properties blocks.
2. Delete the `walletAddress` assignment from the internal state properties.
3. Remove any getter (e.g., `get walletAddress()`) corresponding to this variable.
4. Ensure the serialized message payload exports only `ephemeralPublicKey` and `signature`.

### Task 2: Implement Implicit Remote Credential Derivation

**Context:** When the node parses the arriving socket, it must allocate the physical connection bounds to an EVM address obtained from the recovery bounds rather than from an object field.
**File:** `p2p/lib/Client.js`
**Action:**

1. Locate the incoming `ephemeralExchangeHandler` parsing loop logic tracking the remote boundary execution.
2. Delete boolean matching queries that compare recovered values to `message.walletAddress`.
3. Execute the native recovery primitive: `const recoveredEVMAddress = ethers.verifyMessage(parsedEphemeralKey, parsedSignature)`.
4. Inject the derived outcome into the socket credentials mapping: `connection.remoteCredentials_ = { walletAddress: recoveredEVMAddress }`.

### Task 3: Refactor Component Construction Parameters

**Context:** The client must stop attaching its own localized wallet string into outbound arrays during the connection upgrade lifecycle.
**File:** `p2p/lib/Client.js`
**Action:**

1. Locate the `ephemeralExchangePromise` or `upgrade` initialization blocks generating the outbound `EphemeralExchangeMessage`.
2. Delete the mapping injecting `this.credentials_.walletAddress` into the outbound message arguments. The node must rely entirely on its `signature`.

### Task 4: Unit Test Parameter Scrubbing & Negative Security Assertions
**Context:** The unit test validations must mirror the absence of JSON string assertions, proving that connections resolve based on signature derivations.
**File:** `p2p/test/Client.test.js` (and associated `messages/test` boundaries)
**Action:**
1. Scrub the `walletAddress` JSON properties from all mock instantiation structures simulating inbound transport payloads. 
2. Assert that the client processes the mock handshake mapping the simulated remote connection.
3. Validate `connection.remoteCredentials_.walletAddress` matches the mock `ethers.Wallet` source used to sign the ephemeral key testing block.
4. **Impersonation Sub-Test:** Construct a payload where a mock node transmits a corrupted EIP-191 signature. Assert the socket severs, confirming impersonation is blocked.
