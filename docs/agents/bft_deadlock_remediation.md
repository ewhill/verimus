# Root Cause Diagnosis

The overnight node crash and UI unresponsiveness was fundamentally caused by two intertwining deadlocks within `BftCoordinator.ts`:

1. When `handleProposeFork` fails to find an eligible block inside its internal memory loop, it aborts but leaves `computedBlocks` initialized as an empty array `[]`.
2. As a consequence, `handleAdoptFork` bypasses the falsy check (`if (forkEntry && forkEntry.computedBlocks)`) because an empty array is inherently truthy. This mistakenly prompts `this._commitFork()` execution prior to the final block mapping natively.
3. `_commitFork()` correctly aborted when discovering the empty array structure via `if (!settledEntry || !forkEntry || !forkEntry.computedBlocks || forkEntry.computedBlocks.length === 0)`, BUT this logic natively intercepted the process *after* `this.committing = true` was assigned!
4. The node's BFT execution loop would become permanently locked as `this.committing` could never return to `false`, effectively stalling the network synchronously offline. The API would be unable to properly advance the ledger.

# Checklist

- [x] Analyze `watch_node_PORT.log` logs capturing the `TypeError: Cannot read properties of undefined (reading 'previousHash')` mismatch bounds.
- [x] Protect `_commitFork` early-return loops by asserting `computedBlocks.length === 0` strictly prior to locking `this.committing = true`.
- [x] Fortify `handleAdoptFork` by asserting `computedBlocks.length > 0` directly forcing the `pendingCommit` deferral flow natively.
- [x] Validate syntax constraints implicitly using `npx tsc --noEmit`.
- [x] Execute linting via `npx eslint --fix`.
- [x] Enforce node unit/integration testing loops using `npm test`.
- [ ] Commit resolving bounds using `#BFTDeadlockRemediation`.
