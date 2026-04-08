# Project Bandana: Milestone 2 Task Breakdown

**Market Negotiation & Storage Quota Orchestration**

This document details the exact execution steps required to upgrade the localized P2P marketplace to cleanly parse, estimate, and structurally validate chronological "Rest-Toll" limits organically.

---

## Task 1: Extend Storage Market Protocol Models

**Scope**: Update the WebSocket protocol classes securely negotiating limit orders natively.
**Instructions**:

- Locate `messages/storage_market_request_message/StorageMarketRequestMessage.ts`.
- Expand the message schema and property bindings to explicitly include two properties: `targetDurationBlocks: number` and `allocatedRestToll: string` (stringified to prevent precision loss across TCP buffers).
- Update the class constructor and internal parsing/validation utilities matching the exact EIP-712 mappings logically.
**Testing**:
- Update `messages/test/StorageMarketRequestMessage.test.ts`. Initialize a payload mapping chronological limits and test successful signature generation parsing the variables.

---

## Task 2: Upload Handler Rest Toll Orchestration

**Scope**: Update the REST API endpoint allocating explicitly bounded escrow limits using block timelines.
**Instructions**:

- Locate `route_handlers/upload_handler/UploadHandler.ts`.
- Add parsing for the HTTP parameter `req.body.targetDurationHours`. Fallback dynamically to `24` hours if omitted.
- Compute the `targetDurationBlocks` natively utilizing the formula: `(targetDurationHours * 3600 * 1000) / AVERAGE_BLOCK_TIME_MS`.
- Compute physical byte size restrictions formulating exactly how much `allocatedRestTollWei` is required based on the theoretical byte size and `this.node.config.pricing.restTollPerGBHour` (defaulting cleanly to `1.5` wei if unconfigured).
- Map mathematical allocations: `freezeFunds` must now include the calculated chronological escrow dynamically alongside the `startBlockHeight` and `expirationBlockHeight = currentHeight + targetDurationBlocks`.
- Execute `orchestrateStorageMarket` forwarding these explicit variables definitively.
**Testing**:
- Update `UploadHandler.test.ts`. Initialize a localized mocked API `POST` configuring `targetDurationHours = 10`. Assert the mock `walletManager.freezeFunds` executes the logical boundaries mapping natively parsed chronologies correctly.

---

## Task 3: SyncEngine Broadcast Modifications

**Scope**: Update the internal P2P sync logic managing decentralized market bid distributions.
**Instructions**:

- Locate `peer_handlers/sync_engine/SyncEngine.ts` and focus on the `orchestrateStorageMarket` method.
- Update the function arguments to accept `targetDurationBlocks` and `allocatedRestTollWei`.
- When constructing the outgoing `StorageMarketRequestMessage`, inject these precise chronological barriers directly into the TCP payload.
**Testing**:
- Add matching parameters to `SyncEngine.test.ts` internal calls asserting the outgoing WebSocket buffer successfully hashes the limits perfectly.

---

## Task 4: Originator & Host Bidding Validation Hooks

**Scope**: Ensure targeted physical peers inherently evaluate and decline market limits failing minimum pricing.
**Instructions**:

- Locate the receiver sequence for `StorageMarketRequestMessage` natively bound inside `SyncEngine.ts` (the `.bind(StorageMarketRequestMessage)` block).
- Calculate the physical constraints securely using the incoming limit: `expectedMinimumRestToll = (incomingSizeGB * config.restTollPerGBHour * targetDurationHours)`.
- If the incoming `allocatedRestToll` is strictly lesser than the `expectedMinimumRestToll`, the host MUST terminate the handler early (`return;` or log standard warning), passively suppressing an outbound `StorageMarketResponseMessage` and efficiently dropping the bid request.
**Testing**:
- In `SyncEngine.test.ts`, implement two chronological tests mapping the reception hook. Pass a mock `StorageMarketRequestMessage` with a valid high payout executing organically, and pass a second strictly underpaid toll payload confirming the sequence terminates returning null/undefined safely.
