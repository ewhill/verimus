# Grapevine Phase 6: Dynamic Originator Markets

This phase introduces **Dynamic Originator Markets** to the Verimus proxy architecture. Instead of hardcoding a mechanical 5% broker fee universally across the network, Originating Proxy Nodes (Gateways) will be able to dictate their own `proxyBrokerFee` dynamically via their node configuration. 

This fee will be embedded natively into the `StorageContractPayload` at the point of origin, and the UI will explicitly parse the Node's active configuration prior to upload, allowing the user to seamlessly authorize the fee natively in their Web3 Identity signature or shop for a more competitive node dynamically.

## Design Decisions

> [!NOTE]
> **Trustless Proxy Shopping (Multi-Node Polling & Sybil Protection)**
> Because a single entry node could maliciously collude (Sybil attack) by lying about the network rates or emitting a fake `/api/peers` list exclusively pointing to nodes it controls, we will adopt a **Multi-Bootstrap Staked Polling** model:
> 1. The React UI inherently boots with a hardcoded list of multiple independent Bootstrap Nodes (e.g. `REACT_APP_BOOTSTRAP_NODES`).
> 2. The UI queries these bootstrap nodes simultaneously for their `/api/peers` lists and intersects the results, ensuring no single node controls the topology map.
> 3. To explicitly guarantee the peers are genuine and not cheap Sybil clones, the UI cross-references the peers against the Ledger's active `STAKING_CONTRACT` validators. Any peer without a valid, mathematically staked history on the ledger is dropped.
> 4. The UI independently executes direct, client-side HTTP Pings (`/api/node/config`) to a random subset of these *verified* peers.
> 5. The UI dynamically routes the user to the verified peer advertising the lowest `proxyBrokerFee`.

> [!IMPORTANT]
> **Consensus Sane Maximums**
> To prevent network extortion, the `ConsensusEngine` will structurally reject any `STORAGE_CONTRACT` block where the Originator node embeds a `brokerFeePercentage` greater than `0.15` (15%). This ceiling allows healthy competitive undercutting down to `0.01` while capping the maximum network tax mechanically.

## Proposed Changes

---

### config & peer_node

#### [MODIFY] [peer_node/PeerNode.ts](../../peer_node/PeerNode.ts)
*   **Dynamic configuration:** Integrate a new `proxyBrokerFee` property natively into the `PeerNode` logic. Allow nodes to pass this as a constructor variable defaulting implicitly to `0.01` (1% markup), as origination is a lightweight process computationally.
*   **Originator Staking Boot Sequence:** Because Originators must now hold a valid `STAKING_CONTRACT` constraint to pass Consensus bounds, `PeerNode.ts` must execute an explicit orchestration loop during `init()`. If the Node contains the `NodeRole.ORIGINATOR` role, it will structurally mint and broadcast a `STAKING_CONTRACT` payload (locking $VERI collateral) to the network, verifying its network identity securely directly on boot.

#### [MODIFY] [route_handlers/node_config_handler/NodeConfigHandler.ts](../../route_handlers/node_config_handler/NodeConfigHandler.ts)
*   Surface the active Node's `proxyBrokerFee` visually through the `/api/node/config` REST mapping allowing the UI to instantly calculate Limit Order boundaries efficiently.

### payload & wallet_manager

#### [MODIFY] [types/index.d.ts](../../types/index.d.ts)
*   Inject an optional `brokerFeePercentage?: number` attribute explicitly onto the `StorageContractPayload` TypeScript boundaries.

#### [MODIFY] [route_handlers/upload_handler/UploadHandler.ts](../../route_handlers/upload_handler/UploadHandler.ts)
*   Dynamically enforce tracking the node's individual `this.node.proxyBrokerFee` natively, embedding it explicitly into the `StorageContractPayload` during file assimilation. 

#### [MODIFY] [wallet_manager/WalletManager.ts](../../wallet_manager/WalletManager.ts)
*   Locate the legacy `const findersFee = Math.max(0.000001, escrowToDeduct * 0.05);` mathematical bounds inside the `commit` limit orders.
*   Transition this algorithm dynamically: `const feeRate = p.brokerFeePercentage ?? 0.01;` ensuring correct limits are applied independently based off isolated `StorageContractPayload` boundaries.

### frontend components

#### [MODIFY] [ui/src/services/api.js](../../ui/src/services/api.js) | [ui/src/components/Modals/UploadModal.jsx](../../ui/src/components/Modals/UploadModal.jsx)
*   **Market Discovery:** Implement a routine in the UI that fetches `ApiService.getPeers()`, iterates over the returned peer IPs, and queries their external `node/config` endpoints directly to find the lowest `proxyBrokerFee`.
*   **Dynamic Re-routing:** Allow the user to select or automatically auto-route to the cheapest Originator by switching the frontend's underlying REST `baseUrl`.
*   **Visual Transparency:** Document the exact proxy markup fee securely in `UploadModal.jsx` before submitting the payload, highlighting both the Storage Cost and Originator Fee clearly.

### consensus_engine

#### [MODIFY] [peer_handlers/consensus_engine/ConsensusEngine.ts](../../peer_handlers/consensus_engine/ConsensusEngine.ts)
*   **Sane Maximums:** Enforce a hard max ceiling inside `handlePendingBlock` (or equivalent validations for `STORAGE_CONTRACT`): block `STORAGE_CONTRACT` formations dynamically if `payload.brokerFeePercentage > 0.15`.
*   **Proof-of-Stake Originator Validation:** Implement industry-standard Sybil protection by explicitly querying the `WalletManager` (or Ledger's active contract mappings) to verify the Originator (`block.publicKey`) holds a valid, mathematically locked `STAKING_CONTRACT` before permitting them to broker a `STORAGE_CONTRACT`. If unstaked, the block is rejected.

## Open Questions

None currently. The plan represents an industry-standard Proof of Stake and Multi-Polling topography. Implementation is ready!

## Verification Plan

### Automated Tests
*   Update `WalletManager.test.ts` to natively mock varying `brokerFeePercentage` definitions across contracts globally confirming the exact numerical balance escrow mappings trigger cleanly matching competitive extraction rates cleanly!

### Manual Verification
*   Boot network seamlessly assigning diverse configuration properties for `Node B` and `Node C`.
*   View the React frontend `UploadModal.jsx` natively confirming the API exposes the localized Proxy configuration natively!
