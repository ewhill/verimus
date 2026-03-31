# Phase 6: Core Ledger Health & Epoch Metrics Implementation Plan

The goal of this final UI phase is to visualize the $O(1)$ continuous state constraints of the Verimus engine, explicitly highlighting database execution efficiencies and checkpointing memory-pruning mechanics natively.

## Proposed Changes

### Backend Metrics API

#### [NEW] `route_handlers/ledger_metrics_handler/LedgerMetricsHandler.ts`
- Construct a new dedicated endpoint mapping current runtime capacity.
- Query `this.node.ledger.getLatestBlock()` natively to isolate the current `block.metadata.index`.
- Use `this.node.ledger.collection.stats()` to extract the physical byte `storageSize` of the MongoDB footprint representing real-time disk consumption.

#### [MODIFY] `api_server/APIServer.ts`
- Expose the new endpoint natively at `app.get('/api/ledger/metrics', new LedgerMetricsHandler(peerNode).handle)`.

### React UI Cryptographic Subsystems

#### [MODIFY] `ui/src/components/Views/LedgerView.jsx`
- Import and mount the newly created `EpochTelemetryWidget` at the top of the interface natively.
- Adjust grid styling bounding the widget symmetrically above the historical block list gracefully.

#### [MODIFY] `ui/src/components/Views/Ledger/LedgerToolbar.jsx`
- (Or create if inline) Adapt the static toolbar mapping dropping global Checkpoint constraints into dynamic metric parameters safely.

#### [NEW] `ui/src/components/Views/Ledger/EpochTelemetryWidget.jsx`
- Construct an advanced analytics widget natively polling `/api/ledger/metrics`.
- Implement a graphical progress bar visually demonstrating exactly where the network mathematically resides before triggering the catastrophic `O(1)` memory pruning thresholds (evaluating `(currentIndex % 1000000) / 1000000 * 100`).
- Display live physical MongoDB disk allocations natively tracking the bytes utilized.

## Verification Plan

### Automated Tests
- Build test definitions validating metric retrieval gracefully checking database bindings natively.
- Execute `npm test` organically preventing syntax boundaries gracefully. 
- Ensure `npx tsc --noEmit && npx eslint --fix` evaluates flawlessly across the updated components inherently.

### Manual Verification
- Deploy the MongoDB cluster securely via `./scripts/spawn_nodes.sh --mongo`.
- Visit `http://localhost:5173/ledger`.
- Verify the injected `EpochTelemetryWidget` securely maps physical MongoDB bounds tracking the latest tip natively seamlessly structurally.
