# Poncho Phase 2: Node Console & Storage Marketplace

This blueprint governs the sequential implementation parameters for creating dynamic local node execution configurations. It explicitly directs Agents mapping frontend modal overlays into newly bounded backend POST mutations securely.

## Proposed Changes

### Backend Operations
#### [MODIFY] [storage_providers/base_provider/BaseProvider.ts](file:///Users/erichill/Documents/Code/verimus/storage_providers/base_provider/BaseProvider.ts)
- **Context:** The `getCostPerGB()` and `getEgressCostPerGB()` methods are currently `abstract` returning static hardcoded floats across sub-classes.
- **Action:** 
  1. Remove `abstract` constraints from the cost getters. 
  2. Implement local protected state variables `protected costPerGB: number = 1.5;` and `protected egressCostPerGB: number = 0.0;`.
  3. Create setters `public setCostPerGB(cost: number)` and `public setEgressCostPerGB(cost: number)` natively allowing hot-swapping.
  4. Ensure sub-classes (like `LocalFileStorageProvider.ts`) drop their rigid overrides returning to the dynamic base definitions seamlessly.

#### [NEW] [route_handlers/node_config_handler/UpdateNodeConfigHandler.ts](file:///Users/erichill/Documents/Code/verimus/route_handlers/node_config_handler/UpdateNodeConfigHandler.ts)
- **Context:** Currently, `/api/node/config` only mounts a GET resolver statically.
- **Action:** Create a matching `UpdateNodeConfigHandler` enforcing a `POST` definition. 
  0. **SECURITY REQUIREMENT:** Explicitly verify `req.ip` evaluating strictly against `127.0.0.1`, `::1`, or `::ffff:127.0.0.1`. Automatically reject foreign modifications mapping `403 Forbidden` protecting dynamic pricing from external exploit vectors.
  1. Destructure `{ roles, costPerGB, egressCostPerGB }` from `req.body`.
  2. Map the validated `roles` array (e.g. `['STORAGE', 'VALIDATOR']`) directly to `this.node.roles`.
  3. If `this.node.storageProvider` exists, pass the exact cost bounds securely triggering `setCostPerGB(costPerGB)` and `setEgressCostPerGB(egressCostPerGB)`.
  4. Bind this securely via `app.post('/api/node/config', new UpdateNodeConfigHandler(peerNode).handle)` inside `api_server/ApiServer.ts`.

### Frontend Overhaul
#### [NEW] [ui/src/components/Modals/NodeConfigModal.jsx](file:///Users/erichill/Documents/Code/verimus/ui/src/components/Modals/NodeConfigModal.jsx)
- **Component Design:** Build an interactive `glass-panel` overlay bridging local configurations.
  - **Mount Lifecycle:** Query `GET /api/node/config` caching active `roles` and `storageConfig` bounds flawlessly.
  - **Inputs:** Implement clean native checkbox toggles mapping the `STORAGE`, `ORIGINATOR`, and `VALIDATOR` strings.
  - **Financial Setters:** Inject numerical input fields dynamically allowing modifications to the exact `$VERI` cost constraints explicitly.
  - **Save Sequence:** Executing `<button>Apply Configurations</button>` initiates an authenticated `POST /api/node/config` overriding the background instances securely.

#### [MODIFY] [ui/src/components/Layout/Header.jsx](file:///Users/erichill/Documents/Code/verimus/ui/src/components/Layout/Header.jsx)
- Map the global `0x...` Identity block (`<div className="logo-titles">`) securely assigning an `onClick` parameter mounting the exact `NodeConfigModal.jsx` natively onto the UI!

## Verification Plan

### Automated Tests
- Validate pure strict typing bounds maintaining `npx tsc --noEmit` locally across the `UpdateNodeConfigHandler` execution pipelines seamlessly.

### Manual Verification
- Spin the underlying cluster via `./scripts/spawn_nodes.sh --mongo`.
- Navigate identically into Chrome clicking the Active Node `0x...` signature opening the newly drafted UI modal structurally. 
- Overwrite local storage limitations mapping `5.5 $VERI` locally confirming explicit backend preservation organically updating upon browser refreshes natively!
