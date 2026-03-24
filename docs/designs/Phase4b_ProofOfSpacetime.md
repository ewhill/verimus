# Phase 4b: Cryptographic Validation (Proof of Spacetime) - Technical Specification

## 1. Problem Definition
The current roadmap anticipates checking data resting health via standard SHA-256 validation payloads dynamically. A malicious actor can securely compress the 15 MB dataset of chunk hashes for a 1500 GB payload, delete the 1500 GB buffer fully, and perpetually transmit the correct mathematically matching hash metrics collected over time safely claiming rewards. 

## 2. Target Component Scope
- **`crypto_utils/CryptoUtils.ts`:** Construct the initial sealing matrices mapping the physical bytes to a specific dynamic block challenge vector seamlessly.
- **`peer_handlers/consensus_engine/ConsensusEngine.ts`:** Manage the random sortition constraints issuing the mathematically bounded challenges across operators selectively globally.
- **`route_handlers/blocks_handler/BlocksHandler.ts`:** Route incoming PoSt checks natively binding responses immediately inside standard latency windows.

## 3. Concrete Data Schemas & Interface Changes

```typescript
// types/index.d.ts
export interface PoStChallenge {
    contractId: string;
    auditorPublicKey: string;
    randomNonce: string; // The dynamically generated 32-byte salt completely overriding deterministic precomputability
    startIndex: number;  // The arbitrary byte index mapped across the hosted array segment directly
}

export interface PoStResponse {
    proofSignature: string; // The encrypted sealing algorithm applied to: Hash(ChunkBytes[startIndex: startIndex+1024] + nonce + hostPublicKey)
    hostPublicKey: string;
    computedHash: string;
}
```

## 4. Execution Workflow
1. **Auditor Election:** A `ConsensusEngine` dynamically asserts a matching node as the network auditor based securely off deterministic block height rules globally.
2. **Challenge Dispatch:** The auditor explicitly constructs a randomized `PoStChallenge` payload referencing a distinct logical chunk file.
3. **Execution Delay Guarantee:** The respondent must slice out the `startIndex` bytes, prepend their physical peer ID, inject the active `nonce`, and hash the resulting vector natively generating a `computedHash`. 
4. **Validation Windows:** Because the `nonce` changes and is bound exclusively to the targeted chunk physically hosted on drive, retrieving it dynamically requires instantaneous parsing. Responding after an unacceptable delay threshold (e.g., > 500ms) proves the host logically failed to generate the byte boundaries securely in-memory.

## 5. Implementation Task Checklist
- [ ] Construct the mathematical sealing function leveraging TLS cryptoparser boundaries securely coupling `FileReadStream` data with dynamic random nonces.
- [ ] Incorporate the `PoStChallenge` networking models within `messages/Message.ts` structure logically.
- [ ] Define dynamic sortition endpoints inside `ConsensusEngine.ts` initiating independent network auditor streams periodically.
- [ ] Track latency limits securely measuring network request bounds aggressively failing queries breaching thresholds safely logically.
