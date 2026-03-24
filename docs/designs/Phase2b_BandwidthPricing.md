# Phase 2b: Bandwidth Egress Pricing - Zero Context Engineering Blueprint

## 1. Problem Definition
The Verimus storage protocol compensates nodes for holding files over time. Transferring data back to clients (egress) incurs significant ISP bandwidth costs. If retrieval operations remain uncompensated, storage operators will drop heavy traffic pipelines to avoid financial losses, breaking marketplace reliability. We must establish a dual-pricing schema decoupled into `Rest Cost` and `Egress Cost`.

## 2. System Architecture Context (For Un-onboarded Engineers)
Verimus is a decentralized application implementing local storage capabilities through `StorageProvider` classes (e.g., `S3Provider`, `RemoteFSProvider`). The core financial state is managed by the `WalletManager.ts` calculating balances from a linear blockchain (`Ledger.ts`). Network endpoints exist inside HTTP streams attached to peer logic within `PeerNode.ts`. Subtraction of egress bandwidth funds must occur as the HTTP stream pipes file buffers back to the connected client.

## 3. Target Component Scope
- **`types/index.d.ts`:** Expansion of economic schemas framing contracts and peer configurations.
- **`storage_providers/*`:** Integration of bandwidth tolling functions.
- **`wallet_manager/WalletManager.ts`:** Escrow decrement loops tracking HTTP data streams.
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
    allocatedEgressEscrow: number; // Funds locked to pay for variable downloads
    remainingEgressEscrow: number; // Stateful property tracking ongoing HTTP deductions
}
```

## 5. Execution Workflow
1. **Request Orchestration:** The uploading client signals an `expectedRetrievalMultiplier` estimating their monthly egress footprints.
2. **Escrow Lock:** The ensuing `STORAGE_CONTRACT` payload locks the base rest payment and an `allocatedEgressEscrow` within `WalletManager`.
3. **HTTP Retrieval Trap:** An external client initiates a GET request against the `DownloadFileHandler`. 
4. **Byte Counting Deduction:** As `fs.createReadStream` pipes the file payload to the client, the `DownloadFileHandler` triggers an asynchronous hook subtracting the exact byte matrix cost against `remainingEgressEscrow` in the `WalletManager`.
5. **Funding Exhaustion:** If the escrow hits `0`, the node collapses the stream piping and returns an HTTP 402 status.

## 6. Failure States & Boundary Conditions
- **Network Partition during Download:** If the TCP socket drops mid-download, the node must deduct the bytes confirmed transmitted, averting client overcharging.
- **Insufficient Initial Escrow:** If a client exhausts their egress bounds, the node must return `402 Payment Required` blocking further data until a fresh `TRANSACTION` top-up is processed.

## 7. Granular Engineering Task Breakdown
1. Update `types/index.d.ts` to include `StoragePricingConfig` inside the standard `PeerNode` config block.
2. Abstract a `getEgressCostPerGB()` prototype method within the base `StorageProvider.ts` class.
3. Overwrite concrete child storage providers (`S3Provider`, `SambaProvider`) to return default or environment-pulled egress rates.
4. Modify `WalletManager.ts` ledger logic to segment `liquid` tokens and `escrowedData` tokens.
5. Create `WalletManager.deductEgressEscrow(contractId: string, byteCount: number)`.
6. Connect `DownloadFileHandler.ts` to the egress method, mapping `stream.on('data')` chunk iterations to the new `WalletManager` deduction hook.
7. Inject unit tests asserting that byte pipelines decrement balances.
8. Inject integration tests mimicking zero-escrow downloads asserting HTTP 402 rejection sequences.

## 8. Proposed Solution Pros & Cons
### Pros
- Matches real-world ISP economics, preventing storage node burnout.
- Incentivizes connected gigabit peers over isolated hard disks.

### Cons
- Increases `WalletManager` logic complexity tracking continuous stream equations.

## 9. Alternative Solution: Centralized Bandwidth Relays
Delegate egress serving to a specialized set of high-availability "Gateway" nodes that subsidize bandwidth.

### Pros
- Simplifies standard node routing rules.

### Cons
- Introduces centralization dependencies compromising core Web3 trust assumptions.
