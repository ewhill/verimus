# Task Breakdown: On-Chain Validator Registry Migration

This living document serves as the implementation checklist and technical requirements guide for transitioning Verimus from an insecure connection-based BFT heuristic (High Water Mark) to a fully deterministic, on-chain Proof of Stake Validator Registry.

## Core Conceptual Changes
1. **Payload Standard**: Strict adherence to the `VALIDATOR_REGISTRATION` block type for tracking active node operator stakes.
2. **Synchronous Validation Cache**: Because consensus evaluation (`majority` votes) executes synchronously within the WebSockets loop, the Ledger persistence layer must actively cache the validator array in-memory.
3. **Epoch Mechanics**: `majority` bounds must NEVER dynamically shift mid-evaluation. The ledger recalculates the validator array only upon pre-defined block intervals (Epoch boundaries).

---

## Task Checklist & Execution Plan

### Task 1: Scaffolding Validator Registration Contracts (COMPLETED ✅)
*   **Target Files**: `types/index.d.ts`, `constants.ts`
*   **Description**: Ensure that `VALIDATOR_REGISTRATION` is registered sequentially. Define the interface `ValidatorRegistrationPayload` matching `{ validatorAddress: string, stakeAmount: bigint, action: 'STAKE' | 'UNSTAKE' }`.
*   **Test Update**: Update `Ledger.test.ts` to mock generic serialization behaviors of this payload.

### Task 2: Persistence Storage Collection Mapping (COMPLETED ✅)
*   **Target Files**: `ledger/Ledger.ts`
*   **Description**: Instantiate and link an `activeValidatorsCollection: Collection<Validator>` onto the MongoDB interface.

### Task 3: In-Memory Validation Map & State Aggregation (COMPLETED ✅)
*   **Target Files**: `wallet_manager/WalletManager.ts` & `ledger/Ledger.ts`
*   **Description**: Construct an interceptor that updates the MongoDB `activeValidatorsCollection` when the `WalletManager` evaluates a block with `type === BLOCK_TYPES.VALIDATOR_REGISTRATION`.

### Task 4: Epoch Boundary Evaluations (COMPLETED ✅)
*   **Target Files**: `ledger/Ledger.ts`, `constants.ts`
*   **Description**: Implement `EPOCH_LENGTH`. Inside `Ledger`, evaluate `block.metadata.index % EPOCH_LENGTH === 0`. If true, update `activeValidatorCountCache`.

### Task 5: Refactoring `getMajorityCount` Constraints (COMPLETED ✅)
*   **Target Files**: `peer_node/PeerNode.ts`
*   **Description**: Replace `networkHighWaterMark`. Shift to: `return Math.floor(node.ledger.activeValidatorCountCache / 2) + 1;`.

### Task 6: P2P Slashing Mechanisms & Ejection (COMPLETED ✅)
*   **Target Files**: `peer_handlers/reputation_manager/ReputationManager.ts`
*   **Description**: Trigger a penalty block if a staked validator is offline.

### Task 7: Integration End-to-End Suite Verification (COMPLETED ✅)
*   **Target Files**: `test/integration/ValidatorRegistration.test.ts`
*   **Description**: Unified integration test mimicking:
    1. 5 Nodes booting.
    2. 1 Node injecting a signed `VALIDATOR_REGISTRATION` block.
    3. The network reaching the predefined Epoch boundary natively.
    4. Evaluating that `getMajorityCount()` universally transitions up across the whole mesh instantly as the block height resolves over the modulo division.

---

*Note: For an AI agent working autonomously, utilize this document to stack git commits sequentially task-by-task. Mark completion status directly underneath each checklist item locally.*
