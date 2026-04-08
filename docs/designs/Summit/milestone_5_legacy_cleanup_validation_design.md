# Summit Milestone 5 Design: Legacy Cleanup & Validation

## 1. Background

After unifying the internal application bounds to utilize `secp256k1` Ethereum primitives throughout the networking transport and consensus layers (Milestones 1-4), the deployment infrastructure retains significant technical debt. Shell scripts (like `scripts/spawn_nodes.sh`), typescript configuration generators (`GenerateKeys.ts`), and unit test setups still expend computational cycles generating unneeded RSA key parameters (`.peer.pem`). Deploying the physical network requires deleting these legacy configuration commands to finalize the architectural upgrade. Eliminating unused variables ensures the execution loops do not bottleneck creating meaningless data.

---

## 2. Alternatives Considered

### Alternative A: Phased Deprecation Warnings

Maintain the legacy generation scripts and configuration parameters but inject console output warnings. For example, `scripts/spawn_nodes.sh` continues generating the `.peer.pem` files but prints a warning stating the file is no longer used by the application.

**Pros:**

- **Development Continuity:** Engineers executing outdated CLI commands or maintaining old `.env` flags do not experience abrupt command-line crashes.
- **Rollback Safety:** If a critical bug emerges in the ECDH logic requiring a temporary rollback to the old commit, the developer environments still contain valid local RSA structures.

**Cons:**

- **State Confusion:** Generating explicit cryptographic parameters that the local node never consumes confuses security audits and bloats the initialization memory limits.
- **Persistent Technical Debt:** Leaving dead code floating inside the structural pipelines prevents true optimization mapping.

### Alternative B: Complete Pipeline Eradication (Hard Cut)

Execute a sweeping purge across the entire repository. Delete the `generateRSAKeyPair` blocks from the `GenerateKeys.ts` utility. Scrub all references to `.peer.pem` from the `bash` initialization loops and test harnesses. The deployment pipeline only provisions `.evm.key` boundaries.

**Pros:**

- **Maximized Boot Performance:** Node initialization scripts run significantly faster by skipping heavy asymmetric key mathematical generation limits.
- **Repository Cleanliness:** Absolute elimination of technical debt.

**Cons:**

- **Developer Friction:** Infrastructure relying on cached genesis environments or old bash histories will face execution stop-errors, requiring a physical purge of local test directories.

---

## 3. Proposed Solution: Complete Pipeline Eradication (Hard Cut)

We adopt the hard cut approach. Maintaining dummy cryptographic logic strings inside a production codebase introduces unacceptable risk and pipeline confusion.

1. **Delete Dead Code:** Scrub `GenerateKeys.ts` to only execute ECC curve formulations.  
2. **Script Optimization:** Overhaul `spawn_nodes.sh` to remove all `.pem` parameter arguments and RSA loop initializations.
3. **Test Mocks:** Remove all mock RSA parameters across the `jest` integration suites, providing standard EVM boundaries instead.
4. **End-to-End Validation:** Run `npm test`, `tsc --noEmit`, and `eslint` to verify that purging the RSA limits does not leave orphaned imports or isolated execution blocks hanging.

By eliminating the RSA boundaries across the shell configurations, we secure the finalized refactor.

### Comparative Analysis & Conclusion

While **Alternative A** offers short-term comfort for developers habituated to old commands, retaining fake configuration variables creates a dangerous precedent inside a cryptographic application protocol. Security architectures dictate that unused cipher dependencies receive absolute deletion.

**Complete Pipeline Eradication (Alternative B)** enforces best practices. A clean repository mapping precise code patterns ensures downstream maintenance scales without domain confusion. Purging the limits forces a clean slate for the test suite resulting in faster, cleaner validations across the consensus matrix.
