# Phase 1: Blockchain Economics & Wallet Balances

## Overview
This sub-design outlines the technical shift required to support the Clementine decentralized marketplace. It defines how the blockchain will transition into supporting `BlockType` identifiers to distinguish data payloads from `TRANSACTION` tokens. It also defines the `WalletManager` component which tallies a peer's financial bounds by scanning the immutable blockchain history recursively.

## 1. Block Typings Upgrade
Currently, blocks map loosely to generic data or simple ledger entries. Because **Project Clementine is explicitly a hard fork**, we will intentionally break backwards compatibility with legacy architectures. The blockchain acts exclusively as a marketplace configuration matrix, meaning standalone data blocks are entirely purged from the native ledger.

### Architecture
- **Schema Mapping**: Introduce an explicit enum `BlockType` natively stripping out legacy tracking.
```typescript
export enum BlockType {
    TRANSACTION = "TRANSACTION",          // Funds transferred between peers
    CONTRACT = "CONTRACT" // Market negotiation finalization
}
```

- **Transaction Block Structure**:
`TRANSACTION` blocks securely log the movement of network tokens.
```typescript
export interface TransactionPayload {
    senderSignature: string; // Cryptographically signed by the Sender's master key
    senderId: string;        // Originating Peer ID (Public Key Hash)
    recipientId: string;     // Destination Peer ID
    amount: number;          // Float/Integer volume transferred
}
```

## 2. WalletManager Class
A node cannot successfully maintain its own "fund balance" locally because isolated state files are trivially tampered with. Instead, an isolated `WalletManager` must programmatically deduce real-time funds by sweeping the public blockchain mapped inside the local storage provider.

### Encapsulation Model
- **Component File**: `wallet_manager/WalletManager.ts`
- **Unit Tests Placement**: `wallet_manager/test/WalletManager.test.ts`
- **Dependencies**: Receives a scoped read-only binding to the `Ledger`.

### Core Class Methods
The `WalletManager` operates on a deterministic baseline:

1. `calculateBalance(peerId: string): Promise<number>`:
    - Queries the `Ledger` for every block where `type === BlockType.TRANSACTION`.
    - Decrements: If `block.payload.senderId === peerId`, subtract `block.payload.amount`.
    - Increments: If `block.payload.recipientId === peerId`, add `block.payload.amount`.

2. `allocateFunds(peerId: string, amount: number): Promise<boolean>`:
    - Builds an outgoing `TRANSACTION` block payload.

3. `verifyFunds(peerId: string, minimumRequired: number): Promise<boolean>`:
    - Runs a boundary check against the `calculateBalance()` numerical output.
    - Used during the mempool consensus phase verification.

## 3. Consensus Validation Safeguards
To secure the marketplace, the mempool consensus engine will depend on this manager before adopting ledger forks:

- When a new `TRANSACTION` block enters the network topology:
    - The `ConsensusEngine` triggers `WalletManager.verifyFunds(SenderId, RequestedAmount)`.
    - If funds fall short, the Consensus Engine throws a strict consensus failure rejecting the fork.
    - This prevents double-spending attacks.

## 4. Required Task Breakdown
This sub-design requires the following implementations:
1. Update overarching Type definitions mapped in `/types/index.d.ts` defining `BlockType`.
2. Adjust Block schema inside the `Ledger` to accommodate these types.
3. Stub the `WalletManager` to track the required calculation mapping.
4. Inject integration endpoints connecting `WalletManager` inside `ConsensusEngine` to map rejection loops.
