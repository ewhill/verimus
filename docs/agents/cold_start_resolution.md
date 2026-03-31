# Network Cold Start & Token Distribution Strategy

## Background
The Verimus network tokenomics dictate that `$VERI` is natively minted via `SYSTEM_MINT` instructions when nodes propose Checkpoint blocks confirming active `STORAGE_CONTRACT`s, or when nodes successfully complete mathematical Proof of Spacetime audits.

Currently, creating a `STORAGE_CONTRACT` explicitly requires the originator node to lock an egress escrow mapping pre-existing `$VERI`. At network genesis, all token supply is mapped strictly into the isolated `SYSTEM` wallet instance, leaving all human peer nodes with an initial baseline balance of `0`.

The Paradox: If nodes have a `0` balance, they cannot fund physical uploads. Without successful uploads, no `STORAGE_CONTRACT`s exist within the `blocks` collection. Without contracts to inspect, the primary `runGlobalAudit()` issuance loop terminates instantly. As a result, the network physically cannot mint its initial circulating supply to early operators, leaving the decentralized economy permanently stranded at an idle state.

## Proposed Solution: The Genesis Contract Bootstrapping Phase

**Description:** Implement an initial, active `STORAGE_CONTRACT` natively inside `createGenesisBlock()`. Combine this with an exponentially decaying audit execution loop, starting at a high frequency (e.g., every 10 blocks or 1 minute) and tapering off mathematically into standard long-term benchmarks (e.g., hourly).

**Mechanism:** 
1. The `SYSTEM` mints a `0`-cost Genesis Contract (e.g., storing a Verimus Manifesto text) directly during genesis construction in `Ledger.ts`.
2. All peer nodes natively cache these specific shard definitions upon discovering the network.
3. The high-frequency audit configuration triggers `runGlobalAudit()` aggressively in the first few weeks of the protocol. Connecting operators generate Merkle proofs proving possession of the Genesis fragments, earning the exact 90% Host / 10% Auditor `$VERI` issuance splits perfectly.
4. As operators mathematically "mine" this Genesis data rapidly, the early `$VERI` circulating supply is distributed to active physical participants, breaking the `0` balance limit order lock. 

**Pros:**
- Integrates seamlessly with the existing `runGlobalAudit()` mechanism without requiring special-case payout rules or alternative smart contract pipelines.
- Gamifies the early adoption curve organically, allowing true hardware operators to mathematically prove their bandwidth and earn starting capital instantly.
- Maintains strict architectural alignment with "Proof of Spacetime" principles.

**Cons:**
- Requires hardcoding persistent static chunk bytes (the Genesis artifact) into the node distribution source repository.
- A misconfigured high-frequency timer could theoretically bottleneck CPU execution routing early P2P handshakes if the decay lambda (λ) is excessively tight.

## Alternatives Considered

### Alternative 1: Public HTTP Faucet Endpoint
**Description:** Configure a static `/api/faucet` route handler instructing the `SYSTEM` reserve to allocate a small, fixed volume of "dust" (e.g., `0.005 $VERI`) directly to any connecting `publicKey` attempting to fund its first physical upload transaction.

**Pros:**
- Extremely fast to implement, requiring only a simple isolated `RouteHandler` hitting `WalletManager.allocateFunds()`.
- Guarantees instant determinism; operators immediately receive the exact numerical volume required to map their limit boundaries.

**Cons:**
- Highly vulnerable to Sybil attacks. Malicious actors can spin up unbounded parallel RSA keypairs rapidly draining the SYSTEM reserve or artificially inflating circulating supply parameters.
- Bypasses the fundamental "Proof of Spacetime" philosophy by emitting capital without requiring proof of physical hardware limitation.

### Alternative 2: Empty Block (Heartbeat) Rewards
**Description:** Modify `ConsensusEngine.ts` to issue a fractional baseline `SYSTEM_MINT` instruction anytime a validating node proposes an otherwise empty `CHECKPOINT` block.

**Pros:**
- Rapidly populates network liquidity by universally rewarding nodes strictly for maintaining healthy peer-discovery TCP handshakes.
- Matches traditional blockchain issuance paradigms where the isolated block-proposal function prints capital autonomously.

**Cons:**
- Disincentivizes physical data persistence. Early operators would earn capital leaving disks empty rather than assuming the architectural overhead of processing shard ingress/egress.
- Introduces systemic "lazy node" attack arrays where thousands of instances spin up purely to cluster heartbeat payouts while rejecting legitimate client limit orders.
