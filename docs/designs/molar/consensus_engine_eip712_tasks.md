# Task Breakdown: EIP-712 Consensus Validation Integration (Milestone 3)

**Prerequisite Objective:** This breakdown executes the transition of block cryptographic validation away from unstructured JSON/RSA hashing towards explicitly structured Web3 EIP-712 bounds natively mapped using `ethers.js`.

**Context for Agents:** 
- **EIP-712 Strictness:** EIP-712 typed schemas must recursively explicitly map to the physical boundaries defined in `types/index.d.ts`. Ensure properties like `metadata.index` and `metadata.timestamp` are properly defined as internal nested structs (e.g., `BlockMetadata`) instead of strings.
- **Testing Constraints:** You must utilize `ethers.Wallet.createRandom()` to autonomously generate and sign structured Web3 payloads natively within all updated `.test.ts` instances replacing legacy `signData()` mock buffers smoothly.
- **Agent Guardrails:** DO NOT change the transport Layer-0 overlay routing network. The underlying node handshake and socket validation bounds MUST stay running basic RSA structures (`verifySignature`) seamlessly; we are ONLY refactoring `ConsensusEngine` block payload signing validation. 

---

### Task 1: Define Strict EIP-712 Core Schema Mappings
**Target:** `crypto_utils/EIP712Types.ts` (New File) or `crypto_utils/CryptoUtils.ts`

**Details:**
- Create and export an explicit `EIP712Domain` object structurally identifying identical chain states locally natively (e.g., `name: 'Verimus', version: '1', chainId: 1337`).
- Formally define the `Record<string, Array<{name: string, type: string}>>` mappings explicitly typing each of the 5 core Verimus blocks (e.g. `TransactionBlockType`, `StorageContractBlockType`, `NodeRewardBlockType`, `SlashingBlockType`, `CheckpointBlockType`).
- **Crucial Rule:** Be acutely aware that nested structures (like `metadata` containing `index` and `timestamp`) must correctly map out as independent struct entities structurally inside the type object tree perfectly.

**Testing Context:**
- Add quick unit definitions ensuring all five mapping blocks structurally validate correctly directly bypassing compiler constraints organically without running nodes dynamically natively.

---

### Task 2: Implement Ethers Validation Abstractions
**Target:** `crypto_utils/CryptoUtils.ts`

**Details:**
- Export a new validation function (e.g., `verifyEIP712BlockSignature(block: Block): boolean`).
- This utility should programmatically introspect `block.type` natively selecting the applicable Web3 TypedData Schema formulated in Task 1 seamlessly.
- Extract the remaining internal values natively passing them seamlessly toward `ethers.verifyTypedData(domain, schema, value, block.signature)`.
- It mathematically explicitly passes validation exclusively if the resulting verified EVM Address checksum definitively identically corresponds securely to the `block.signerAddress` parameter matching correctly natively.

---

### Task 3: Disassemble Legacy Consensus Constraints
**Target:** `peer_handlers/consensus_engine/ConsensusEngine.ts`

**Details:**
- Explicitly rip out existing unstructured JSON payload stringifying hacks inside the `handlePendingBlock` function natively previously built around manual `.hash` slicing mappings identically directly evaluating arrays organically.
- Safely route the incoming `block` perfectly natively securely toward your newly implemented `verifyEIP712BlockSignature()` bound constraint seamlessly dropping anomalous deviations. 
- *Note:* Retain the fundamental standard `hashData` assignment specifically for maintaining the root `block.hash` internally mappings natively tracking Mongo database references, but disconnect signature legitimacy exclusively evaluating strictly through the EIP-712 derivation organically correctly mapped correctly.

**Testing Context:**
- Running `npm test` here optimally flags multiple legacy suites correctly violating the structural update mappings.

---

### Task 4: Overhaul Testing Payload Mock Integrations
**Target:** `test/integration/**/*` & `peer_handlers/consensus_engine/test/ConsensusEngine.test.ts`

**Details:**
- Scour the remaining `.test.ts` validation blocks executing manual `CryptoUtils.signData` overrides heavily previously. 
- You must dynamically implement an `ethers.Wallet` proxy locally within these tests accurately mapping parameters organically tracking `wallet.signTypedData(domain, types, value)` ensuring these structurally pass seamlessly toward the consensus validator securely avoiding compilation hang loops successfully natively natively natively.

**Testing Context:**
- Execute `npm test`. 
- Ensure exactly 0 TypeScript errors securely executing natively via `npx tsc --noEmit`.
- Ensure exactly 0 Linters organically failing explicitly via `npx eslint "src/**/*.ts"`.
