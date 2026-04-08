# Project Bandana: Chronological Storage Contracts Roadmap

## Overview

**Project Bandana** introduces chronological leasing and data lifecycle management to the Verimus storage protocol. By adding `expirationBlockHeight` definitions and `allocatedRestToll` escrow deductions, this upgrade provides users visibility into contract expiration and ensures storage nodes are compensated for retaining data over time.

This document serves as the high-level roadmap. Each milestone will correspond to a detailed Design and Task Breakdown document.

---

## Milestone 0: Legacy Payload Security Hardening

**Objective**: Eliminate JavaScript precision loss vulnerabilities across all existing `uint256` EIP-712 mappings before introducing new chronological boundaries.

### Milestone 0 Deliverables

1. **TypeScript Definitions**: Update existing index and epoch parameters (`minEpochTimelineDays`, `epochIndex`, `shardIndex`, `n`, `k`, `originalSize`) universally to use `bigint` in `types/index.d.ts`.
2. **Hydration Logic**: Update hydration functions in `EIP712Types.ts` to securely cast inputs directly to `bigint`, preventing JSON parsing and JS Float64 max-safe-integer bounds from causing arithmetic mutations.

### Milestone 0 Testability Considerations

- **Unit Tests**: Supply massive integer payloads exceeding `Number.MAX_SAFE_INTEGER` through cryptography tests verifying the signature bindings and state logic accurately protect numeric precision natively.

---

## Milestone 1: Cryptographic Schema & Wallet Escrow Initialization

**Objective**: Update the cryptographic schemas and wallet logic to support expiration block boundaries and chronological escrow natively leveraging BigInt math.

### Milestone 1 Deliverables

1. **TypeScript Definitions**: Update `StorageContractPayload` in `types/index.d.ts` to include `expirationBlockHeight` (integer mapped as `bigint`) and `allocatedRestToll` (base storage payment).
2. **EIP-712 Schema**: Update `EIP712Types.ts` to include the new fields in the data structures required for signature validation.
3. **WalletManager Updates**: Update `WalletManager.ts` to isolate liquid assets from chronological escrows, using `restCostPerGBHour` to calculate deductions over time.

### Milestone 1 Testability Considerations

- **Unit Tests**: Verify signature validation correctly asserts the `expirationBlockHeight` parameters.
- **Integration Tests**: Ensure `WalletManager` isolates frozen tokens and prevents double-spending.

---

## Milestone 2: Market Negotiation & Storage Quota Orchestration

**Objective**: Update the market bidding logic and upload endpoints to support chronological escrow limits.

### Milestone 2 Deliverables

1. **Upload Request Parsing**: Modify `UploadHandler.ts` to accept `targetDurationHours`. Calculate the required escrow using `(Size * targetDuration * costPerGBHour)`.
2. **SyncEngine Validation**: Update `orchestrateStorageMarket` to reject bids if originators lack sufficient escrow to fund the requested duration.
3. **P2P Negotiation**: Modify peer response logic to validate the requested `allocatedRestToll` against the node's configuration.

### Milestone 2 Testability Considerations

- **Unit Tests**: Verify math used to map duration length constraints to the escrow calculation in `UploadHandler`.
- **Integration Tests**: Simulate edge-cases where the originator requests high-duration storage without sufficient funds, ensuring the API returns HTTP 402/422.

---

## Milestone 3: Ledger-Enforced Pruning & Data Garbage Collection (GC)

**Objective**: Enable nodes to automatically enforce contract expirations and delete expired data to free storage capacity.

### Milestone 3 Deliverables

1. **Ledger Queries**: Implement database queries in `Ledger.ts` to return expired contracts based on their `expirationBlockHeight`.
2. **Garbage Collection Process**: Create a background process to parse expired contracts and delete the corresponding `physicalId` files from storage providers.
3. **Consensus Validation**: Update the consensus auditor to respect contract expirations, ensuring nodes are not penalized for deleting expired data.

### Milestone 3 Testability Considerations

- **Integration Tests**: Simulate block progression to trigger contract expirations, ensuring data deletion occurs without causing auditor conflicts.
- **E2E Simulation**: Run multiple local nodes with intentional expirations, verifying physical files are deleted and network telemetry is accurate.

---

## Milestone 4: Frontend UI Integration & Contract Renewals

**Objective**: Update the user interface to display contract expirations and provide renewal notifications.

### Milestone 4 Deliverables

1. **API Expansion**: Expose the `expirationBlockHeight` and converted approximations natively in the `/api/contracts` endpoint responses.
2. **UI Updates**: Update `StorageContractPayload.jsx` to parse the `expirationBlockHeight` and display the remaining block delta and estimated time until expiration.
3. **Notification System**: Introduce dashboard warnings to notify users when their contracts are nearing expiration.

### Milestone 4 Testability Considerations

- **Unit Tests (Vite/React)**: Verify the UI formats block counts into readable real-world countdown approximations accurately.
- **Manual QA Execution**: Load the application in a browser and verify the UI displays the correct expiration periods and notifications.
