# Project Poncho: UI Implementation Roadmap

This document serves as the top-level roadmap guiding the implementation of **Project Poncho**, a comprehensive React/Vite Front-End User Interface overhaul. The goal of this project is to explicitly translate the backend `Clementine` decentralized storage marketplace architecture natively into active, interactive user capabilities.

Because `Verimus` utilizes a dynamic Zustand state-management system and asynchronous Vite polling, this UI upgrade maps cleanly 1:1 with the underlying Phase limits natively deployed in the core engine.

## Phase 0: Network Mesh & Discovery Visualizer
**Backend Parity:** Gossip Protocol (Epidemic Routing) & Permissionless Validation
**Goal:** Expose the peer-to-peer connection topography dynamically bypassing static tables.
- **Topology Graphing:** Migrate the static `api/peers` table into a dynamic interactive visualizer showing physical network edges organically bouncing routing packets (`NetworkHealthSyncMessage`).
- **Gossip Health Panel:** Display real-time dropped-packet caches, TTL limits, and Peer Exchange (PEX) harvesting lists indicating network density.

**Component Translation:**
- **Current State:** `PeersView.jsx` draws a basic radial graph parsing basic `api/peers` connection statuses (`connected`, `BANNED`).
- **Intended State:** Visualizer illustrates active Epidemic Gossip execution bounces, cache limits, and physical PEX data harvests cleanly.
- **Components to Modify:** Overhaul `Views/PeersView.jsx` with complex active edges, inject a new `GossipStatsPanel.jsx` local module.

## Phase 1: The Decentralized Wallet Dashboard
**Backend Parity:** Blockchain Economics & Tokenomics
**Goal:** Track system-level algorithmic $VERI disbursements natively within the dashboard.
- **Wallet Status:** Implement a dedicated "Wallet" view querying the peer's $VERI float directly mapped via the `WalletManager` continuous state array.
- **Transaction History:** Build an exploratory sub-view mapping ledger history dynamically identifying `$SYSTEM` emissions and `TRANSACTION` sends.
- **Deflation Realities:** Formulate a UI component graph showing the active exponential token emission decay limit globally.

**Component Translation:**
- **Current State:** No formal financial structures, wallet dashboards, or token tracking exist on the UI layer. `Header.jsx` only tracks basic node properties.
- **Intended State:** A premium dedicated Wallet interface projecting continuous native $VERI balances, transaction ledgers, and exponential decay metrics automatically.
- **Components to Modify:** Build `Views/WalletView.jsx`, inject Wallet navigation links globally in `Layout/Header.jsx`, and stand up a new `TransactionLedgerGrid.jsx` to parse legacy economics.

## Phase 2: Node Console & Storage Marketplace (Modes)
**Backend Parity:** Peer Operational Modes & Market Configs
**Goal:** Allow users to dynamically configure their node definitions and observe market bandwidth thresholds.
- **Operating Configuration Form:** Add explicit client toggles setting the node identically to `Storage`, `Validator`, or `Originator` constraints upon startup.
- **Storage Pricing API Input:** Implement physical fields defining local $VERI costs per GB, natively overriding baseline constants seamlessly and broadcasting to the mesh.

**Component Translation:**
- **Current State:** Node profiles are formally mapped via internal backend flags statically on load; zero dynamic controls exist enforcing node settings organically.
- **Intended State:** A formal overlay or control center mapping manual operational execution constraints and aggressive storage economics natively.
- **Components to Modify:** Draft `Modals/NodeConfigModal.jsx` integrating sliders and input elements, and bridge the trigger strictly to the identity block in `Layout/Header.jsx`.

## Phase 3: Secure Contracts & Erasure Shard Explorer
**Backend Parity:** The P2P Storage Marketplace & Erasure Coding
**Goal:** Transition "Files Hub" from a local file explorer into a global escrow contract tracking matrix.
- **Contract Negotiations:** Visually indicate pending network bidding during uploads, mapping `StorageBidMessage` prices dynamically natively from foreign nodes.
- **Reed-Solomon Fragments Graph:** Visually illustrate physical Node IP distributions for $K/N$ fragments organically, indicating where chunks live globally.

