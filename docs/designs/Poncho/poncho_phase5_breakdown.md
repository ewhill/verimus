# Phase 5: Reputation & Slashing Leaderboard Implementation Plan

The goal of this phase is to bring structural transparency to the physical storage stability of the Verimus network natively via the React UI. We will build an Audit Terminal for real-time `Proof of Spacetime` sortition telemetry and a Reputations Leaderboard mapping native node slashing records.

### Status Update
The core backend parity mechanisms (sortition math audits, `SLASHING_TRANSACTION` blocks, and SSE `/api/audit/events`) are already fully operational within `ConsensusEngine` and `ApiServer.ts`. Additionally, the frontend React components (`AuditTerminal.jsx` and `ReputationLadder.jsx`) have been successfully drafted.

**Remaining Task Focus:** Resolving Phase 5 requires restructuring the frontend display so these components function as dedicated, scalable diagnostic feeds embedded natively as toggleable sub-tabs within the Network overview.

## Proposed Changes

### UI & Architecture Structuring

#### [MODIFY] `ui/src/components/Views/PeersView.jsx`
- Introduce a segmented control (sub-tab) architecture directly inside the `PeersView` leveraging local React state. This neatly breaks the monolithic layout into three distinct rendering modes seamlessly toggled by the user:
    1. **Network Mesh**: Renders the `<canvas>` Epidemic Visualizer and `GossipStatsPanel`.
    2. **Global Reputation**: Exclusively renders the `ReputationLadder` in a full-width layout securely highlighting Slashed/Banned nodes natively.
    3. **Sortition Audits**: Exclusively renders the `AuditTerminal` to comfortably map real-time proof-of-spacetime WebSocket pipelines horizontally.

#### [MODIFY] `ui/src/components/Views/Network/ReputationLadder.jsx`
- **Grid Optimization**: Adjust internal CSS/grid constraints so that when the component is governed by the new tabs and natively assigned full page width, tracking cards naturally expand and gracefully align to fill the newly divested space without defaulting to narrow minimal columns.

---

## Verification Plan

### Automated Tests
- Run the complete test suite utilizing `npm test` natively to ensure no backend structural dependencies or telemetry interfaces have regressed.
- Specifically ensure the test runner passes (`0` coverage errors or bounds breaks) confirming that UI file modifications didn't trip static TypeScript constraints (`npx tsc --noEmit && npx eslint --fix`).

### Manual Verification
- Deploy the cluster locally via `./scripts/spawn_nodes.sh --mongo`.
- Load the UI (`npm run dev`) navigating to the `Peers` overview explicitly.
- Validate the new segmented tabs inside the browser UI Network tab.
- Toggle between the "Sortition terminal" and "Mesh" confirming that WebSocket telemetry channels dynamically map and scroll correctly without overlapping the canvas render.
