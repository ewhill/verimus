# Phase 3b: Erasure Coding & Redundancy - Zero Context Engineering Blueprint

## 1. Problem Definition
Present distributed architectures rely on brute-force block replication (mirroring a 100MB file across 5 global nodes). This creates a destructive bandwidth overhead wasting network capacities and exploding hard disk redundancy capacities. We must deploy verifiable file sharding.

## 2. System Architecture Context (For Un-onboarded Engineers)
Verimus encrypts monolithic files targeting storage nodes by leveraging a custom component, `Bundler.ts`, which acts as an intermediate middleware layer wrapping the raw client stream. This `Bundler` pipes the output block to the target DHT node through `UploadHandler.ts`. The introduction of Reed-Solomon encoding intercepts this pipeline, transforming the single 100MB stream into multiple 10MB fragments inside memory before routing the shards over WebSockets/HTTPS to disparate `PeerNode` instances.

## 3. Target Component Scope
- **`bundler/Bundler.ts`:** Encrypted data stream chunking logic splitting buffers using Reed-Solomon.
- **`route_handlers/download_file_handler/DownloadFileHandler.ts`:** Streaming recombination bounds buffering fractional shards across network hooks.
- **`types/index.d.ts`:** Erasure config state additions.

## 4. Concrete Data Schemas & Interface Changes
```typescript
// types/index.d.ts
export interface ErasureParameters {
    N: number; // Total fragments built 
    K: number; // The subset fragments required rebuilding exactly
}

export interface NodeShardMapping {
    nodeId: string;
    shardIndex: number;
    shardHash: string; // The geometric hash validation
}

export interface StorageContractPayload {
    fileHash: string;
    erasureParams: ErasureParameters;
    fragmentMap: NodeShardMapping[];
}
```

## 5. Execution Workflow
1. **Client Parsing:** The original file passes into `Bundler.archiveFile()`.
2. **Buffer Injection:** Instead of pass-through AES encryption, the file buffer is routed into an external Reed-Solomon dependency (e.g., `rs-erasure-code`), which encodes the stream into $N$ subset buffers.
3. **Route Allocation:** The DHT is queried returning $N$ uncorrelated peers ensuring geo-redundant topological mappings.
4. **Distribution Iterations:** The shards are dispatched via HTTP pipelines matching `UploadHandler.ts`.
5. **Reassembly Check:** During download phases, `DownloadFileHandler` queries the DHT retrieving minimum $K$ logical boundaries. 

## 6. Failure States & Boundary Conditions
- **Insufficient DHT Density:** If an upload requires 15 unique active nodes but the network parses 12 eligible instances, the `Bundler` must trigger a fatal reversion denying contract generation.
- **Incomplete Recombination:** If a client attempts to retrieve a file but secures $K-1$ fragments due to network timeouts, the handler logs an `HTTP 503 Service Unavailable` halting recombination CPU loops.

## 7. Granular Engineering Task Breakdown
1. Evaluate and inject an open-source TypeScript RS-encoding npm library supporting byte ArrayBuffering.
2. Upgrade `types/index.d.ts` adding the matrix of arrays matching the `StorageContractPayload`.
3. Fork `Bundler.archiveFile()` generating a dual-mode parameter supporting linear architectures mapping into the new matrix sharding logic.
4. Scale `DHTManager.ts` routing capabilities requesting multi-peer exclusion subsets.
5. Code `DownloadFileHandler.ts` reconstruction logic wrapping incoming WebSocket chunks inside an array buffer rebuilding matrix indices.
6. Establish exhaustive unit testing around the RS library bounds verifying geometry logic completion.

## 8. Proposed Solution Pros & Cons
### Pros
- Plausible fault tolerance preventing widespread array losses without triggering immediate network re-seeding pipelines.

### Cons
- Slicing payloads through RS mathematical encoding triggers significant CPU overhead.

## 9. Alternative Solution: Direct Multi-Replication (1:1 Mirrored Footprints)
Store exact 1:1 copies of the full encrypted structure across specific nodes.

### Pros
- Simple structural deployment avoiding complex cryptographic array logic.

### Cons
- Demands brutal 500% disk allocation footprints.
