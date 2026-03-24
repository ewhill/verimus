# Project Clementine: Implementation Roadmap

This document serves as the top-level roadmap to guide the implementation of the Clementine decentralized storage marketplace architecture. 

Each phase below outlines a core architectural shift required by the design proposal. Future work will break these phases down into detailed **sub-designs** and subsequent **implementation tasks**. 

## Phase 1: Blockchain Economics (Wallets & Transactions)
**Goal:** Shift the homogeneous ledger into a multi-type blockchain that supports node funds and programmatic economy tracking.
- **Architectural Shift:** Introduce a `BlockType` schema (e.g., `TRANSACTION`, `CONTRACT`). Project Clementine operates strictly as a hard fork; legacy `DATA` blocks are fully deprecated and no longer supported on the native ledger.
- **New Mechanisms:** Implement `TRANSACTION` block handling and validation logic within the Consensus Engine.
- **State Calculation:** Add a `WalletManager` component which recursively scans the blockchain history to derive and maintain secure peer fund balances.
- **Target Sub-Design:** `Phase1_BlockchainEconomics.md`

## Phase 2: Peer Operational Modes & Market Configs
**Goal:** Empower node operators to categorize their network participation and define explicitly configured competitive storage rates.
- **Mode Decoupling:** Introduce initialization parameters defining nodes as `Storage`, `Validator`, or `Originator`. 
- **Storage Pricing API:** Update the `StorageProvider` abstraction to assert baseline `getCostPerGB()` functions or dynamic external API polling (e.g., pulling live S3 margins).
- **Behavior Sandboxing:** Sandbox logic so Validator nodes do not allocate massive physical storage bounds, but interact merely to participate in auditing sequences.
- **Target Sub-Design:** `Phase2_PeerOperationalModes.md`

## Phase 2b: Bandwidth Egress Pricing
**Goal:** Introduce a dual pricing schema covering resting blocks and outbound retrieval traffic decoupling ISP network demands natively.
- **Target Sub-Design:** `Phase2b_BandwidthPricing.md`

## Phase 3: The P2P Storage Marketplace
**Goal:** Implement the preliminary contract negotiation stage where nodes confidently vie for localized storage rights governed by their wallet funds.
- **Request Pipelining:** Create and dispatch the explicit `StorageRequestMessage` structure, validating `ChunkSize` limits and asserting `N`-node footprint bounds.
- **Bid Collection & Triage:** Construct the `StorageBidMessage` logic and the receiver's evaluation loop (weighing required node counts against overall network latency economics).
- **Contract Freezing:** Implement a two-phase mempool commit state, freezing funds from the requesting node actively within its `WalletManager` until consensus is firmly reached.
- **Target Sub-Design:** `Phase3_P2PStorageMarketplace.md`

## Phase 3b: Erasure Coding & Redundancy
**Goal:** Deploy Reed-Solomon algorithms encoding payloads across partial $K/N$ fragment shards optimizing capacity mapping mitigating single-point hardware node drops natively.
- **Target Sub-Design:** `Phase3b_ErasureCoding.md`

## Phase 4: Validated Data Seeding (Stream Hashes)
**Goal:** Orchestrate the encrypted shard payload across TCP pathways while validating size constraints.
- **Cryptographic Chunk Maps:** Adjust underlying network streams to intercept and hash payload increments based on the contractual `ChunkSize` to build a 1:1 footprint map.
- **The Initial Verify-Handoff:** Implement the initial challenge sequence forcing the host to prove chunk absorption.
- **Finalized Contract Block:** Mint the finalized `CONTRACT` block mapping these chunk-hash tables intrinsically onto the public ledger for auditing.
- **Target Sub-Design:** `Phase4_ValidatedDataSeeding.md`

## Phase 4b: Proof of Spacetime
**Goal:** Deploy cryptographically sealed verifiable proofs executing mathematical boundaries strictly preventing hash dropping attacks across audit checks globally.
- **Target Sub-Design:** `Phase4b_ProofOfSpacetime.md`

## Phase 5: Ongoing Network Auditing & Sortition
**Goal:** Secure the overall ecosystem by mathematically forcing unannounced structural validation challenges to verify active nodes.
- **Deterministic Sortition Algorithm:** Implement the `hash(StorageContractBlockId + IntervalTimestamp + LatestChainHash)` algorithm electing third-party auditors autonomously, eliminating RNG lotteries.
- **The Audit Challenge Payload:** Build the P2P pathways for validators to request precomputed chunks and measure compliance.
- **Financial Payout Execution:** Formally dispatch automated `TRANSACTION` tokens out of escrow, rewarding both the validated host node and the auditing node.
- **Target Sub-Design:** `Phase5_NetworkAuditingSortition.md`

## Phase 5b: Staking Collateral & Network Slashing
**Goal:** Force network onboarding requiring $SYSTEM staking natively enforcing strict deterrent penalties globally for unreliability natively.
- **Target Sub-Design:** `Phase5b_StakingAndSlashing.md`

## Phase 6: Chain Scalability & Ledger Pruning
**Goal:** Compress continuous historical ledger environments targeting overarching checkpoint epochs securely reclaiming massive node storage parameters.
- **Target Sub-Design:** `Phase6_LedgerPruning.md`

All sub-designs structurally follow the directives outlined in the local `AGENTS.md`.
