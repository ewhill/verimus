# Project Bandana: Milestone 4 - Frontend UI Integration & Contract Renewals Design

## 1. Background

After completing Milestones 1-3, nodes on the Verimus network actively limit storage contract footprints based on the integer boundaries set within `expirationBlockHeight`. However, these chronological boundaries exist only in the network infrastructure. The user interface does not display these limits, rendering the system opaque.

To ensure functional transparency, the UX pipeline must expose remaining block limits and translate those block deltas into readable wall-clock periods (e.g., "Expires in 16 hours").

---

## 2. Initial Proposed Approach: Client-Side Math Projections

In this design, we maintain structural purity alongside existing cryptographic components by injecting zero tracking variables across the API layer. The UI receives the pure `expirationBlockHeight` inside the contract payload, matching the raw EIP-712 structure.

1. The frontend (`ui/src/App.jsx` or localized component) pulls the standard `/api/ledger/metrics` data to extract `currentIndex`.
2. Inside `StorageContractPayload.jsx`, the component computes `expirationBlockHeight - currentBlockIndex`.
3. Validating the difference using the hardcoded `AVERAGE_BLOCK_TIME_MS` constant, the UI renders the result (e.g., `Time Remaining: ~12 Days, 4 Hours`).

### Initial Approach Pros

- **Cryptographic Purity**: Node REST APIs returning JSON continue to represent the immutable ledger data untouched.
- **Realtime Updates**: The React UI can drain the "Estimated Time" clock on the frontend via local tracking without relying on backend server APIs.

### Initial Approach Cons

- **Dual Constants**: The frontend duplicates the knowledge of `AVERAGE_BLOCK_TIME_MS` (e.g., 5000ms), which could diverge if the backend architecture is altered.

---

## 3. Alternative Approach: Server-Side API Payload Hydration

Rather than sending pure ledger artifacts, the backend modifies the `/api/blocks` data structures by appending `virtualExpirationTimeMs` and `virtualBlocksRemaining` fields prior to transmitting the JSON payload.

1. The backend Express router calculates `(contract.payload.expiration - node.ledger.currentIndex) * AVERAGE_BLOCK_TIME_MS`.
2. The UI formats the raw strings delivered from the API.

### Alternative 1 Pros

- **Single Source of Truth**: Eliminates duplication; the backend manages the timeline calculations.

### Alternative 1 Cons

- **Hash Corruptions**: Injecting non-deterministic fields into the payload invalidates verification signatures. If frontends use standard EIP-712 SDKs to verify these blocks, the signature checks will fail.

---

## 4. Alternative Approach: WebSockets Streaming

Establish a full-duplex socket transferring state metrics.

1. The backend streams countdown updates every 5000ms incrementally.

### Alternative 2 Pros

- Visually engaging realtime streaming.

### Alternative 2 Cons

- Over-engineered. Submitting thousands of socket frames to track static limits that are mathematically solvable on the client side introduces excessive overhead.

---

## 5. Comparative Analysis & Decision

Constructing real-time WebSocket ticks is complex for minimal utility. Server-Side JSON hydration breaks the fundamental principle of immutable block payloads.

**Final Decision: Adopting the Initial Proposed Approach (Client-Side Math Projections)** resolves the challenge. We will pass the pure `expirationBlockHeight` inside the `StorageContractPayload.jsx` component and rely on state fetching to extract the `currentBlockIndex`, executing the mathematical projections on the client.
