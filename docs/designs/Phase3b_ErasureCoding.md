# Phase 3b: Erasure Coding & Redundancy

## The Problem
Phase 3 mandates uploading raw files identically across `N` peers. If multiple peers suffer hard drive failure, power loss, or churn offline before re-seeding triggers, the single file becomes unrecoverable, destroying the core utility of a decentralized file store relative to centralized hyperscale equivalents. Re-copying full files across high multipliers demands heavy bandwidth, slowing the network unacceptably.

## Proposed Solution: Reed-Solomon Erasure Coding
Introduce a deterministic Reed-Solomon matrix splitting files into $N$ encoded shards such that any combination of $K$ ($K < N$) original or parity shards can mathematically rebuild the entire file payload.
- $N$: Total number of shards distributed across network operators.
- $K$: Required shards to rebuild.
Nodes will securely bid on hosting specific cryptographic shards rather than massive 1:1 replicas.

### Pros
- Outstanding fault tolerance preventing widespread data loss.
- Greatly optimizes overall storage utilization ratios vs full replication.

### Cons
- Encoding and decoding payloads incurs heavy mathematical processing overhead on both the originator and the nodes dynamically serving shards.

## Alternative Solution: Multi-Replication (1:1 Mirrored Footprints)
Maintain the original roadmap storing full copies entirely across five localized nodes globally without modification.

### Pros
- Simplicity implementation. Immediate read access without reconstruction.

### Cons
- Extremely high raw capacity costs (500% raw overhead vs typical 150% erasure parameters).
- Wastes massive network egress bandwidth synchronizing massive files repeatedly.
