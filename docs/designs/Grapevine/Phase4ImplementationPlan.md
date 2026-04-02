# Grapevine Phase 4: Consensus Engine & Escrow (Proxy Staking)

This phase finalizes the backend proxy framework established in Phase 3 by introducing Dual-Escrow Proxy locks natively within the `WalletManager` and `ConsensusEngine`. The originator proxy architecture safely delegates user workloads to backend operators, but it poses a spam/Sybil attack vulnerability if nodes can freely submit shards on behalf of random EIP-191 signatures without consequence limit bounds. To resolve this organically, we will concurrently freeze limit bounds from *both* the EIP-191 user balance and the RSA node proxy limits. 

## User Feedback Addressed

> [!TIP]
> **Tokenomics Correction Applied**: Based on your feedback ("The contract should release the originator node's funds once the storage nodes have been identified, at which point the storage nodes themselves should move funds into escrow..."), the plan has been formally revised.
> 
> *   **Originator Temporary Escrow**: The Originator Node will still temporarily freeze funds identically to the user during the HTTP upload pipeline to prevent Gateway spam requests, but this lock will uniquely evaporate unconditionally post-settlement instead of slashing permanently.
> *   **Finder's Fee Compensation (Analytically Revised)**: The Originator Node processes intense mathematical burst-workloads (Reed-Solomon erasure compilation, Merkle tree construction, and ingress/egress transit multiplexing). However, they do *not* bear the multi-year liability of persistent physical storage space. 
>     *   A structurally bound 10% fee implies proxy burst-logic holds disproportionately high value relative to lifetime disk persistence limits. 
>     *   **Revision**: We will implement a strict **5%** Finder's Fee mathematically. This conservatively covers bandwidth/compute costs organically without overtly penalizing long-term storage operators dynamically.
>     *   *Future Architecture Note*: This flat 5% baseline establishes the foundation for Phase 6 dynamic markets, where proxy nodes explicitly advertise their unique `proxyBrokerFee` over the P2P Gossip protocol allowing Users to select Originators competitively.
> *   **Storage Node Collateral Hooks**: When the `STORAGE_CONTRACT` block finalizes, the system will deduct the user's `allocatedEgressEscrow`, but explicitly deduct an equivalent collateral array mathematically bounded proportionally from *each* resolving Storage Node (`fragmentMap[i].nodeId`)!

> [!WARNING]
> **API Structure Change:** `frozenEscrows` currently maps `Map<string, { peerId: string; amount: number }>` which maps a single limit to a single `requestId`. We must refactor this to `Map<string, { peerId: string; amount: number }[]>` to allow dual-participant locks physically using the identical underlying `requestId`.

## Proposed Changes

--- 

### wallet_manager/WalletManager.ts

#### [MODIFY] [WalletManager.ts](file:///Users/erichill/Documents/Code/verimus/wallet_manager/WalletManager.ts)
*   **Refactor `frozenEscrows` structure:** Change `frozenEscrows` from `Map<string, { peerId: string; amount: number }>` to `Map<string, { peerId: string; amount: number }[]>`.
*   **Update Limit Modifiers:** 
    *   Update `freezeFunds(peerId, amount, requestId)` to append identically to the array instead of overwriting mathematically. 
    *   Update `releaseFunds(requestId)` and `commitFunds(requestId)` boundaries to natively wipe array keys precisely as they currently execute correctly.
    *   Update `calculateBalance(peerId)` to iterate mathematically aggregating multiple limit iterations explicitly.
*   **Modify `updateIncrementalState`:** Inside the `BLOCK_TYPES.STORAGE_CONTRACT` hook natively:
    *   Deduct `escrowToDeduct` bounds directly from the `p.ownerAddress`.
    *   Calculate a `findersFee` organically (strictly clamped at `5%` of the total contract cost bounds). Deduct this strictly out of the `p.ownerAddress` identically, and **MINT** or deposit this directly to the originating proxy (`block.publicKey`).
    *   Iterate across `p.fragmentMap` natively, deducting a mathematically uniform `(escrowToDeduct / fragmentMap.length)` staking requirement strictly out of every individual Storage Node (`nodeId`) resolving contract matrices.

---

### peer_handlers/consensus_engine/ConsensusEngine.ts

#### [MODIFY] [ConsensusEngine.ts](file:///Users/erichill/Documents/Code/verimus/peer_handlers/consensus_engine/ConsensusEngine.ts)
*   **Expand validations bounds in `handlePendingBlock`:**
    *   Add a mathematical hook natively evaluating `BLOCK_TYPES.STORAGE_CONTRACT`.
    *   Assert `this.walletManager.verifyFunds(block.payload.ownerAddress, block.payload.allocatedEgressEscrow)`.
    *   Assert that every identical boundary mathematically resolves natively using `verifyFunds(fragment.nodeId, shardCollateral)` across all active storage operators identified organically.
    *   If bounds evaluate false inherently, cleanly log rejection messages and terminate processing dropping Sybil bounds quickly.

---

### route_handlers/upload_handler/UploadHandler.ts

#### [MODIFY] [UploadHandler.ts](file:///Users/erichill/Documents/Code/verimus/route_handlers/upload_handler/UploadHandler.ts)
*    **Refactor Initial Balance Validations:**
     *   Assert identically strict `await this.node.consensusEngine.walletManager.verifyFunds(ownerAddress, theoreticalMaxCost * 1.05)` dynamically terminating with 402 traces seamlessly natively capturing the 5% finder's fee markup logically. 
*    **Dual Temporary Hooks:**
     *   Invoke `freezeFunds(ownerAddress, theoreticalMaxCost * 1.05, marketReqId)` identically executing alongside `freezeFunds(this.node.publicKey, theoreticalMaxCost, marketReqId)`. Both temporary boundaries organically release globally upon finalization.

## Open Questions

> [!NOTE]
> *Integration Overrides*: During `CriticalUserJourneys` or `LoadStress.test.ts`, the user wallet `ownerAddress` is mocked continuously physically natively generating new EIP-191 signatures randomly each stream iteration. This proxy EIP-191 account will theoretically have 0 `$VERI` bounds. Does the `verifyFunds` mock intercepting `WalletManager.verifyFunds = async () => true;` globally solve this implicitly, or should we mint synthetic balances to the mock `ethers.Wallet` limits?

## Verification Plan

### Automated Tests
- Run `npm test` observing `UploadHandler.test.ts` cleanly wrapping the dual checks sequentially simulating 400 exceptions naturally.
- Explicitly evaluate `CriticalUserJourneys.test.ts` organically executing dual limit bounds gracefully natively over the mock intercepts mapping exact limit resolutions successfully.

### Manual Verification
- Deploying the backend inside `spawn_nodes.sh`, opening Chrome, mapping Metamask cleanly evaluating tokenomics dynamically, asserting exact symmetric deductions logically post settlement executing!
