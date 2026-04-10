# Poncho Phase 3: Secure Contracts & Erasure Shard Explorer

This blueprint explicitly governs the UI execution of Phase 3, mapping the decentralized storage negotiation mechanics organically to the frontend.

## Proposed Changes

### Backend Operations
#### [NEW] [route_handlers/upload_events_handler/UploadEventsHandler.ts](../../route_handlers/upload_events_handler/UploadEventsHandler.ts)
- **Context:** `UploadHandler.ts` currently blocks the HTTP connection synchronously, hiding the internal P2P marketplace negotiation from the client.
- **Action:** 
  1. Build an Express Server-Sent Events (SSE) mechanism (`GET /api/upload/events`).
  2. Map incoming connections to `this.node.events.on('upload_telemetry', ...)` dynamically.
  3. Flush `data: {...}\n\n` payloads natively resolving cross-boundary CORS constraints.

#### [MODIFY] [route_handlers/upload_handler/UploadHandler.ts](../../route_handlers/upload_handler/UploadHandler.ts)
- **Context:** The file execution loop runs `syncEngine.orchestrateStorageMarket` without telemetry.
- **Action:** 
  1. Emit `upload_telemetry` events at key intervals: `MARKET_INITIATED`, `BID_RECEIVED` (with explicit `$VERI` cost strings), and `SHARDS_DISPATCHED`.
  2. Embed the completed `fragmentMap` directly into the final `202 Accepted` JSON return payload.

#### [MODIFY] [api_server/ApiServer.ts](../../api_server/ApiServer.ts)
- Mount `app.get('/api/upload/events', new UploadEventsHandler(peerNode).handle);` gracefully.

### Frontend Overhaul
#### [MODIFY] [ui/src/components/Views/UploadView.jsx](../../ui/src/components/Views/UploadView.jsx)
- **Action:** 
  1. Before executing `fetch('/api/upload')`, open a native `new EventSource('/api/upload/events')` binding.
  2. Intercept `BID_RECEIVED` metrics and construct an animated "Negotiation Terminal" matrix illustrating active market node proposals dynamically above the upload form!
  3. Safely `source.close()` upon `202 Accepted` resolution.

#### [NEW] [ui/src/components/Views/FilesView/ShardGraph.jsx](../../ui/src/components/Views/FilesView/ShardGraph.jsx)
- **Action:** 
  1. Construct a React geometric component that parses an Array of `fragmentMap` objects.
  2. Dynamically draw connected nodes representing `$K / $N` geographic fragment redundancy paths gracefully.

#### [MODIFY] [ui/src/components/Views/FilesView/FilesView.jsx](../../ui/src/components/Views/FilesView/FilesView.jsx)
- **Action:** 
  1. Inject the `<ShardGraph />` component onto active file selections, allowing users to physically verify the exact P2P boundaries housing their encrypted data chunks!

## Verification Plan

### Automated Tests
- Syntax compile (`npx tsc --noEmit`) to ensure the `UploadEventsHandler` executes safely without Type conflicts.

### Manual Verification
- Spin the local Testnet cluster via `./scripts/spawn_nodes.sh --mongo`.
- Open `https://localhost:26780` and upload a file.
- Verify the active `$VERI` pricing negotiations stream dynamically during the wait state, and verify the `ShardGraph.jsx` topology immediately displays upon success.
