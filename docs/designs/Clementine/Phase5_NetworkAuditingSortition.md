# Phase 5: Ongoing Network Auditing & Sortition - Zero Context Engineering Blueprint

## 1. Problem Definition
Currently in Phase 4b, the `ConsensusEngine` audits the storage network probabilistically using simple uncoordinated `Math.random()` checks. This leads to two critical vulnerabilities:
1. **Redundant Wasted Bandwidth:** Multiple nodes may randomly elect themselves simultaneously to audit the identical chunk of the identical file, creating massive bandwidth collisions on the host node.
2. **Missing Economic Incentives:** While Proof of Spacetime is functioning, nodes are not mathematically compensated for their persistent storage space nor for expending compute generating Merkle proofs continuously over time.

## 2. Target Component Scope
- **`peer_handlers/consensus_engine/ConsensusEngine.ts`:** Remove `Math.random()` and introduce deterministic sortition logic electing exactly one unique auditor per period.
- **`wallet_manager/WalletManager.ts`:** Expose endpoints managing escrow bounds natively mapping explicit payouts based on Proof of Spacetime signatures.
- **`peer_handlers/consensus_engine/`:** Construct new logic emitting algorithmic `TRANSACTION` blocks natively releasing audited compensation constraints bounds mapped intrinsically.

## 3. Concrete Execution Workflow
1. **Global Determinism (Sortition):** An interval chron-job natively evaluates actively mapped `STORAGE_CONTRACT` structures inside the ledger. Instead of `Math.random()`, nodes parse `crypto.createHash('sha256').update(contractId + currentEpochHours + latestBlockHash).digest('hex')`. This deterministic string targets exactly one node via a mathematical distance function (e.g., XOR distance against peer identities). The winning node naturally realizes it is the sole auditor.
2. **Explicit Verification Processing:** The elected node acts identically to Phase 4b routines, querying for a 64KB chunk.
3. **Escrow Liquidation Transaction:** Upon successful receipt of the `MerkleProofResponseMessage`, the auditor formulates a specialized signed `TRANSACTION` block targeting the P2P network confirming validated integrity.
4. **Consensus Validation:** Other nodes sync the transaction, formally confirming the signature maps back to the deterministically elected auditor for that interval constraint bounded logically correctly. The host is compensated natively releasing bounds. 

## 4. Failure States & Boundary Conditions
- **Missing Auditors:** If the elected auditor is offline, the host temporarily misses out on the payout interval. However, no penalty is applied to the host.
- **Malicious Auditors:** If an auditor maliciously issues an invalid strike or attempts a fake escrow liquidation, the `ConsensusEngine` network actively drops the `TRANSACTION` referencing mathematical constraints locally blocking the Sybil sequence gracefully organically.

## 5. Granular Engineering Task Breakdown
- [ ] 1. Build `computeDeterministicAuditor()` evaluating XOR constraints mapped inside `ConsensusEngine.ts`.
- [ ] 2. Update `runGlobalAudit()` extracting pure `Math.random()` boundaries.
- [ ] 3. Construct the logical framework inside `WalletManager.ts` natively processing explicit spacetime block payouts logically executing natively mapped balances mapping.
- [ ] 4. Test deterministic metrics explicitly across multiple simulated networks locally.
