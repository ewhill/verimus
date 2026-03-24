# Phase 6: Chain Scalability & Ledger Pruning - Zero Context Engineering Blueprint

## 1. Problem Definition
The decentralized environment requires issuing autonomous fractional `SYSTEM` rewards. This inflates the linear `Ledger` scale rapidly over time. New or offline node instances spinning up require massive historical retrieval payloads to calculate the base arithmetic balances before participating in network consensus. We must implement state checkpoints that safely consolidate past blocks and discard old transaction data.

## 2. System Architecture Context (For Un-onboarded Engineers)
Verimus nodes synchronize the state of the network by gossiping blocks through the `RingNet` topology. The `ConsensusEngine.ts` validates incoming blocks and asks the `Ledger.ts` database interface to append them. If a node connects for the first time, it downloads the entire blockchain history and runs `WalletManager.ts` to iterate from the Genesis block to current height, summing all transaction rewards and contract costs. To prune this history, we must introduce a single summarizing object (`CHECKPOINT` block) that encapsulates the exact final balance calculation state, allowing new nodes to start computing from that specific checkpoint hash rather than Genesis.

## 3. Target Component Scope
- **`ledger/Ledger.ts`:** Construct state checkpoint insertions and trim previous historic blocks matching older epoch boundaries.
- **`wallet_manager/WalletManager.ts`:** Initialize the unified array mapping the frozen base balances without recursive historical inference.
- **`peer_handlers/consensus_engine/ConsensusEngine.ts`:** Hook into Epoch block heights orchestrating consensus checking on the generated checkpoints.

## 4. Concrete Data Schemas & Interface Changes
```typescript
// types/index.d.ts

export interface CheckpointStatePayload {
    epochIndex: number;
    startHash: string;
    endHash: string; // The concluding block of the previous epoch timeframe
    compiledBalances: { [publicKey: string]: number }; // Aggregate target mapping arithmetic limits 
    activeContracts: { [contractId: string]: StorageContractPayload };
}

export interface CheckpointBlock {
    type: string; // 'CHECKPOINT'
    payload: CheckpointStatePayload;
    validatorSignatures: string[]; // Requires multi-sig consensus proving validation
}
```

## 5. Execution Workflow
1. **Epoch Detection:** Once the active blockchain size hits a set index boundary (e.g. Block 1,000,000), `ConsensusEngine` automatically shifts into a synchronization phase.
2. **State Compilation:** Every node calculates the exact aggregated `compiledBalances` array alongside an `activeContracts` list. Expired contracts are dropped from state tracking.
3. **Multi-Signature Verification:** The elected checkpoint proposal node physically gathers consensus votes sequentially securing mathematically valid `validatorSignatures`. 
4. **Checkout Minting & Pruning:** The finalized `CHECKPOINT` block is merged. `Ledger.ts` recursively prunes all preceding structures (Blocks 0 through 999,999) from the active data store.

## 6. Failure States & Boundary Conditions
- **Checkpoint Fork Validation:** If two competing `CHECKPOINT` blocks are produced, the engine must compare the aggregated `compiledBalances` states map-reduce style. If one block possesses an invalid balance calculation, the node must reject it.
- **Lost History Requests:** If an external block explorer attempts to query an old pruned block from a node, the `BlocksHandler` must return a structured index exhaustion error. 

## 7. Granular Engineering Task Breakdown
1. Define the `CHECKPOINT` enum inside the `BLOCK_TYPES` constant mapped in `constants.ts`.
2. Map `CheckpointStatePayload` and `CheckpointBlock` interfaces inside `types/index.d.ts`.
3. Add a `pruneHistory(checkpointHash: string)` function in `Ledger.ts` that issues a database deletion matching older schema indices. 
4. Modify `WalletManager.ts` math to accept initialization from an arbitrary `CheckpointStatePayload` array, bypassing the standard loop starting at Genesis.
5. Create a block-height tracking hook in `ConsensusEngine.ts` that halts standard gossip traffic when an epoch boundary is reached.
6. Assemble the multi-signature validation logic iterating over the array of node validation keys.
7. Write unit tests checking that `WalletManager.ts` outputs the exact core calculations whether iterating over 100,000 blocks or starting from a single checkpoint block mapping identical base parameters.

## 8. Proposed Solution Pros & Cons
### Pros
- Condenses blockchain resynchronization times from terabyte streaming pipelines to sub-minute cryptographic checkpoints.
- Solves the infinite linear ledger dilemma securing physical SSD bounds independently.

### Cons
- Complicates `WalletManager` inference matrices forcing dual-phase historical validation pipelines.
- Re-aligning active contracts into consensus forces heavy active consensus voting sequences periodically.

## 9. Alternative Solution: Centralized Archival Data Hubs
Define heavily capitalized "Archival Tier" nodes mandated to map the full immutable chain history, allowing generic nodes to query RPC strings discarding direct database persistence.

### Pros
- Decouples local physical storage pressure across baseline nodes maintaining basic operational footprints.

### Cons
- Severely jeopardizes underlying Web3 trust boundaries forcing participants onto vulnerable single points of querying truth.
