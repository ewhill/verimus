# Task Breakdown: Ledger Data Model & Economic Typing Evolution (Milestone 2)

**Prerequisite Objective:** This breakdown executes the transition of the primary Verimus block architecture away from P2P RSA identification towards strict Web3 standard `0x` MetaMask Ethereum boundaries.

**Context for Agents:** 
- **Aggressive Overwrite:** You are performing a strict typing overwrite. Backward compatibility with the existing database is definitively abandoned. Expect localized ledger mounts and legacy tests simulating RSA blocks to fail organically until migrated.
- **Strict Typing Compliance:** Do **not** use `as any` casting to forcefully bypass TypeScript constraints when generating mock payloads. You must strictly redefine stubs leveraging `ethers.Wallet` accounts.
- **Unused Variables:** Satisfy `noUnusedLocals` strictly by prepending deliberately ignored routing parameters with `_unused` (e.g. `_unusedReq`).
- **Mock Integrity:** Never modify production files with defensive checks (e.g., `typeof ...`) solely to appease failing incomplete unit tests. Keep production files strictly bound to the updated EVM payload structs. Use `createMock<T>` natively.

---

### Task 1: Update Root TypeScript Boundaries
**Target:** `types/index.d.ts`

**Details:**
- Replace `PeerReputation.publicKey` with `operatorAddress`.
- Replace `TransactionPayload.senderId` with `senderAddress`.
- Replace `TransactionPayload.recipientId` with `recipientAddress`.
- Replace `BaseBlock.publicKey` with `signerAddress`.
- Replace `StakingContractPayload.operatorPublicKey` with `operatorAddress`.
- Replace `SlashingPayload.penalizedPublicKey` with `penalizedAddress`.

**Testing Context:**
- Running `npx tsc --noEmit` will immediately begin violating across dozens of files. This is expected. It provides the exact map required to complete tasks 2 and 3 sequentially.

---

### Task 2: Refactor the WalletManager Ledger Validation
**Target:** `wallet_manager/WalletManager.ts`

**Details:**
- Update `calculateBalance` and `updateIncrementalState` to index off the newly defined property names (`senderAddress`, `signerAddress`, etc.).
- **Crucial Requirement:** Before calculating arrays or invoking `$inc` operations against `balancesCollection`, the target address MUST be validated natively encapsulating it within `ethers.getAddress(address)`. This securely enforces the Web3 standard Checksum validations natively blocking capitalization duplication hacks.
- If `address === 'SYSTEM'`, systematically bypass the ethers checksum dynamically.

**Testing Context:**
- **Target:** `wallet_manager/test/WalletManager.test.ts`
- Replace entirely all stub architectures producing RSA string combinations natively with standard `ethers.Wallet.createRandom().address` strings representing the isolated wallets. Verify that mock balances persist accurately and securely under the deterministic checksum formats.

---

### Task 3: Migrate Route Handlers & Integration Boundaries
**Target:** `route_handlers/**/*` and `peer_handlers/**/*`

**Details:**
- Systematically trace every remaining typescript compilation error executing across `BlocksHandler.ts`, `WalletHandler.ts`, `ConsensusEngine.ts`, and `PeerNode.ts`.
- Replace property accesses directly natively (e.g. `block.publicKey` translates to `block.signerAddress`).
- Refactor any generic local `this.node.publicKey` instantiations previously artificially mapped to the economic fields directly. Confidently accept strictly `0x` values (provided via UI injection or backend testing stubs).

**Testing Context:**
- The automated unit assessments within these handler directories will organically begin failing due to typing misalignments in statically mapped mock payloads. Update the local `.test.ts` mock factories utilizing deterministic `0x` strings instead of legacy RSA derivations natively.

---

### Task 4: Harmonize MongoDB Schemas & Final Integration Constraints
**Target:** `ledger/Ledger.ts`

**Details:**
- Reconfigure any deterministic index creation mapped loosely during cold startup database mounting. (e.g. index constructions mapped over `publicKey` should target `signerAddress`).
- Eliminate any dead string conversions directly parsing RSA constraints inside the MongoDB driver payloads natively.

**Testing Context:**
- Execute `npm test`. 
- Achieve exactly 0 TypeScript errors natively via `npx tsc --noEmit`.
- Enforce exactly 0 Linting errors natively via `npx eslint "src/**/*.ts"`.
- Run a successful local initialization cycle executing `pkill -f tsx; pkill -f nodemon; pkill -f mongo; ./scripts/spawn_nodes.sh --mongo`. Verify local system nodes organically boot correctly bridging zero legacy blocks inherently without panicking.
