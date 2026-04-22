# Master UI Refactor Design Document (Project Poncho)

## Overview

This design document analyzes the current Verimus frontend UI components inside `/ui/src/components/Views/` against modern, industry-standard ledger "on-ramp" tools (like Etherscan, Solscan, and the Filecoin Network Dashboard). The objective is to evaluate isolated user journeys and propose new, updated, or removed elements to elevate the Verimus UI to a tier-1 decentralized platform experience.

---

## 1. Global Navigation & Search Paradigm (Header & App Shell)

**Current State:** The application utilizes routing parameters (`q=` and `block=`) embedded directly into native history for localized searches (e.g., `filesSearchQuery` and `searchQuery`).
**Standard Paradigm:** Block explorers unify search. A user shouldn't have to know if they are searching for a block, a wallet address, a file mapping, or a transaction hash beforehand.
**Proposed Changes:**

- **Add Unified "Omnibar" Global Search:** Placed prominently in the central `<Header />`. Input auto-detects hash length (64 chars = Block/Tx Hash, `0x` = EVM Wallet, String = Files/Contracts). Upon hitting "Enter", it dynamically resolves the entity and transitions to the correct `<BlockModal />` or `<WalletView />`.
- **Global Network Stats Banner:** Add a persistent marquee or top-header ticker displaying:
  - Current Block Height
  - Live Network Validators (derived from `/api/peers` connection count)
  - Current EPOCH or Protocol Version
  - Native VERI Gas/Price equivalent (if applicable)

## 2. Ledger View (`LedgerView.jsx`, `LedgerGrid.jsx`, `LedgerToolbar.jsx`)

**Current State:** Displays a generic list of system events/blocks. Includes standard filtering but typically stacks raw data indiscriminately.
**Standard Paradigm:** Distinct separation between structural network progression (Blocks) and user asset transfers (Transactions).
**Proposed Changes:**

- **Split Views (Latest Blocks vs. Latest Transactions):** Implement a dual-pane dashboard (similar to Etherscan's homepage). The left pane shows freshly minted blocks (Height, Age, Signer, Txn Count). The right pane shows individual ledger actions (Type: `TRANSACTION` vs `STORAGE_CONTRACT`, From, To, Value).
- **Infinite Scrolling & Live Polling:** Upgrade `LedgerGrid` from standard manual pagination to an auto-incrementing websocket feed (`socket.on('ledger_push')`) that gracefully drops new rows into the top of the grid with a gentle CSS highlight animation.
- **Visual Badges:** Add color-coded role tags next to `SignerAddress` fields to instantly denote if the signer is a known system contract, `VALIDATOR`, or generic user.

## 3. Network & Peers View (`PeersView.jsx`, `ConsensusView.jsx`)

**Current State:** Tracks connected topologies and physical TCP/WebSocket layers.
**Standard Paradigm:** Network dashboards (like Solana Beach) provide high-fidelity insights into node health, geo-distribution, and reputation.
**Proposed Changes:**

- **Consolidate & Enrich the Table:** Combine raw consensus latency metrics with peer connections. The table should explicitly list:
  1. Peer ID / wallet address (Shortened)
  2. Sub-Protocol / Roles (`STORAGE`, `VALIDATOR`)
  3. Latency (Ping in ms)
  4. **Reputation Score:** (Visual progress bar. 100 = Green, 50 = Yellow, 0 = Red/Banned)
- **Remove:** Raw noisy JSON dumps in the UI (move them strictly to `LogsView`).
- **Add Visual Topography Node Map:** (Optional, high-effort) A basic 2D interactive force-directed graph (e.g., via `d3.js` or `react-force-graph`) showing the mesh topology and who is actively acting as the BFT leader.

## 4. Contracts & Files View (`ContractsView.jsx`, `FilesView/`)

**Current State:** Handles decentralized storage packages.
**Standard Paradigm:** Arweave and Filecoin treat storage deals as living contracts requiring lifecycle management and renewal insights.
**Proposed Changes:**

- **Contract Lifecycle Badges:** Introduce clear statuses (`PENDING`, `ACTIVE`, `CHALLENGED`, `EXPIRED`, `SLA_BREACH`).
- **Audit Health Indicator:** Display a visual "Proof of Spacetime" heartbeat. If a physical ID hasn't been successfully audited recently, visually alert the user.
- **Renew Action:** Currently, contracts might decay. Introduce a clear "Top-Up Escrow" button directly on the specific item row inside `ContractsView`, launching a localized modal to inject more $VERI into the contract without deep-navigating.

## 5. Wallet Integration (`WalletView.jsx`)

**Current State:** Maps EIP-6963 discovery and tracks the user's balances natively.
**Standard Paradigm:** Users need historic tracing of their exact spend profiles.
**Proposed Changes:**

- **Add Portfolio Charting:** A simple area chart visually mapping the user's `$VERI` balance over the last 30 days based on their transaction history.
- **Isolated TxHistory Grid:** A localized version of the LedgerGrid filtered explicitly for `recipientId === walletId` or `senderId === walletId`.

## 6. Structural & Component Polish (`BlockModal.jsx`)

**Proposed Changes:**

- **Remove** massive unbroken JSON text walls for block payloads.
- **Add** domain-specific payload renderers. E.g., if `type === 'STORAGE_CONTRACT'`, render a beautiful summary card showing "File Size", "Erasure Params (k/n)", and "Total Escrow".
- **Tabulated Deep Dives:** Inside the modal, split "Overview", "Raw Hex", and "Signatures" into three tabs so standard users aren't overwhelmed by EIP712 Signature schemas immediately upon click.

---
**Summary:** The overarching goal is shifting from an "engineer's diagnostic readout" to a "consumer-grade platform dashboard." Emphasize human-readable metrics, auto-updating live views, and context-aware payload rendering over raw JSON stringification.
