# Consensus Engine Eventual Consistency Fix

The problem involves non-deterministic "stuck" pending blocks within the consensus logic. After a rigorous trace, I have identified exactly why the pipeline occasionally fractures natively under load.

### Diagnostics & Root Cause
1. **Linear Proposal Chains**: `ConsensusEngine._checkAndProposeFork()` strictly operates as a sequential cascade—it is invoked initially when a new block transitions to `eligible=true`, and recursively invoked immediately following the successful settlement of a block (`_commitFork`).
2. **Missing Network Resilience**: During burst loads (such as generating 10 concurrent audit blocks), network boundaries can naturally experience UDP packet drop, overlapping syncing events, or partition limits that cause specific `ProposeForkMessage` logic to be silently dropped by peers before it physically hits the `majority` confirmation threshold internally mapping `forkEntry.adopted = true`.
3. **The Deadlock Scenario**: Because `adopted` state is never achieved, `_commitFork` is never invoked. Because `_commitFork` is never invoked, `_checkAndProposeFork()` (the mechanism that clears out the rest of the pending blocks linearly) is never executed structurally again. The `eligibleBlockIds[0]` block remains locked, infinitely blocking all subsequent valid blocks linearly beneath it structurally forever.
4. **Secondary Failure**: `runGlobalAudit` natively hooks to the completion of `_commitFork()`. Once the consensus chain sequence seizes up dynamically, the mathematical proof of spacetime events organically stall synchronously across the network bounds entirely.

## Deterministic Resilience: The FLP Bound
As dictated by the **FLP Impossibility Theorem**, purely asynchronous networks cannot deterministically identify a "dropped packet" or a "crashed node" without utilizing localized state timeouts guarantees. To guarantee strict determinism without relying on arbitrary `setInterval` "sweepers", we must introduce a formal state-machine model tightly bound to the precise lifecycle of every single proposed fork natively imitating PBFT View-Changes organically.

## Proposed Changes

### ConsensusEngine (Strict PBFT Timeouts)
We will abandon the global sweeping array, and implement deterministic tracking explicitly.

#### [MODIFY] `peer_handlers/consensus_engine/ConsensusEngine.ts`
1. **State Maps**: Introduce a `private activeForkTimeouts: Map<string, NodeJS.Timeout> = new Map();` array binding strictly to executing forks locally.
2. **Controlled View-Change**: Inside `_checkAndProposeFork`, when an unadopted fork is targeted natively, we instantiate a localized state countdown timer exactly exclusively for `forkId` set strictly to **10,000ms**. (Industry standard context: BFT algorithms like Hyperledger or Tendermint utilize Base Timeouts between *3,000ms - 10,000ms*. Giving WebSockets 10 seconds perfectly guarantees no anomalous jitter physically terminates stable proposals prematurely before executing the deterministic fallback).
3. **Commit Resolution**: If the targeted fork dynamically hits majority (`handleAdoptFork`) mapping correctly causing `_commitFork` internally, we will explicitly mathematically `clearTimeout(activeForkTimeouts.get(forkId))` guaranteeing safe execution natively terminating the specific loop.
4. **Deterministic Abort & Retry Phase**: If the countdown triggers dynamically, it confirms undeniably that mathematical majority failed physically. The loop will deterministically `clearTimeout`, formally `delete` the corrupted `forkId` physically from `this.mempool.eligibleForks`, and rigorously execute `this._checkAndProposeFork()` invoking exactly one controlled retry matrix mapping globally mathematically ensuring unbroken progression logic inherently.
