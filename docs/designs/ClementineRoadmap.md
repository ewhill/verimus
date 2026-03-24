# Project Clementine: Implementation Roadmap

This document serves as the top-level roadmap to guide the implementation of the Clementine decentralized storage marketplace architecture. 

Each phase below outlines a core architectural shift required by the design proposal. Future work will break these phases down into detailed **sub-designs** and subsequent **implementation tasks**. 

## Phase 0: Permissionless Transport Layer
**Goal:** Dismantle the permissioned transport layer gatekeeper by replacing the shared RSA "Ring" key with a fully open, personal identity-based P2P handshake.
- **Library Fork (p2p):** Directly copy the vendored `ringnet` library source code into the project root under the `p2p` directory to fully sever external dependency.
- **Identity Handshakes:** Modify the connection upgrade sequence to validate a peer's personal cryptographic key pair instead of a centralized, shared ring key.
- **Application Layer Trust:** Delegate all Byzantine fault tolerance and peer banishment logic entirely to the Application Layer (`ReputationManager`), enabling anyone to join the network anonymously.
- **Target Sub-Design:** `Phase0_PermissionlessTransport.md`

## Phase 0b: Epidemic Routing (Gossip Protocol) Overlay
**Goal:** Transition the transport layer from a fully-connected mesh to a strictly capped epidemic-routing overlay capable of scaling to hundreds of thousands of nodes.
- **Connection Limits & Triage:** Enforce static maximum thresholds on active sockets (e.g., 50 neighbors) to prevent individual peer node exhaustion, triaging dead connections cleanly.
- **Epidemic Relaying (LRU & TTL):** Configure message propagation to bounce epidemically from node to neighbor, restricted strictly by a static Time-To-Live (TTL) field (e.g., 20) and severed by a local Seen Message Cache (LRU) to eliminate broadcast storms.
- **Decentralized Discoverability (PEX):** Introduce Peer Exchange patterns (`GetPeersMessage` & `PeersResponseMessage`) enabling nodes to harvest dynamic neighbor IP lists seamlessly without immediate connection coupling.
- **Target Sub-Design:** `Phase0b_GossipProtocol.md`

## Phase 1: Blockchain Economics (Wallets & Transactions)
**Goal:** Shift the homogeneous ledger into a multi-type blockchain that supports node funds and programmatic economy tracking.
- **Architectural Shift:** Introduce a `BlockType` schema (e.g., `TRANSACTION`, `STORAGE_CONTRACT`). Project Clementine operates strictly as a hard fork; legacy `DATA` blocks are fully deprecated and no longer supported on the native ledger.
- **New Mechanisms:** Implement `TRANSACTION` block handling and validation logic within the Consensus Engine.
- **State Calculation:** Add a `WalletManager` component which recursively scans the blockchain history to derive and maintain secure peer fund balances.
- **Target Sub-Design:** `Phase1_BlockchainEconomics.md`

## Phase 1b: Algorithmic Emission & Ledger Incentivization (Tokenomics)
**Goal:** Bootstrap the network economy by minting `$VERI` to nodes for validating consensus and storing the ledger, solving the genesis deadlock.
- **System Faucet:** Implement a core protocol mechanism allowing the `SYSTEM` address to emit non-inflationary funded `TRANSACTION` blocks.
- **Continuous Time-Based Decay:** Institute an exponential decay curve tied to block `timestamp` diffs, decoupled from network throughput block speeds.
- **Cost Deflation Peg:** Tie the token emission decay rate to a 4-year halving half-life reflecting Kryder's Law's physical storage depreciation curve.
- **Target Sub-Design:** `Phase1b_Tokenomics.md`

## Phase 2: Peer Operational Modes & Market Configs
**Goal:** Empower node operators to categorize their network participation and define explicitly configured competitive storage rates.
- **Mode Decoupling:** Introduce initialization parameters defining nodes as `Storage`, `Validator`, or `Originator`. 
- **Storage Pricing API:** Update the `StorageProvider` abstraction to assert baseline `getCostPerGB()` functions or dynamic external API polling (e.g., pulling live S3 margins).
- **Behavior Sandboxing:** Sandbox logic so Validator nodes do not allocate massive physical storage bounds, but interact merely to participate in auditing sequences.
- **Target Sub-Design:** `Phase2_PeerOperationalModes.md`

## Phase 3: The P2P Storage Marketplace
**Goal:** Implement the preliminary contract negotiation stage where nodes confidently vie for localized storage rights governed by their wallet funds.
- **Request Pipelining:** Create and dispatch the explicit `StorageRequestMessage` structure, validating `ChunkSize` limits and asserting `N`-node footprint bounds.
- **Bid Collection & Triage:** Construct the `StorageBidMessage` logic and the receiver's evaluation loop (weighing required node counts against overall network latency economics).
- **Contract Freezing:** Implement a two-phase mempool commit state, freezing funds from the requesting node actively within its `WalletManager` until consensus is firmly reached.
- **Target Sub-Design:** `Phase3_P2PStorageMarketplace.md`

## Phase 4: Validated Data Seeding (Stream Hashes)
**Goal:** Orchestrate the encrypted shard payload across TCP pathways while validating size constraints.
- **Cryptographic Chunk Maps:** Adjust underlying network streams to intercept and hash payload increments based on the contractual `ChunkSize` to build a 1:1 footprint map.
- **The Initial Verify-Handoff:** Implement the initial challenge sequence forcing the host to prove chunk absorption.
- **Finalized Contract Block:** Mint the finalized `STORAGE_CONTRACT` block mapping these chunk-hash tables intrinsically onto the public ledger for auditing.
- **Target Sub-Design:** `Phase4_ValidatedDataSeeding.md`

## Phase 5: Ongoing Network Auditing & Sortition
**Goal:** Secure the overall ecosystem by mathematically forcing unannounced structural validation challenges to verify active nodes.
- **Deterministic Sortition Algorithm:** Implement the `hash(StorageContractBlockId + IntervalTimestamp + LatestChainHash)` algorithm electing third-party auditors autonomously, eliminating RNG lotteries.
- **The Audit Challenge Payload:** Build the P2P pathways for validators to request precomputed chunks and measure compliance.
- **Financial Payout Execution:** Formally dispatch automated `TRANSACTION` tokens out of escrow, rewarding both the validated host node and the auditing node.
- **Target Sub-Design:** `Phase5_NetworkAuditingSortition.md`

All sub-designs structurally follow the directives outlined in the local `AGENTS.md`.
