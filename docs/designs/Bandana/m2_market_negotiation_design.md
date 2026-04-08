# Project Bandana: Milestone 2 - Market Negotiation & Storage Quota Design

## 1. Background

In Milestone 1, the Verimus protocol was successfully upgraded to map `expirationBlockHeight` and `allocatedRestToll` chronologically over the wallet ledger. The cryptographic schema is now fully aware of chronological token escrows, allowing nodes to receive block-by-block disbursements.

However, the peer-to-peer origination logic remains unaware of these bounds. When a user uploads a file through `UploadHandler.ts`, the system calculates limits based strictly on fixed, arbitrary upfront values without evaluating chronological variables like `targetDurationHours`. Consequently, when the `SyncEngine` negotiates with fragmented peers across the network to host data, those peers accept the shards without formal validation of whether the escrow attached sufficiently covers their physical storage allocation over time. We need a robust market strategy that aligns originators specifying a storage duration with hosts enforcing independent pricing thresholds.

---

## 2. Initial Proposed Approach: Originator Pre-computation & Host Validation

In this approach, the Originator explicitly computes the chronological toll before broadcasting the storage request.

1. The uploading client supplies a `targetDurationHours` attribute in their `/api/contracts/upload` POST.
2. The `UploadHandler` approximates the chronological duration into blocks using `AVERAGE_BLOCK_TIME_MS` and calculates a single fixed total `allocatedRestToll` leveraging the node operator's pre-configured global `restCostPerGBHour`.
3. The `WalletManager` freezes these upfront `allocatedRestToll` escrows from the user's balances.
4. The requested duration and allocated `restToll` parameters are blanketly transmitted in the network request broadcast.
5. Receiving hosts validate the broadcasted `restToll` parameter against their independent configuration settings. If the proposed toll falls below their minimum `restCostPerGBHour`, they immediately drop the request and refuse to broadcast an acceptance.

### Pros

- **Decoupled Architecture**: Highly performant. The originator node only executes a single network broadcast expecting passive validations instead of complex two-way bid aggregations.
- **Fail-Fast**: Target hosts perform the mathematical validation locally without returning garbage data to the network.
- **Simplicity**: Ties perfectly into the existing `verifyFunds` and `freezeFunds` methods as the exact cost is definitively estimated prior to execution limits.

### Cons

- **Static Market Fragmentation**: The originator essentially "guesses" the network cost using their own `restCostPerGBHour` metric. If the originator's configuration is lower than the network average, they will universally fail to secure quorum hosts without iterative attempts.
- **Lost Arbitrage**: Hosts willing to store files for *less* than the originator's estimate still receive the higher payout rather than operating an efficient under-bid.

---

## 3. Alternative Approach 1: Target-Agnostic Dynamic Quoting (Bidding Pool)

Instead of the originator pre-computing the exact escrow bounds, the originator broadcasts a passive "Request for Quotation" detailing only the file size and `targetDurationHours`.

1. The broadcasting node leaves the `allocatedRestToll` field empty.
2. Target hosts calculate their specific quote securely factoring their available disk space and `restCostPerGBHour` configuration.
3. Hosts respond to the originator with their proposed custom quote.
4. The originator's `SyncEngine` pools the incoming responses, selects the lowest `N` (redundancy) bids, dynamically sums up the combined custom quotes, and locks *that* precise amount into the `WalletManager` as the final `allocatedRestToll`.

### Pros

- **True Free Market**: Nodes compete organically, creating efficient market equilibrium. The originator leverages cost savings by physically filtering the most aggressive, cheapest nodes on the network mathematically.
- **No Guesswork**: Originator nodes don't need a perfectly calibrated universal `1GB/Hour` heuristic; the network resolves the metric individually.

### Cons

- **Asynchronous Escrow Race Conditions**: Because `WalletManager` limits cannot be strictly frozen *before* the quotes are gathered, a user could drain their ledger balance in the milliseconds between the quote acquisition and the final contract signing sequence.
- **Variable Node Compensation**: The exact disbursement tracking (`WalletManager.processEpochTick`) deployed in Milestone 1 expects symmetrical fractional disbursements mathematically mapping standard payouts. If nodes negotiate uniquely unequal `allocatedRestToll` fractions, the internal validation boundaries become exponentially harder to verify without per-node metadata tracking tracking disparate rates.

---

## 4. Alternative Approach 2: Interactive Smart-Tier Contracts

Nodes classify themselves into rigid tier models ("Archive Node" at 10 wei/epoch vs "Performant Node" at 50 wei/epoch).

1. The originator specifically broadcasts target demands requesting exclusively a distinct tier model.
2. The network bypasses dynamic calculations and universally expects the designated exact mapping.

### Pros

- Extremely fast network consensus. Nodes don't run math on the fly matching precise decimals to durations.

### Cons

- Restricts free market competition completely. Overly engineering for a simplified node architecture. Requires an arbitrary consensus to define distinct network "tiers" universally.

---

## 5. Comparative Analysis & Final Decision

**Approach 2 (Tiered Models)** limits the flexibility of what constitutes physical node topologies while failing to account for chronological durations cleanly. It solves a different problem entirely.

**Alternative 1 (Dynamic Quoting)** is theoretically the ideal execution path for an ultimate decentralized file storage marketplace. However, allowing hosts to unilaterally bid asymmetric prices per storage contract violates the mathematical disbursement symmetry mapped in our existing `processEpochTick` logic (which calculates an exact uniform fractional payout shared symmetrically between all active fragments). Reconstructing the schema to track disparate fractional payouts per individual Node ID would mandate massive refactoring inside `WalletManager` adding significant payload bulk to ledger storage nodes. The asynchronous race conditions impacting `WalletManager` locking thresholds alone would introduce significant system risks.

**The Initial Proposed Approach (Originator Pre-computation & Host Validation)** seamlessly pairs with the existing infrastructure. While it potentially results in slower market alignment if originators severely misconfigure their prices, it preserves the critical requirement of symmetrically scaling exact escrows across an agnostic shard pool without complex state tracking.

**Decision: Proceed with the Initial Proposed Approach (Originator Pre-computation).**

The originator will dictate the baseline price using their config `restCostPerGBHour`. The calculation will cleanly lock into `WalletManager.freezeFunds()`, and targeted storage peers will simply perform passive validation of those bounds (HTTP 422 behavior equivalent over the WebSocket if insufficient) prior to sending back contract approval payloads.
