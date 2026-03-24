# Phase 3b: Erasure Coding & Redundancy - Technical Specification

## 1. Problem Definition
Present marketplace dynamics rely on brute-force replication matrices (1:1 full files mapped across multiple disks globally). This creates a massive bandwidth overhead wasting network capacity and exponentially multiplying raw disk allocation parameters to resolve standard durability constraints.

## 2. Target Component Scope
- **`bundler/Bundler.ts`:** Encrypted data stream chunking logic splitting buffers strictly mathematically.
- **`route_handlers/download_file_handler/DownloadFileHandler.ts`:** Pipeline recombination sequence buffering fractional network shards resolving original zip streams.
- **`types/index.d.ts`:** Extrapolating `StorageContractPayload` explicitly identifying parity bounds.

## 3. Concrete Data Schemas & Interface Changes

```typescript
// types/index.d.ts
export interface ErasureParameters {
    N: number; // Total generated fragment shards
    K: number; // Physical threshold required resolving data entirely
}

export interface NodeShardMapping {
    nodeId: string;
    shardIndex: number;
    shardHash: string;
}

export interface StorageContractPayload {
    fileHash: string;
    erasureParams: ErasureParameters;
    fragmentMap: NodeShardMapping[];
}
```

## 4. Execution Workflow
1. **Upload Stream Parsing:** The client transmits a file through `UploadHandler.ts`.
2. **Buffering & Encryption:** The `Bundler` encrypts the payload normally, but instead of writing a monolithic payload, it pulls an external Reed-Solomon NPM integration (e.g., `rs-erasure-code`).
3. **Sharding:** The file is split into predefined slices ($N$). For example, a 1GB file becomes 15 fragments of 100MB ($K=10$, $N=15$).
4. **Target Acquisition:** The peer solicits hosting bounds strictly mapped matching 1 shard per node ID securely preventing overlapping domain redundancy points.
5. **Reconstruction:** When requested, `DownloadFileHandler` queries the DHT for fragments. Once it secures exactly $K$ valid payload blocks from $K$ peers, the RS matrix rebuilds the initial monolithic block mathematically, dropping the remaining $N-K$ lagging HTTP pipelines locally securely.

## 5. Implementation Task Checklist
- [ ] Evaluate and map a native NodeJS backend library securely supporting Reed-Solomon algorithms linearly.
- [ ] Refactor `StorageContractPayload` typing accommodating fragmented maps natively inside `index.d.ts`.
- [ ] Overhaul `Bundler.archiveFile()` injecting the matrix shard distribution pipeline mapping array buffers natively.
- [ ] Scale the DHT routing table enabling parallel streaming queries securing independent fragment hashes immediately.
- [ ] Reconstruct `DownloadFileHandler.ts` injecting an RS recombination buffering hook validating integrity hashes accurately before decrypting the unified payload.
