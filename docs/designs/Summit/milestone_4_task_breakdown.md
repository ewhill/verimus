# Milestone 4 Task Breakdown: Upstream Architecture Refactor

**Objective:** Implement "Direct EVM Address Unification." By executing this refactor, all core upstream systems (Reputation, Consensus, Synchronization) will abandon legacy RSA property parsing and universally process connections using the standard `walletAddress` hex sequence established locally by the underlying ECDH socket wrappers.

## Core Components Modified

- `peer_node/PeerNode.ts`
- `peer_handlers/reputation_manager/ReputationManager.ts`
- `peer_handlers/bft_coordinator/BftCoordinator.ts`
- `test/integration/ReputationSystem.test.ts`

---

## Tasks

### Task 1: Refactor PeerNode Component Event Mapping

**Context:** `PeerNode.ts` bridges the gap between consensus faults and literal socket disconnection loops. It currently searches for socket bounds using RSA text strings.
**File:** `peer_node/PeerNode.ts`
**Action:**

1. Locate the `this.reputationManager.on('banned', ...)` event listener mapping.
2. Rename the abstract variable parameter `pubKey` to `walletAddress`.
3. Modify the disconnection tracking loop (`this.peer.peers.find`) to identify the dropped peer targeting `p.remoteCredentials_?.walletAddress` instead of `rsaKeyPair?.public`.
4. Validate the autonomous `SLASHING_TRANSACTION` execution utilizes the `walletAddress` string without execution errors.

### Task 2: ReputationManager MongoDB Ban Schema Update

**Context:** When a socket spams the node, `ReputationManager` assigns the penalty inside MongoDB tracking the identity.
**File:** `peer_handlers/reputation_manager/ReputationManager.ts`
**Action:**

1. Locate the `banPeer(peerIdentifier)` and `isBanned(peerIdentifier)` parameter blocks.
2. Change the tracking schemas substituting variables referencing `publicKey` to use `walletAddress`.
3. Ensure the `peersCollection.updateOne()` schemas mapping the fault query the physical MongoDB documents using EVM address validation lengths rather than RSA buffers.

### Task 3: BftCoordinator Routing Injection

**Context:** `BftCoordinator` determines which block proposals map to which nodes during pending fork loops.
**File:** `peer_handlers/bft_coordinator/BftCoordinator.ts`
**Action:**

1. Review the connection mapping logic evaluating inbound `handleBlock` and `handleProposeFork` execution commands.
2. Ensure any property tracing the origin socket boundary isolates `connection.remoteCredentials_?.walletAddress`.
3. Eradicate any legacy fail-safes parsing RSA structures or connection arrays attempting to recover deprecated objects.

### Task 4: Integration Test Suite Alignment

**Context:** Upstream integration pipelines mock the connection schemas utilizing RSA logic. Transitioning the core maps to track EVM elements breaks the mock test structures.
**Files:** `test/integration/ReputationSystem.test.ts`, `test/integration/SlashingAndStaking.test.ts`
**Action:**

1. Open the mock reputation assignment configurations simulating invalid P2P socket loops.
2. Replace mock RSA peer configurations injecting standard Ethereum hex patterns (`0x...`).
3. Assert that when the test triggers `banPeer`, the test accurately isolates and drops the connection mapping against the `ethers.Wallet.address` parameter.
