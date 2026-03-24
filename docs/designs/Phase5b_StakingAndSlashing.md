# Phase 5b: Staking Collateral & Network Slashing Mechanics - Zero Context Engineering Blueprint

## 1. Problem Definition
The network requires a mechanism to deter hostile node operators from dropping files after claiming storage contracts. Without physical financial risk, massive botnets can spoof identities, commit to hosting data for immediate payment, and then delete the data, destroying the filesystem utility. We must establish a strict deterrent enforcing data retention commitments through upfront collateral lockups and punitive balance slashing.

## 2. System Architecture Context (For Un-onboarded Engineers)
Verimus tracks financial state within the `WalletManager.ts` object, which scans the immutable history of `BLOCK_TYPES` in `Ledger.ts` to sum peer balances. The network reaches consensus on block additions using the `ConsensusEngine.ts`. To implement slashing, the state machine must recognize a new contract type (`STAKING_CONTRACT`) that subtracts tokens from a peer's liquid balance and places them in an escrow partition. When the Consensus Engine detects a failed audit (Phase 4b), it must propose a `SLASHING_TRANSACTION` block that permanently deducts those escrowed tokens.

## 3. Target Component Scope
- **`wallet_manager/WalletManager.ts`:** The state compiler interpreting new slashing mapped blocks to deduct baseline token constraints.
- **`peer_handlers/consensus_engine/ConsensusEngine.ts`:** Integration validating failure logic and emitting penalty signatures.
- **`ledger/Ledger.ts`:** Appending distinct staking bindings securing the initial base lockups in the database.
- **`types/index.d.ts`:** Establishing structured payload block elements validating consensus overrides.

## 4. Concrete Data Schemas & Interface Changes
```typescript
// types/index.d.ts

export interface StakingContractPayload {
    operatorPublicKey: string;
    collateralAmount: number; // Tokens removed from liquid usage
    minEpochTimelineDays: number; // Prevent instantaneous dump metrics
}

export interface SlashingPayload {
    penalizedPublicKey: string; // Target host definition
    evidenceSignature: string; // Cryptographic proof of a failed audit challenge
    burntAmount: number;
}
```

## 5. Execution Workflow
1. **Node Onboarding:** A new node submits a `STAKING_CONTRACT` block locking 50,000 liquid `SYSTEM` units into an escrow balance tracked within `WalletManager`.
2. **Audit Verification Failure:** During a Phase 5 validation sweep, the tested host fails successive Proof of Spacetime challenge timeouts.
3. **Slashing Dissemination:** The auditor constructs a `SLASHING_TRANSACTION` block embedding the timed-out query array `evidenceSignature`.
4. **Consensus Forfeiture:** The global network validates the failure signature and merges the block. The `WalletManager` erases the 50,000 token collateral constraint, reflecting a permanent zero value.

## 6. Failure States & Boundary Conditions
- **Invalid Evidence Signatures:** If an auditor submits a forged `SLASHING_TRANSACTION` without cryptographic proof that the host failed a genuine audit, the Consensus Engine must reject the block outright to prevent malicious griefing.
- **Insufficient Base Collateral:** If a node attempts to bid on a file contract but their `WalletManager` locked collateral state is below the minimum threshold, the `Marketplace` protocol must reject their bid payload.

## 7. Granular Engineering Task Breakdown
1. Augment `WalletManager.calculateBalance()` to track base collateral deposits separately, preventing `allocateFunds()` overdraw scenarios.
2. Add `STAKING_CONTRACT` and `SLASH_TX` definitions inside the `BLOCK_TYPES` constant map in `constants.ts`.
3. Create TypeScript interfaces `StakingContractPayload` and `SlashingPayload` within `types/index.d.ts`.
4. Connect `ConsensusEngine.ts` audit failure catch blocks to trigger the formulation of `SLASHING_TRANSACTION` objects.
5. Build a consensus validation helper ensuring the `evidenceSignature` matches a verifiable failed network challenge.
6. Write integration tests simulating a node failing an audit, verifying the resulting slash block zeroes out the target `WalletManager` collateral balance.

## 8. Proposed Solution Pros & Cons
### Pros
- Disincentivizes malicious manipulators, protecting genuine users.
- Secures the network from infinite Sybil identities executing contract fraud.

### Cons
- Creates a brutal onboarding hurdle punishing genuine developers experimenting with isolated nodes unable to afford collateral margins.
- Risks slashing operators experiencing honest ISP connectivity failures.

## 9. Alternative Solution: Delayed Withheld Rewards (Vesting)
Tokens are never slashed; instead, all storage rewards enter a 90-day vesting freeze. Failing an audit wipes out the pending queue.

### Pros
- Zero-cost onboarding allowing organic network expansion.

### Cons
- Attackers deduce exact profitability margins, balancing dumps to neutralize deterrence structures.
