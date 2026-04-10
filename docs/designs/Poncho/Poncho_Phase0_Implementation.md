# Poncho Phase 0: Network Mesh & Discovery Visualizer

The absolute goal of this phase is to upgrade the `Verimus` React/Vite front-end to visually articulate the backend Phase 0/0b architecture: Epidemic Routing (Gossip Protocol), Peer Exchange (PEX), and Permissionless Transport. 

This plan is explicitly formulated so an isolated AI Agent can execute the bounds sequentially utilizing strictly local context correctly.

## Proposed Changes

### Backend Telemetry Extractor
#### [MODIFY] [PeersHandler.ts](../../route_handlers/peers_handler/PeersHandler.ts)
- **Context:** The frontend inherently relies on `GET /api/peers`.
- **Action:** Before building the UI layer, investigate if the handler explicitly returns Epidemic Routing telemetry. You must augment the JSON payload to include:
  1. The global `messageCache` size (reflecting LRU dropped tracking).
  2. The configured maximum socket limit.
  3. Individual peer flags tracking whether they were mapped via active *Discovery (PEX)* vs native *Bootstrap*.

### Frontend Application Layer
#### [MODIFY] [api.js](../../ui/src/services/api.js)
- Update the internal polling boundaries to parse the newly mapped `gossipTelemetry` objects retrieved by the backend modifications above securely. Bridge this JSON state cleanly through the Zustand `store`.

#### [NEW] [GossipStatsPanel.jsx](../../ui/src/components/Views/Network/GossipStatsPanel.jsx)
- Formulate a brand new aesthetic component specifically displaying network engine health:
  - **Metrics:** Total Messages Cached, Epidemic TTL Bounds, and active connection saturation.
  - **Design:** Rely strictly on the preexisting standard `glass-panel` div classes avoiding unapproved CSS frameworks (Tailwind is disallowed).

#### [MODIFY] [PeersView.jsx](../../ui/src/components/Views/PeersView.jsx)
- **Context:** Currently maps a static radial array parsing `peer.status`.
- **Action:** Refactor the internal HTML5 `<canvas>` render loop explicitly:
  - **Animation Injection:** Synthesize particle animations or dynamic pulsing vectors bouncing between interconnected bounds visualizing active message propagation (`NetworkHealthSyncMessage` strikes).
  - **Layout:** Integrate the new `GossipStatsPanel.jsx` component seamlessly into the DOM mapping.

## Verification Plan

### Automated Tests
- Execution of `npm test` natively to ensure the augmented `PeersHandler.ts` returns passing bounds structurally inside `PeersHandler.test.ts`.
- Complete execution of `npm run build:ui` guaranteeing formal JSX React component mappings compile perfectly without import collisions!

### Manual Verification
- A user or browser testing agent will execute `./scripts/spawn_nodes.sh --mongo`.
- Visually inspect the local HTTPS instance at `https://localhost:26780/peers`.
- Assert the canvas physically pulses mapping virtual boundaries organically bridging connections via Epidemic TTLs correctly.
