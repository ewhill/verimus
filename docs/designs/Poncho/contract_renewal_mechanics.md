# Contract Escrow Renewal Architecture

## 1. The Core Infrastructure Challenge

Currently, Verimus supports the creation of `STORAGE_CONTRACT` blocks which lock up `$VERI` inside an escrow state that physically drains as chronological time progresses. When a contract expires (`currentBlockIndex >= expirationBlockHeight`), the `GlobalAuditor` garbage collects the data via Bandana pruning capabilities.
To prevent active files from decaying, an originator must have the capability to "Top-Up" or "Renew" a live storage contract without suffering the massive network penalty of re-uploading terabytes of immutable data payload to generate a new block.

## 2. Cryptographic Block Upgrades

We must treat contract renewals as immutable historical events. Extending a contract requires a brand-new architectural block type.

### Phase 1: Ledger & Typing Adjustments

- **Add `BLOCK_TYPES.CONTRACT_RENEWAL`**: Update `/constants.ts` and `types/index.d.ts` globally to support a new top-level enum.
- **Define `ContractRenewalPayload`**:

  ```typescript
  export interface ContractRenewalPayload {
      marketId: string;                 // The hash of the target STORAGE_CONTRACT
      additionalEscrow: string;         // BigInt string of VERI being added
      additionalBlocks: string;         // BigInt string of blocks to push back the expiration height
  }
  ```
  
  **Architectural Note on Determinism**: Blockchains must remain strictly deterministic. Human-readable timelines (e.g., "30 Days") are acceptable within REST JSON APIs and UI elements, but they cannot exist inside immutable cryptographic block payloads. If the DAO ever votes to adjust the network `AVERAGE_BLOCK_TIME_MS`, interpreting semantic "Days" dynamically during ledger synchronization would instantly trigger massive consensus forks. Therefore, the API layer inherently translates semantic 'Days' into definitive `additionalBlocks` algebraically *before* creating the final `ContractRenewalPayload` payload and requesting a signature.

## 3. Consensus Engine & Mempool Validation

Because renewals artificially extend storage commitments, they must mathematically pass identical Byzantine tolerances as original transfers.

### Phase 2: Structural Verification (`MempoolManager.ts`)

1. **Ownership Constraint:** When `CONTRACT_RENEWAL` enters the mempool, the `MempoolManager` must query the original `STORAGE_CONTRACT` mapped to `marketId`. It must rigorously assert that `block.signerAddress === originalContract.signerAddress`. Only the origin owner can renew it.
2. **Liquidity Constraint:** The manager will call `WalletManager.verifyFunds(signerAddress, additionalEscrow)`. If the user is broke, the fork proposal is dropped.

## 4. Ledger Caching & State Transitions

Verimus natively manages a localized `activeContractsCollection` inside MongoDB to optimize queries for active contracts without recursively scanning the entire blockchain on every frame.

### Phase 3: Matrix Mutation (`Ledger.ts`)

When a `CONTRACT_RENEWAL` block reaches `SETTLED` status and is appended to the chain, the Ledger triggers an update to the physical `activeContractsCollection` document matching `marketId`:

```typescript
await this.activeContractsCollection.updateOne(
    { 'payload.marketId': renewalBlock.payload.marketId },
    { 
        $inc: { 
            'payload.remainingEgressEscrow': BigInt(renewalBlock.payload.additionalEscrow),
            'payload.expirationBlockHeight': calculateAddedBlocks(renewalBlock.payload.additionalBlocks)
        } 
    }
);
```

## 5. UI Integration & API Bridging

The frontend components originally flagged in `master_ui_refactor_proposal.md` now have a secure structural pathway to execute logic.

### Phase 4: API Bridge (`ContractsHandler.ts` or `FilesHandler.ts`)

- **Introduce `POST /api/contracts/:marketId/renew`**: Accepts raw JSON data mapping `{ additionalTimelineDays: 30, additionalEscrow: "100.0" }`. The server mathematically translates those semantic days into deterministic blocks, computes the final `ContractRenewalPayload` containing `additionalBlocks`, requests a standard EIP712 signature representation, formats the block, and broadcasts it across P2P websockets into the local `MempoolManager`.

### Phase 5: The Frontend Component (`RenewContractModal.jsx`)

- Invoked seamlessly from the "Top-Up Escrow" button mapped explicitly dynamically inside `ContractsView.jsx`.
- Automatically calculates and dynamically renders `Projected New Expiration Date` and `Required VERI Balance` to ensure transparent UX boundaries before invoking the backend API.
- Upon API success, natively transitions the component back to the standard grid, gracefully capturing the new `expirationBlockHeight` over typical state-fetch lifecycles.
