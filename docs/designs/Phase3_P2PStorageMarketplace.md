# Phase 3: The P2P Storage Marketplace

## Objective
Implement the preliminary contract negotiation stage where `ORIGINATOR` nodes vie to purchase localized storage rights from `STORAGE` nodes governed by wallet funds. 

This establishes a free market economy where network latency, availability guarantees, and node storage capacity drive competitive block bids, ensuring sender funds are escrowed during negotiation to prevent double-spending vulnerabilities.

---

## 1. Request Pipelining & Market Broadcasts
Originators initializing an upload must define their storage parameters, chunk constraints, and replication limits to the network.

### `StorageRequestMessage`
A new P2P broadcast message initiated by an `ORIGINATOR`.
```typescript
export interface StorageRequestMessage extends BaseMessage {
    storageRequestId: string;    // Unique UUID for market tracking
    fileSizeBytes: number;       // The total encrypted payload weight
    chunkSizeBytes: number;      // Maximum contiguous physical chunk boundary
    requiredNodes: number;       // 'N'-node footprint required for mirroring
    maxCostPerGB: number;        // The absolute ceiling bid price the Originator accepts
    senderId: string;            // The Originator's public key identifier
    // Enforced Signature covering the Request parameters ensuring non-repudiation
}
```
**Mechanism:** 
The Originator triggers this broadcast across the `SyncEngine`. Only nodes carrying the `STORAGE` role flag parse this message deeper than raw validation; others drop it.

---

## 2. Bid Collection & Triage
`STORAGE` nodes receive requests, assess their local `StorageProvider` thresholds, and formulate cryptographic bids.

### `StorageBidMessage`
A P2P targeted message passed back to the requesting `ORIGINATOR`.
```typescript
export interface StorageBidMessage extends BaseMessage {
    storageRequestId: string;    // Bounding reference
    storageHostId: string;       // Bidding STORAGE node public key
    proposedCostPerGB: number;   // Configured rate from getCostPerGB()
    guaranteedUptimeMs: number;  // Metric derived from active reputation score
    // Signature verifying the Host's intent to uphold the rate
}
```

### The Triage Evaluation Loop (Limit Orders)
Inside the Originator's `SyncEngine` (or a dedicated `MarketManager`), the `storageRequestId` accumulates incoming bids. The `maxCostPerGB` acts as a limit order, negating a reliance on brittle timeouts.
1. **Filtering:** Drop bids where `proposedCostPerGB` > `maxCostPerGB`.
2. **Short-Circuit (Fill):** The originator tracks bids matching the limit order. If `N` valid nodes arrive meeting the criteria, the evaluation cuts off before the maximum timeout duration. 
3. **Prioritization:** Sort the collected bids favoring lower costs weighed against ascending `PeerReputation` scores to prioritize high-reliability nodes.
4. **Selection:** The selected `N` nodes (where `N = requiredNodes`) operate as the initial contract validators. 

---

## 3. Financial Integrity: Mempool Freezing
To prevent an Originator from exploiting asynchronous network layers to spin up multiple concurrent contracts exceeding their wallet balance, funds must be escrowed upon issuing a `StorageRequest`.

### `WalletManager` Updates
- **`freezeFunds(publicKey: string, amount: number, requestId: string): void`:** Deducts the theoretical maximum expenditure (`maxCostPerGB * fileSizeBytes/GB * requiredNodes`) from their available balance into a `frozen` temporary map.
- **`releaseFunds(requestId: string): void`:** If the triage loop fails to solicit `N` valid nodes, or the TCP handoff fails, the funds are returned to the sender's unspent pool.
- **`commitFunds(requestId: string): void`:** Executed when the finalized `STORAGE_CONTRACT` block merges onto the verifiable ledger in Phase 4.

When evaluating `WalletManager.getBalance(key)`, the return must reflect:
`balance = totalIncoming - totalOutgoing - totalFrozen`

---

## 4. UI Implications
1. **Upload Workflow Refinement (`/upload`)**: The frontend upload form must be expanded to include parameter inputs for:
   - Maximum Cost Ceiling (`maxCostPerGB`)
   - Replication Targeting (`requiredNodes` / Redundancy Level)
2. **Pending Transactions Ledger**: Expose "Escrowed" or "Pending" states inside the `/ledger` or Wallet UI views reflecting the frozen balances mapping active negotiations.
3. **Graceful Degraded States**: Alert the user via standard Toasts if the marketplace fails to locate `N` nodes under their desired cost ceiling.

---

## 5. Execution Task Checklist

- [x]  Create `StorageRequestMessage` and `<handler>` inside `messages/` and `peer_handlers/`.
- [x]  Create `StorageBidMessage` and `<handler>`.
- [x]  Implement the asynchronous Triage gathering loop inside `SyncEngine`.
- [x]  Update `WalletManager` to implement `freezeFunds`, `releaseFunds`, tracking active memory-state escrows and tracking `balance` modifications.
- [x]  Verify `WalletManager` via explicit unit tests mapping double-spend isolation behaviors against asynchronous timeouts.
- [x]  Modify `UploadView` and corresponding API endpoint structures to ingest and format the new `maxCost` and `redundancy` payload definitions.
- [x]  Update `AGENTS.md` and standard project `.md` documentation verifying newly instantiated logic constraints mirror implementations.
