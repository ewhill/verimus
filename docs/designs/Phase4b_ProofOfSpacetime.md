# Phase 4b: Cryptographic Validation (Merkle Proofs of Retrievability) - Technical Specification

## 1. Problem Definition
The current roadmap anticipates checking data resting health via standard SHA-256 validation payloads. A malicious actor can securely compress the 15 MB dataset of chunk hashes for a 1500 GB payload, delete the 1500 GB buffer fully, and perpetually transmit the correctly matching hash metrics collected over time to claim rewards. If we force hosts to uniquely "seal" data (encrypting it to their public key), they face severe CPU bottlenecks decrypting the data on-the-fly when legitimate clients request stream downloads.

## 2. Target Component Scope
- **`bundler/Bundler.ts`:** Construct a Merkle Tree over the file shards, emitting the Merkle Root into the contract payload.
- **`peer_handlers/consensus_engine/ConsensusEngine.ts`:** Manage random sortition issuing audit challenges targeting specific random chunk indices globally.
- **`route_handlers/blocks_handler/BlocksHandler.ts`:** Route incoming audit queries and package the raw logical byte segments alongside Merkle branching hashes.

## 3. Concrete Data Schemas & Interface Changes

```typescript
// types/index.d.ts
export interface MerkleProofChallenge {
    contractId: string;
    auditorPublicKey: string;
    chunkIndex: number; // The exact arbitrary 64KB shard slice requested for mathematical verification
}

export interface MerkleProofResponse {
    chunkData: Buffer; // The actual physical 64KB raw data slice
    merkleSiblings: string[]; // The sequential sibling hashes required calculating the root
    computedRootMatch: boolean;
}
```

## 4. Execution Workflow
1. **Contract Initialization:** During the upload phase, the `Bundler` splits shards into 64KB chunks and computes a Merkle Tree. The `CONTRACT` natively registers the `merkleRoot`.
2. **Auditor Election:** The `ConsensusEngine` mathematically asserts a matching node as the network auditor based on deterministic block height rules.
3. **Challenge Dispatch:** The auditor explicitly constructs a `MerkleProofChallenge` selecting a random `chunkIndex` (e.g., chunk 8,401 of 10,000).
4. **Validation Generation:** The host retrieves chunk 8,401 from its physical drive and maps the requisite `merkleSiblings`. It transmits the physical bytes and hashes back.
5. **Mathematical Verification:** The auditor hashes the sent physical bytes, layers the sibling hashes, and verifies the computed root matches the `CONTRACT` root. The host cannot fake this without physically possessing that specific 64KB chunk. Because indices are randomized, this probabilistically proves complete file possession over time.

## 5. Implementation Task Checklist
- [ ] Incorporate a generic Merkle Tree builder utility inside `crypto_utils/CryptoUtils.ts`.
- [ ] Refactor `StorageContractPayload` mapping the `merkleRoot` state string logically.
- [ ] Incorporate `MerkleProofChallenge` networking models within `messages/Message.ts` structure.
- [ ] Define dynamic auditor endpoints inside `ConsensusEngine.ts` verifying the probabilistic chunk bytes natively against the root string.

## 6. Proposed Solution Pros & Cons
### Pros
- Eliminates "sealing" CPU bottlenecks allowing hosts to stream native encrypted shards instantly to requesting clients without sequential decrypt matrices.
- Mathematically proves operators preserve actual file bytes forcing them to allocate physical drive sectors.

### Cons
- Transmitting a 64KB data chunk per audit consumes marginally more network payload bandwidth than a simple 32-byte cryptographic signature.

## 7. Alternative Solution: Host-Key Cryptographic Sealing (PoSt)
Force nodes to individually encrypt (seal) the payload array using their specific peer identity, proving possession by hashing a randomized nonce against the sealed bytes in real-time.

### Pros
- Sub-kilobyte auditing bandwidth.

### Cons
- Devastating read-latency overhead. Every legitimate client file download requires the host to physically computationally unseal the payload stream sequentially before transmitting it, tanking realistic CDN market throughput speeds.
