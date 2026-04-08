# Project Bandana: Milestone 1 - Cryptographic Schema & Escrow Design

## 1. Background

Currently, Verimus storage contracts coordinate data size, physical hosts, and egress escrow. However, they lack defined bounds for storage duration. Originators cannot specify how long files should be stored, and storage providers are expected to host payloads perpetually without base compensation. This creates economic instability and undermines the reliability of the protocol, as hosts are likely to prune uncompensated data unpredictably to reclaim physical capacity.

Milestone 1 introduces chronological leasing. The protocol must map a defined expiration parameter into the EIP-712 contract schema and overhaul `WalletManager` to process the base storage compensation (`allocatedRestToll`).

---

## 2. Initial Proposed Approach: Unix Epoch Timestamp Escrows

The initial approach is to define an explicit `expirationTimestamp` (Unix epoch time) alongside `allocatedRestToll` within the `StorageContractPayload`. The `WalletManager` will validate the time passed relative to the Unix timestamp and deduct the toll linearly over the duration.

### Pros

- **User Comprehension**: End-users understand clock time (e.g., "Expires in 30 days"). It maps directly to UI representations.
- **Predictability**: Providers can calculate exact capacity timelines in standard time units.

### Cons

- **Clock Drift**: Decentralized peer networks suffer from local clock drift. Consensus nodes may disagree on whether an exact Unix timestamp has passed, potentially causing timeline forks.
- **Deduction Overhead**: Continuous or tick-based linear deductions in `WalletManager` based on time elapsed introduce high processing overhead on the consensus engine state.

---

## 3. Alternative Approach 1: Epoch / Block Height Expiration

Instead of a Unix timestamp, the contract expiration is tied to the Verimus ledger's absolute block index or epoch count (e.g., `expirationBlockHeight: 154000`). `WalletManager` divides `allocatedRestToll` uniformly across the block delta, transferring funds exactly once per block interval instead of relying on continuously shifting local computer clocks.

### Pros

- **Absolute Determinism**: Block height is a universal truth shared across all consensus nodes. There is zero possibility for clock drift disagreements.
- **Simplified Economics**: Math in the `WalletManager` becomes static (`allocatedRestToll` / `blockDuration` = cost per block).

### Cons

- **Duration Fluctuations**: If block minting times slow down or speed up during network congestion, the literal real-world time the file remains stored will fluctuate. A target of 30 days might conclude in 28 or 35 days.

---

## 4. Alternative Approach 2: State-Channel Micropayments (Subscription Model)

Instead of upfront full-escrow locking (`allocatedRestToll`), the originator opens a continuous state channel that pipes micro-payments per GB per Hour directly to the active hosts. The contract lacks a hard expiration limit; expiration occurs organically when the channel exhausts its funds.

### Pros

- **Elasticity**: Users can extend or terminate storage at arbitrary times simply by adding or removing funds from the channel.
- **Zero Lock-in**: Users are not forced to lock massive capital sums upfront for long-term storage arrays.

### Cons

- **High Complexity**: Tracking off-chain state channel micro-transactions introduces extreme overhead to the P2P networking layer.
- **Capacity Guesswork**: Storage providers cannot accurately forecast storage quotas because clients can terminate the supply of tokens at any second with zero warning.

---

## 5. Comparative Analysis & Final Decision

While **Unix Epoch Timestamps** offer the best user experience, enforcing them at the consensus layer creates severe vulnerabilities to clock drift and timeline forks. **State-Channel Micropayments** solve the upfront capital problem but break capacity forecasting for providers and introduce massive technical complexity to the P2P layer.

**Final Decision: Adopt Epoch / Block Height Expiration (Alternative 1).**

Industry-standard decentralized protocols (such as Filecoin) utilize epoch-based bounding to avoid timing disputes. Absolute determinism at the consensus layer must supersede perfect real-world clock mapping. We mitigate the "Duration Fluctuation" con by calculating a baseline average block duration (e.g. 5 seconds) and providing a UX layer on the frontend that estimates the target block height for the user (e.g., "30 Days ≈ 518,400 Blocks").

---

## 6. Revised Target Deliverables

1. **Schema Update**: Update `StorageContractPayload` in `types/index.d.ts` and `EIP712Types.ts` with `expirationBlockHeight` (integer) and `allocatedRestToll`.
2. **WalletManager Ledger Epoch Hook**: Update `WalletManager.ts` to divide the `allocatedRestToll` evenly across the target block delta and disperse funds to the hosting node upon sequential ledger block commitments.
3. **Storage Pricing Constant**: Introduce a verified network constant `avgBlockTimeMs` used by the upload UI to synthesize real-world time targets into strict `expirationBlockHeight` coordinates.
