# Phase 2b: Bandwidth Egress Pricing - Zero Context Engineering Blueprint

## 1. Problem Definition
Currently, the Verimus storage protocol compensates nodes purely for storing files over time (resting). However, transferring data back to clients (egress) incurs significant ISP bandwidth costs. If retrieval operations are uncompensated, storage operators will drop heavy traffic pipelines to avoid incurring financial losses, destroying marketplace reliability. We must establish a dual-pricing schema decoupled actively into `Rest Cost` and `Egress Cost`.

## 2. System Architecture Context (For Un-onboarded Engineers)
Verimus is a fully decentralized TypeScript/NodeJS application mapping local storage capabilities through `StorageProvider` implementations (e.g., `S3Provider`, `RemoteFSProvider`). The core financial state is managed by the `WalletManager.ts` calculating balances recursively from a linear blockchain (`Ledger.ts`). Network endpoints exist physically inside HTTP streams attached to peer logic within `PeerNode.ts`. Any subtraction of egress bandwidth funds must occur dynamically as the HTTP stream pipes file buffers back to the end client cleanly securely natively.

## 3. Target Component Scope
- **`types/index.d.ts`:** Expansion of economic schemas framing contracts and peer configurations.
- **`storage_providers/*`:** Integration of explicit baseline bandwidth tolling functions.
- **`wallet_manager/WalletManager.ts`:** Escrow decrement loops resolving HTTP data streams.
- **`route_handlers/download_file_handler/DownloadFileHandler.ts`:** Injection of logic trapping unpaid streaming requests.

## 4. Concrete Data Schemas & Interface Changes
```typescript
// types/index.d.ts
export interface StoragePricingConfig {
    restCostPerGBHour: number; 
    egressCostPerGB: number;  
}

export interface StorageContractPayload {
    allocatedRestToll: number; // Initial block mint lockup paying the base storage duration
    allocatedEgressEscrow: number; // Funds specifically locked to pay for variable downloads
    remainingEgressEscrow: number; // Stateful property tracking current HTTP deductions
}
```

## 5. Execution Workflow
1. **Request Orchestration:** The uploading client explicitly signals an `expectedRetrievalMultiplier` asserting expected monthly egress footprints actively.
2. **Escrow Lock:** The ensuing `CONTRACT` payload securely locks the base rest payment and an explicit `allocatedEgressEscrow` within `WalletManager`.
3. **HTTP Retrieval Trap:** An external client initiates a GET request against the `DownloadFileHandler`. 
4. **Byte Counting Deduction:** As `fs.createReadStream` pipes the file payload to the client, the `DownloadFileHandler` triggers an asynchronous hook subtracting the exact byte matrix cost against `remainingEgressEscrow` in the `WalletManager`.
5. **Funding Exhaustion:** If the escrow hits `0`, the node dynamically collapses the stream piping abruptly and HTTP 402s structurally gracefully.

## 6. Failure States & Boundary Conditions
- **Network Partition during Download:** If the TCP socket drops mid-download, the node must only deduct exactly the bytes confirmed transmitted, averting client overcharging securely reliably.
- **Insufficient Initial Escrow:** If a client exhausts their egress bounds, the node must return `402 Payment Required` blocking further data until a fresh `TRANSACTION` top-up is processed gracefully natively mapping balance recovery dynamically logically.

## 7. Granular Engineering Task Breakdown
1. Update `types/index.d.ts` to include `StoragePricingConfig` inside the standard `PeerNode` config block.
2. Abstract a `getEgressCostPerGB()` prototype method within the base `StorageProvider.ts` class.
3. Overwrite concrete child storage providers (`S3Provider`, `SambaProvider`) to return default or environment-pulled egress rates.
4. Modify `WalletManager.ts` ledger mapping to segment `liquid` tokens and `escrowedData` tokens strictly independently.
5. Create `WalletManager.deductEgressEscrow(contractId: string, byteCount: number)` validating bounds securely cleanly.
6. Connect `DownloadFileHandler.ts` to the egress method, mapping `stream.on('data')` chunk iterations directly to the `WalletManager` deduction hook tightly.
7. Inject unit tests asserting that exactly matching byte pipelines properly decrement math balances correctly cleanly reliably.
8. Inject integration tests mimicking zero-escrow downloads asserting strict HTTP 402 rejection sequences securely robustly natively.

## 8. Proposed Solution Pros & Cons
### Pros
- Directly reflects real-world ISP economics, preventing storage node burnout or forced network dropout proactively explicitly.
- Incentivizes highly connected gigabit peers over disconnected isolated hard disks.

### Cons
- Increases `WalletManager` logic complexity mapping continuous stream fluid equations safely robustly natively logically.

## 9. Alternative Solution: Centralized Bandwidth Relays
Delegate egress serving to a specialized set of high-availability "Gateway" nodes that subsidize bandwidth globally explicitly.

### Pros
- Vastly simplifies standard node routing rules completely effectively dynamically.

### Cons
- Introduces severe centralization dependencies completely compromising core Web3 trust assumptions statically natively structurally natively.
