# Milestone 5 Task Breakdown: Legacy Cleanup & Validation

**Objective:** Implement "Complete Pipeline Eradication." This removes all dead structural code leaving a minimal execution footprint, followed by exhaustive validation confirming the full refactor is successful.

## Core Components Modified
- `credential_provider/GenerateKeys.ts`
- `scripts/spawn_nodes.sh`
- `test/*` framework configurations

---

## Tasks

### Task 1: Clean Up Configuration Scripts
**Context:** Node provisioning tools instantiate cryptographic credentials before booting. They must stop processing dead keys.
**File:** `credential_provider/GenerateKeys.ts`
**Action:**
1. Locate the `generateRSAKeyPair` initialization logic and the `fs.writeFileSync` blocks outputting `.pem` files.
2. Delete the RSA sequence from the execution chain.
3. Ensure the generator produces only Ethereum `.evm.key` standards.

### Task 2: Clean Up Bash Deployment Infrastructure
**Context:** The `spawn_nodes` execution pipelines initialize the local instances through bash loop variables. 
**File:** `scripts/spawn_nodes.sh`
**Action:**
1. Scrub all line items tracking `--privateKeyPath` or attempting to target `.pem` configurations.
2. Validate the local deployment loop launches the Verimus stack prioritizing the `.evm.key` boundaries. 

### Task 3: Finalize Test Harness Purge & Dead Code Deletion
**Context:** The repository retains deprecated structures requiring physical eradication to eliminate technical debt.
**File:** `test/integration/*`, `p2p/lib/*`
**Action:**
1. Execute physical file deletions for obsolete class files: `p2p/lib/RSAKeyPair.js` and `p2p/test/RSAKeyPair.test.js`.
2. Delete deprecated tracking wrappers: `HelloMessage.js` alongside `SetupCipherMessage.js` (and their respective test files).
3. Review overarching frameworks across the test repository extracting left-over simulated RSA mockings.

### Task 4: End-to-End Syntax and Format Validation
**Context:** Removing parameters creates unused variables and floating imports requiring code linting cleanup.
**Execution Limit:** Terminal Execution
**Action:**
1. Execute `npx eslint --fix "./**/*.ts" "./**/*.js"` across the project trimming all dead imports resulting from the removals.
2. Run `npx tsc --noEmit` confirming zero syntax faults remain. 

### Task 5: Comprehensive Local Operations Check
**Context:** The absolute final success metric mandates confirming the blockchain operates in a live environment over the new encryption routines.
**Execution Limit:** Terminal Execution
**Action:**
1. Run `npm test` confirming successful execution of the full consensus suite.
2. Formulate a live 4-node mock deployment running `./scripts/spawn_nodes.sh`. Navigate to the local UI (`http://127.0.0.1:CURRENT_PORT/ledger/global`) verifying ledger synchronization executes without failures.
