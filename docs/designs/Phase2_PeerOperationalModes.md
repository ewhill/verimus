# Phase 2: Peer Operational Modes & Market Configs

## Overview
This document outlines the architectural implementation for Phase 2 of Project Clementine. To securely execute a decentralized marketplace, nodes within the Verimus network can no longer behave simply as homogeneous peers. 

In this phase, we map out **Peer Operational Modes**, explicitly categorizing participant behavior into distinct logical units. Furthermore, we define the baseline integration for individual storage market-rate configurations.

## 1. Node Initialization & Operational Modes
By default, previous network topologies assumed all peers possessed identical hardware parameters and equal storage capabilities. True decentralization involves massive hardware disparities. A node must strictly advertise its capabilities to the rest of the network during the handshake phase, natively locking its computational behaviors.

### Defined Archetypes
We introduce a core state enumeration mapping node responsibilities. A single peer can operate any combination of these modes simultaneously, securely decoupling their network interactions:
```typescript
export enum NodeRole {
    ORIGINATOR = "ORIGINATOR", // Uploads files, maintains wallet funds, pays for hosting.
    VALIDATOR =  "VALIDATOR",  // Audits storage proofs, participates in mempool consensus, earns auditing rewards.
    STORAGE =    "STORAGE"     // Actively bids on hosting files. Requires a physical storage provider attached. Earns major storage rewards.
}
```

### Technical Integration
- Update `peer_node/PeerNode.ts` to consume an array or set of `NodeRole[]` properties upon invocation (`[NodeRole.ORIGINATOR, NodeRole.VALIDATOR, NodeRole.STORAGE]` by default).
- Inject the `roles` array natively into the `HandshakeMessage` and `PeerConnection` state mappings so that the network overlay understands the topology instantly.
- In `index.ts`, expose CLI overrides mapping comma-separated parameters (e.g. `--roles validator,originator`) to initialize the isolated state cleanly.

## 2. Storage Pricing API Integration
For the open market to thrive, `STORAGE` nodes must accurately price their physical abstractions. A node mapping directly to an AWS S3 bucket should structurally cost more than a node backing up data to local magnetic drives in a home lab. 

### Provider Abstraction Updates
- Update `storage_providers/base_provider/BaseProvider.ts` to statically enforce a virtual pricing parameter abstraction.
```typescript
export abstract class BaseStorageProvider {
    // ...existing methods

    /**
     * Determines the cost per Gigabyte for a 30-day billing cycle.
     * @returns Float denoting the VERI token cost.
     */
    abstract getCostPerGB(): number;
}
```
- For statically structured providers (e.g., `MemoryStorageProvider`, `LocalProvider`), we can expose hardcoded configurations inside the node's `credentials.json` environment parsing (e.g., `"localRate": 2.5`).
- For dynamic cloud providers (e.g., `S3Provider`), we stub out the logic mathematically calculating network margins, but for Phase 2, we will resolve statically declared CLI/JSON configurations across the board for simplicity.

## 3. Sandboxing & Capability Boundaries
Once a node securely dictates its `NodeRole[]`, the backend processing architecture must strictly isolate out-of-bounds execution. A node lacking the `VALIDATOR` or `STORAGE` role should effortlessly drop those execution branches.

### Required Hooks
1. **Network Discovery (`PeersHandler`)**:
   - Only nodes possessing the `NodeRole.STORAGE` flag should natively advertise raw `StorageSpaceAvailable` or `getCostPerGB()` rates inside peer discovery sequences.
2. **Consensus Restrictions (`ConsensusEngine.ts`)**:
   - During Phase 3/4 negotiation structures, a node lacking `NodeRole.STORAGE` cannot bid on hosting SLAs.
   - Disallow inbound TCP file stream endpoints if a node does explicitly omit the `NodeRole.STORAGE` configuration to prevent physical bandwidth waste or DOS exploits.

## 4. Dynamic UI Parameterization
The localized React/Vite instance must inherently reflect the active `NodeRole[]` assigned to the core engine. Operating outside of assigned modes natively clutters the UI and confuses end-users managing specialized nodes.

### Frontend Role Guards
- **Inject Role Status Endpoint:** Expose a native API route (e.g. `GET /api/status`) returning `{ roles: ["ORIGINATOR", "STORAGE"] }`.
- **Zustand State Mapping:** Hydrate a globally reactive Zustand property `useNodeState((state) => state.roles)` upon application mount.
- **Conditional Routing:** 
  - Hide the `/upload` route and "Upload File" navigation buttons entirely if `NodeRole.ORIGINATOR` is missing.
  - Introduce a dedicated `/contracts` route (Active Contracts) dynamically mapping hosted chunks and `getCostPerGB()` statistics internally; hide this route entirely if `NodeRole.STORAGE` is missing.
  - Expose deep `/consensus` (Consensus Monitor) metrics solely if `NodeRole.VALIDATOR` is assigned, preventing regular originators from being overwhelmed with complex voting telemetry.

## 5. Implementation Checklist
- [ ] Define `NodeRole` mapped enum in `types/index.d.ts`.
- [ ] Implement `roles[]` argument tracking natively inside `PeerNode.ts` parameter sets.
- [ ] Thread `roles[]` mapping recursively through P2P Handshake routines.
- [ ] Append virtual `getCostPerGB()` parameter abstractions across all existing physical `StorageProviders`.
- [ ] Expose an API endpoint returning the active node configuration state securely.
- [ ] Configure Zustand tracking and Route Guards inside the `/ui` application structurally matching available roles.
- [ ] Expose Node initialization CLI flags explicitly establishing the selected archetypes upon application boot seamlessly.
