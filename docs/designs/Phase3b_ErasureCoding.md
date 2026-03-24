# Phase 3b: Erasure Coding & Redundancy - Zero Context Engineering Blueprint

## 1. Problem Definition
Present distributed architectures rely on brute-force block replication (mapping the identical unfragmented 100MB file across 5 individual global nodes). This creates a destructive bandwidth overhead wasting native network capacities and exploding hard disk redundancy capacities. We must deploy mathematically verifiable file sharding.

## 2. System Architecture Context (For Un-onboarded Engineers)
Verimus encrypts entirely monolithic files targeting storage nodes by leveraging a custom component, `Bundler.ts`, which acts as an intermediate middleware layer wrapping the raw client stream. This `Bundler` directly pipes the output block to the target DHT node mapping through `UploadHandler.ts`. The introduction of Reed-Solomon encoding intercepts this pipeline, transforming the single 100MB stream mathematically into multiple 10MB fragments dynamically inside memory before routing the shards over WebSockets/HTTPS to physically disparate `PeerNode` instances natively explicitly robustly locally.

## 3. Target Component Scope
- **`bundler/Bundler.ts`:** Encrypted data stream chunking logic splitting buffers strictly mathematically using Reed-Solomon.
- **`route_handlers/download_file_handler/DownloadFileHandler.ts`:** Streaming recombination bounds buffering fractional shards across network hooks securely.
- **`types/index.d.ts`:** Erasure config state additions natively.

## 4. Concrete Data Schemas & Interface Changes
```typescript
// types/index.d.ts
export interface ErasureParameters {
    N: number; // Total fragments built geometrically 
    K: number; // The subset fragments required rebuilding exactly
}

export interface NodeShardMapping {
    nodeId: string;
    shardIndex: number;
    shardHash: string; // The explicit geometric hash mapping validation physically natively
}

export interface StorageContractPayload {
    fileHash: string;
    erasureParams: ErasureParameters;
    fragmentMap: NodeShardMapping[];
}
```

## 5. Execution Workflow
1. **Client Parsing:** The original file passes into `Bundler.archiveFile()`.
2. **Buffer Injection:** Instead of a simple pass-through AES encryption, the file buffer is routed into an external Reed-Solomon dependency (e.g., `rs-erasure-code`), which encodes the stream into $N$ explicit subset buffers.
3. **Route Allocation:** The DHT is queried dynamically returning $N$ uniquely uncorrelated peers completely ensuring geo-redundant topological mappings securely logically natively.
4. **Distribution Iterations:** The shards are dispatched sequentially via HTTP pipelines matching `UploadHandler.ts`.
5. **Reassembly Check:** During download phases, `DownloadFileHandler` simultaneously queries the DHT explicitly retrieving minimum $K$ logical boundaries physically reliably securely. 

## 6. Failure States & Boundary Conditions
- **Insufficient DHT Density:** If an upload requires 15 unique active nodes but the network only parses 12 eligible instances globally, the `Bundler` must trigger an immediate fatal reversion securely denying contract generation locally.
- **Incomplete Recombination:** If a client attempts to retrieve a file but can only secure $K-1$ fragments due to network timeouts completely mapping logical blockages, the handler natively logs an `HTTP 503 Service Unavailable` halting recombination CPU loops seamlessly.

## 7. Granular Engineering Task Breakdown
1. Map, evaluate, and inject an open-source native TypeScript/Node RS-encoding npm library supporting byte ArrayBuffering dynamically.
2. Upgrade `types/index.d.ts` mapping the matrix of arrays matching the `StorageContractPayload` explicitly.
3. Fork `Bundler.archiveFile()` generating a dual-mode parameter supporting old linear architectures mapping seamlessly into the new matrix sharding logic.
4. Scale `DHTManager.ts` routing capabilities directly requesting multi-peer exclusion subsets explicitly natively reliably correctly cleanly.
5. Code `DownloadFileHandler.ts` reconstruction logic wrapping incoming WebSocket chunks seamlessly inside an array buffer correctly rebuilding matrix indices.
6. Establish exhaustive unit testing around the RS library bounds matching missing index geometries successfully completing native arrays cleanly.

## 8. Proposed Solution Pros & Cons
### Pros
- Outstanding fault tolerance preventing widespread array losses without triggering immediate network re-seeding pipelines dynamically correctly physically.

### Cons
- Slicing payloads through RS mathematical encoding triggers significant CPU overhead locally efficiently effectively reliably natively.

## 9. Alternative Solution: Direct Multi-Replication (1:1 Mirrored Footprints)
Store exact 1:1 copies of the full encrypted structure across specific nodes.

### Pros
- Extremely simple structural deployment avoiding completely complex cryptographic array logic statically logically natively structurally.

### Cons
- Demands brutal 500% disk allocation footprints correctly physically efficiently dynamically successfully purely inherently explicitly cleanly.
