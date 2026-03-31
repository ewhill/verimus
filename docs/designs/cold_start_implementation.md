# Cold Start Resolution Implementation Plan

## Overview
This blueprint directs the automated implementation of the Genesis Bootstrapping Resolution. The objective is to hardcode a static `STORAGE_CONTRACT` into the genesis initialization and implement an exponentially decaying mathematical cadence for Proof of Spacetime network audits.

## Phase 1: Deterministic Genesis Protocol
### [MODIFY] [`ledger/Ledger.ts`](file:///Users/erichill/Documents/Code/verimus/ledger/Ledger.ts)
- **Context:** The `createGenesisBlock()` method currently constructs a single base `TRANSACTION` block securing `SYSTEM` bounds.
- **Action:** Refactor `init()` and `createGenesisBlock()` to construct **two** base blocks:
  1. The original Index `0` monetary supply Genesis block.
  2. An Index `1` Genesis `STORAGE_CONTRACT` block.
- **Requirements:** 
  - The payload must encapsulate the technical configuration root manifest, firmly mapping the absolute physical boundaries of the network:
    ```json
    {
      "version": "1.0.0",
      "genesis_timestamp": 1700000000000,
      "erasure_baseline": "Reed-Solomon (K=1, N=1)",
      "audit_decay_lambda": 0.214,
      "consensus": "Spacetime + Proof of Stake"
    }
    ```
  - Calculate deterministic `merkleRoots`, set `erasureParams.k = 1`, `erasureParams.n = 1` for simplicity, and insert a universal physical identifier into the `fragmentMap` so the entire peer array validates it natively.

### [MODIFY] [`peer_node/PeerNode.ts`](file:///Users/erichill/Documents/Code/verimus/peer_node/PeerNode.ts)
- **Context:** Nodes initialize physical storage via their abstract `this.storageProvider` but do not currently inject default ledger blocks.
- **Action:** Inside the `start()` configuration sequence, nodes must query `this.ledger` for the Index `1` Genesis block. 
- **Requirements:** 
  - Automatically reconstruct and persist the JSON technical configuration chunk locally via `this.storageProvider.storeShard()`. 
  - This ensures every host participant physically holds the exact spacetime fragments required to pass instantaneous Merkle proofs during the bootstrapping hours.

## Phase 2: Exponential Audit Decay Modification
### [MODIFY] [`peer_handlers/consensus_engine/ConsensusEngine.ts`](file:///Users/erichill/Documents/Code/verimus/peer_handlers/consensus_engine/ConsensusEngine.ts)
- **Context:** The `runGlobalAudit()` function locks challenge sequences behind static one-hour interval buckets: `Math.floor(Date.now() / (1000 * 60 * 60))`.
- **Action:** Replace the static epoch mapping with a continuous mathematical decay bounded against genesis timestamps.
- **Algorithm:**
  - Retrieve `genesisTimestamp` from the `BLOCK_TYPES.TRANSACTION` at index `0`.
  - Compute absolute days since genesis bounding mathematical drift: `daysSinceGenesis = (Date.now() - genesisTimestamp) / (1000 * 60 * 60 * 24)`.
  - Map the exponential equation determining bucket sizing: `intervalBucketMs = 60000 + 3540000 * (1 - Math.exp(-λ * daysSinceGenesis))`
  - Configure lambda `λ = 0.214` (per day). This specific mathematical parameter was mapped via the bounds `-ln(0.05) / 14` to ensure the interval frequency reaches precisely 95% of its absolute final target (1 hour) precisely 14 days post-genesis, effectively hitting a permanent 99% plateau mathematically at 21.5 days. This provides an aggressive, initial 2-to-3 week bootstrapping verification sequence for hardware operators before the protocol cleanly decelerates and deadlocks into long-term physical 1-hour deflation constraints.
  - Implement caching to prevent audit loops from colliding during the compressed initial phase bounds.

## Verification Protocol
### Testing Requirements
- **Integration Tests:** Execute `npx tsc --noEmit` followed by a complete test pass `npm test` verifying MongoDB memory servers do not restrict the dual genesis blocks.
- **Manual Bootstrapping:** Purge the ledger array (`./scripts/stop.sh`), instantiate the root `spawn_nodes.sh --mongo`, and verify terminal outputs. The console must show intense `runGlobalAudit` Merkle Proof handshakes flowing repeatedly within the first 60 seconds, minting the initial `$VERI` distribution properly among the 5 spawned host instances.
