# Phase 6: Epoch Metrics & Ledger Health Tests

The goal of this phase is to finalize the continuous state constraints UI tracking the MongoDB execution bounds (Epochs). While the structural components (`EpochTelemetryWidget.jsx`, `LedgerMetricsHandler.ts`) have been integrated into the `main` branch, we must wrap up the architectural implementation by properly anchoring the backend API tests and adding robust checkpoint filtering to the UI.

## Proposed Changes

### Backend Route Controllers

#### [NEW] `route_handlers/ledger_metrics_handler/test/LedgerMetricsHandler.test.ts`
The backend `LedgerMetricsHandler.ts` lacks a dedicated test harness. We must build a test suite to validate it.
- Initialize `node:test` and `node:assert`.
- Construct isolated mocked environments utilizing `createMock<Request>` and `createMock<Response>`.
- Stub the `this.node.ledger.getLatestBlock()` call to return deterministic block payloads.
- Stub `this.node.ledger.collection.stats()` to cleanly mock `{ storageSize: 4096 }` simulating continuous MongoDB bytes.
- Assert that `res.json` accurately packages `currentIndex`, `epochSize`, and `databaseFootprintBytes` with `success: true`.
- Validate that failed MongoDB connection drops gracefully return error states `{ success: false }`.

### React UI Cryptographic Subsystems

#### [MODIFY] `ui/src/components/Views/LedgerToolbar.jsx`
- Add a highly visible toggle (similar to the "My Blocks" toggle) designated for **"Checkpoints"**.
- Hook this toggle into the `filterCheckpoints` Zustand state pattern (requires updating `store.js` or utilizing existing parameters if available) to filter native blockchain elements by `BLOCK_TYPES.CHECKPOINT`.
- This precisely resolves the design requirement "dropping global Checkpoint constraints into dynamic metric parameters" mapping historical memory prunings natively.

## Review Required
- Is implementing the `Checkpoints` filter inside `LedgerToolbar.jsx` aligned with your vision for exploring structural block history?
- Shall we move `filterCheckpoints` into a direct API query (e.g., `?type=CHECKPOINT`) rather than purely local frontend state filtering?

## Verification Plan

### Automated Tests
- Execute `npm test` natively guaranteeing 100% coverage across the new `LedgerMetricsHandler.test.ts`. 
- Ensure `npx tsc --noEmit && npm run lint --if-present` evaluates flawlessly across the updated components inherently.

### Manual Verification
- Deploy the MongoDB cluster via `./scripts/spawn_nodes.sh --mongo`.
- Visit `http://localhost:5173/ledger` and confirm the `Checkpoints` UI filter properly displays Epoch block thresholds natively.
