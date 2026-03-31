# Phase 5: Reputation & Slashing Leaderboard Implementation Plan

The goal of this phase is to bring structural transparency to the physical storage stability of the Verimus network natively via the React UI. We will build an Audit Terminal for real-time `Proof of Spacetime` sortition telemetry and a Reputations Leaderboard mapping native node slashing records.

## Proposed Changes

### Backend Stream Architecture

#### [NEW] `route_handlers/audit_events_handler/AuditEventsHandler.ts`
- Implement a Server-Sent Event (SSE) endpoint specifically for global audits (`/api/audit/events`), mirroring the event-loop detachment logic defined in `UploadEventsHandler.ts`.
- Subscribes natively to `this.node.events.on('audit_telemetry')`.

#### [MODIFY] `apis_server/APIServer.ts`
- Ensure the new `AuditEventsHandler` is registered logically natively across the Express routing middleware.

#### [MODIFY] `peer_handlers/consensus_engine/ConsensusEngine.ts`
- In `runGlobalAudit()`, continuously `emit('audit_telemetry', { status, message, targetPeer })` indicating:
    - Node election loops (`ELECTION_INITIATED`)
    - Dispatching mathematical challenges to storage peers (`CHALLENGE_DISPATCHED`)
    - Resolving correct Merkle sibling hashes (`AUDIT_SUCCESS`)
    - Formal slashing for timed-out or invalid execution proofs (`SLASHING_EXECUTED`)

---

### React UI Cryptographic Subsystems

#### [MODIFY] `ui/src/components/Views/PeersView.jsx`
- Refactor the simple radial network view to accommodate native tabular metrics. 
- Stand up both the `ReputationLadder` and `AuditTerminal` directly within this page bounding continuous UI updates seamlessly.

#### [NEW] `ui/src/components/Views/Network/ReputationLadder.jsx`
- Construct a formal leaderboard sorting the continuous `api/peers` endpoint structurally by `score`.
- Map UI constraints applying aggressive red indicators exclusively to `SLASHED` / `BANNED` peers reliably preventing confusion.

#### [NEW] `ui/src/components/Views/Network/AuditTerminal.jsx`
- Build a dedicated `EventSource('/api/audit/events')` terminal window cleanly intercepting backend algorithmic validation routines natively.
- Force aggressive `useRef` auto-scrolling hooks pinning to the absolute bottom bounds natively matching Phase 4 implementations gracefully.

---

## Verification Plan

### Automated Tests
- Validate `npm test` verifying that the injection of global SSE strings into the ConsensusEngine does not interrupt critical deterministic sync executions natively reliably. 
- Verify strict boundaries executing `npx tsc --noEmit && npx eslint --fix` on modified backend sources perfectly natively.

### Manual Verification
- Deploy the cluster locally via `./scripts/spawn_nodes.sh --mongo`.
- Load the UI (`npm run dev`) navigating natively to the `Peers` overview explicitly.
- Confirm the `AuditTerminal` connects cleanly dynamically.
- To trace active telemetry, wait precisely for the standard exponential audit intervals to fire automatically, OR artificially accelerate epochs by injecting mock timestamps cleanly observing the matrix execution natively flawlessly!
