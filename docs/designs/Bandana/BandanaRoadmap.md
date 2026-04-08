# Project Bandana: Chronological Storage Contracts Roadmap

## Overview

**Project Bandana** introduces chronological leasing and data lifecycle management to the Verimus storage protocol. By adding `expirationTimestamp` definitions and `allocatedRestToll` escrow deductions, this upgrade provides users visibility into contract expiration and ensures storage nodes are compensated for retaining data over time.

This document serves as the high-level roadmap. Each milestone will correspond to a detailed Design and Task Breakdown document.

---

## Milestone 1: Cryptographic Schema & Wallet Escrow Initialization

**Objective**: Update the cryptographic schemas and wallet logic to support expiration timestamps and chronological escrow.

### Deliverables

1. **TypeScript Definitions**: Update `StorageContractPayload` in `types/index.d.ts` to include `expirationTimestamp` (Unix epoch) and `allocatedRestToll` (base storage payment).
2. **EIP-712 Schema**: Update `EIP712Types.ts` to include the new fields in the data structures required for signature validation.
3. **WalletManager Updates**: Update `WalletManager.ts` to isolate liquid assets from chronological escrows, using `restCostPerGBHour` to calculate deductions over time.

### Testability Considerations

- **Unit Tests**: Verify signature validation checks the `expirationTimestamp`.
- **Integration Tests**: Ensure `WalletManager` isolates frozen tokens and prevents double-spending.

---

## Milestone 2: Market Negotiation & Storage Quota Orchestration

**Objective**: Update the market bidding logic and upload endpoints to support chronological escrow limits.

### Deliverables

1. **Upload Request Parsing**: Modify `UploadHandler.ts` to accept `targetDurationHours`. Calculate the required escrow using `(Size * targetDuration * costPerGBHour)`.
2. **SyncEngine Validation**: Update `orchestrateStorageMarket` to reject bids if originators lack sufficient escrow to fund the requested duration.
3. **P2P Negotiation**: Modify peer response logic to validate the requested `allocatedRestToll` against the node's configuration.

### Testability Considerations

- **Unit Tests**: Verify math used to map duration length constraints to the escrow calculation in `UploadHandler`.
- **Integration Tests**: Simulate edge-cases where the originator requests high-duration storage without sufficient funds, ensuring the API returns HTTP 402/422.

---

## Milestone 3: Ledger-Enforced Pruning & Data Garbage Collection (GC)

**Objective**: Enable nodes to automatically enforce contract expirations and delete expired data to free storage capacity.

### Deliverables

1. **Ledger Queries**: Implement database queries in `Ledger.ts` to return expired contracts based on their `expirationTimestamp`.
2. **Garbage Collection Process**: Create a background process to parse expired contracts and delete the corresponding `physicalId` files from storage providers.
3. **Consensus Validation**: Update the consensus auditor to respect contract expirations, ensuring nodes are not penalized for deleting expired data.

### Testability Considerations

- **Integration Tests**: Simulate block progression to trigger contract expirations, ensuring data deletion occurs without causing auditor conflicts.
- **E2E Simulation**: Run multiple local nodes with intentional expirations, verifying physical files are deleted and network telemetry is accurate.

---

## Milestone 4: Frontend UI Integration & Contract Renewals

**Objective**: Update the user interface to display contract expirations and provide renewal notifications.

### Deliverables

1. **API Expansion**: Expose the `expirationTimestamp` in the `/api/contracts` endpoint responses.
2. **UI Updates**: Update `StorageContractPayload.jsx` to parse the `expirationTimestamp` and display the remaining time until expiration.
3. **Notification System**: Introduce dashboard warnings to notify users when their contracts are within 30 days of expiration.

### Testability Considerations

- **Unit Tests (Vite/React)**: Verify the UI formats Unix timestamps into readable countdowns.
- **Manual QA Execution**: Load the application in a browser and verify the UI displays the correct expiration periods and notifications.
