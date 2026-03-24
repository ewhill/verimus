# Phase 2b: Bandwidth Egress Pricing - Technical Specification

## 1. Problem Definition
Currently, storing data delegates compensation metrics exclusively to static resting properties (`getCostPerGB()`). In reality, querying/downloading active files incurs severe ISP networking costs. Without distinct outbound bandwidth pricing structures, storage nodes face negative revenue pipelines and will disconnect to preserve operating capital.

## 2. Target Component Scope
- **`types/index.d.ts`:** Expansion of economic schemas framing contracts and peer configurations.
- **`storage_providers/*`:** Integration of explicit baseline bandwidth tolling functions.
- **`wallet_manager/WalletManager.ts`:** Micropayment escrow decrementing resolving outbound HTTP data streams.
- **`route_handlers/download_file_handler/DownloadFileHandler.ts`:** Injection of logic trapping unpaid streaming requests.

## 3. Concrete Data Schemas & Interface Changes

```typescript
// types/index.d.ts
export interface StoragePricingConfig {
    restCostPerGBHour: number;  // Continuous holding cost 
    egressCostPerGB: number;    // Subtracted sequentially upon data retrieval
}

export interface StorageRequestMessage {
    targetBytes: number;
    expectedRetrievalMultiplier: number; // Client predicts how heavily they will stream this over time
    // ...
}

export interface StorageContractPayload {
    allocatedRestToll: number;
    allocatedEgressEscrow: number; // Funds specifically locked to pay for downloads
}
```

## 4. Execution Workflow
1. **Request Orchestration:** The client originates a `StorageRequestMessage` and explicitly signals their `expectedRetrievalMultiplier`. For example, an active website asset might predict 10x retrieval monthly, whereas cold-storage predicts 0x.
2. **Escrow Allocation:** `WalletManager` validates the client possesses the funds to map the host's `StoragePricingConfig.egressCostPerGB`.
3. **Escrow Lock:** The resulting `CONTRACT` natively reserves the predicted `allocatedEgressEscrow`.
4. **Data Retrieval:** When a network endpoint hits `DownloadFileHandler.ts`, the `WalletManager` performs an atomic decrement tracking the bytes transmitted. 
5. **Funding Exhaustion:** If the escrow hits `0`, the node natively returns an HTTP `402 Payment Required` blocking the egress pipeline until a top-up `TRANSACTION` is submitted.

## 5. Implementation Task Checklist
- [ ] Implement `StoragePricingConfig` inside `types/index.d.ts`.
- [ ] Migrate the `StorageProvider` base class to expose and require initialization parameters for egress bandwidth.
- [ ] Overhaul the `WalletManager.ts` ledger math to partition balances into `liquid` and `escrowed` segments.
- [ ] Introduce a `deductEgressFunds(clientId, byteCount, providerId): Promise<boolean>` function into `WalletManager.ts`.
- [ ] Map the `DownloadFileHandler.ts` pipeline bounds wrapping the read stream directly natively triggering the deduction hook cleanly.