**Component Translation:**
- **Current State:** `FilesView.jsx` functions strictly as a basic cloud drive enumerating local filesystem objects. `UploadView.jsx` blindly pushes blocks blindly across the web layer.
- **Intended State:** Active contract-negotiation visuals binding peer pricing APIs to immediate File uploads, securely evaluating $K/N$ geographic redundancy matrices correctly.
- **Components to Modify:** Deep restructuring of `Views/FilesView/FilesView.jsx` and `Views/UploadView.jsx` integrating hooks modeling bid interactions natively. Construct a dynamic `ShardGraph.jsx` component resolving geographic topologies.

## Phase 4: Cryptographic Crypt Exploration
**Backend Parity:** Validated Data Seeding & Proof of Spacetime
**Goal:** Display real-time execution speeds of initial Verify-Handoff absorption loops natively preventing spoofing.
- **Data Absorption Logs:** Monitor real-time hash validations across massive multi-gigabyte files organically streaming out via WebSockets.

**Component Translation:**
- **Current State:** Upload bounds are silent beyond a generic percentage progress bar.
- **Intended State:** Strict algorithmic stream output arrays displaying cryptographic checksum matches verifying absolute initial node data handoffs logically.
- **Components to Modify:** Expand `Views/UploadView.jsx` mapping backend streaming logs structurally parsing AES encryption markers dynamically.

## Phase 5: Reputation & Slashing Leaderboard
**Backend Parity:** Network Auditing, Staking Collateral, & Native Slashing
**Goal:** Bring maximum transparency natively to physical storage stability.
- **Sortition Audit Terminal:** Build a real-time command terminal displaying ongoing global network sortition intervals natively monitoring physical interval tests.
- **Global Slashing Ladder:** Implement a highly interactive "Leaderboard" indexing network node reputations (via `api/peers`) calling out nodes penalized identically via cryptographic `SLASHING_TRANSACTION` execution metrics!

**Component Translation:**
- **Current State:** `PeersView.jsx` renders a minimal UI card plotting static `BANNED` markers and single `peer.score` limits asynchronously.
- **Intended State:** Explicit global ladder charting top-performing Storage nodes and shaming heavily-slashed domains. A live telemetry feed tracking mathematical spacetime sortition audits globally.
- **Components to Modify:** Divest `PeersView.jsx` integrating a formal `ReputationLadder.jsx` tab and construct a strict `Views/AuditTerminal.jsx` feed resolving real-time P2P WebSockets validation channels.

## Phase 6: Core Ledger Health & Epoch Metrics
**Backend Parity:** Chain Scalability & Continuous State Ledger Pruning
**Goal:** Visualize the $O(1)$ continuous state constraints to explicitly highlight engine execution efficiencies natively.
- **Checkpoint Telemetry:** Inject a global health widget indicating the current active `EPOCH_SIZE` threshold count cleanly tracking up towards the 1,000,000 bound.
- **Database Scalability Graph:** Show active internal MongoDB native footprint allocations directly demonstrating instantaneous evaporation when physical disk sweeps gracefully drop past history.

**Component Translation:**
- **Current State:** `LedgerView.jsx` parses linearly tracking singular block increments mapping history indefinitely.
- **Intended State:** Advanced analytics console charting exactly how far along the network resides before triggering catastrophic historical MongoDB memory pruning executing O(1) constraints.
- **Components to Modify:** Enhance `Views/LedgerToolbar.jsx` dropping global Checkpoint constraints and build a formal `EpochTelemetryWidget.jsx` visual mapping memory capacity executions natively.

---
*All sub-designs conceptually follow the UI strict-typing rules outlined in the `AGENTS.md` boundaries preventing UI/Backend layer bleeds.*
