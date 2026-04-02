# Grapevine Phase 3: Backend Gateway (Originator Role)

Phase 3 transitions the Verimus node's underlying `UploadHandler.ts` to authenticate natively against standard Ethereum cryptographic executions. Instead of treating the Node Operator as the sole owner of data matrices, the Node acts as an "Originator Proxy" verifying real-world Web3 physical bounds before committing Shard execution sequences to the global network natively.

## User Review Required

> [!WARNING]
> By shifting ownership to the `ownerAddress` derived from the EIP-191 signatures dynamically, should we explicitly isolate this verification step *before* any Shard matrices are processed mathematically? (i.e. rejecting invalid Web3 signatures via 401 Unauthorized before executing the CPU-intensive Erasure parity loop). I have planned to position this validation as the very first guardrail in the UploadHandler natively.

## Proposed Changes

---

### Backend Dependencies & Type Structs

#### [MODIFY] [package.json](file:///Users/erichill/Documents/Code/verimus/package.json)
Install standard `ethers` globally into the backend `package.json` to expose the execution of `ethers.verifyMessage()` inherently capable of parsing Ethereum Signed messages securely.

#### [MODIFY] [types/index.d.ts](file:///Users/erichill/Documents/Code/verimus/types/index.d.ts)
Overhaul the `StorageContractPayload` and `BlockPrivate` interfaces completely:
- Inject `ownerAddress?: string` and `ownerSignature?: string` into the global `StorageContractPayload` natively bounding public logical identity to the Merkle structural limits.
- Inject `encryptedAesKey?: string` into the `BlockPrivate` structure explicitly matching the exact Metamask payload bounds retrieved in Phase 2.

### Cryptographic Handlers & Gateways

#### [MODIFY] [route_handlers/upload_handler/UploadHandler.ts](file:///Users/erichill/Documents/Code/verimus/route_handlers/upload_handler/UploadHandler.ts)
Refactor the upload ingress mapping explicitly natively evaluating EIP-191 strings:
- Intercept `ownerAddress`, `ownerSignature`, `timestamp`, and `encryptedAesKey` directly from the multipart `FormData` boundary.
- Construct the expected proxy payload `Approve Verimus Originator proxy for data struct <authTagHex>\nTimestamp: <timestamp>` natively mapping Phase 2 logic visually.
- Evaluate `ethers.verifyMessage(proxyMessage, ownerSignature)`. Reject bounds terminating via 401 if discrepancies occur recursively comparing against `ownerAddress`.
- Pass these variables safely mimicking into the `StorageContractPayload` mapping strictly.

#### [MODIFY] [ui/src/components/Modals/UploadModal.jsx](file:///Users/erichill/Documents/Code/verimus/ui/src/components/Modals/UploadModal.jsx)
Append `timestamp` dynamically as part of the `FormData` arrays guaranteeing the backend node can flawlessly reconstruct the deterministic EIP-191 message structurally generated locally inherently.

### Tests & Infrastructure

#### [MODIFY] [route_handlers/upload_handler/test/UploadHandler.test.ts](file:///Users/erichill/Documents/Code/verimus/route_handlers/upload_handler/test/UploadHandler.test.ts)
Architect a strict hermetic mocking sequence utilizing `ethers.Wallet.createRandom()` mathematically drafting real physical Web3 identities inside the Node.js unit tests natively avoiding dependencies on real browsers. Ensure signatures are structurally embedded into the mocked `FormData` seamlessly parsing successfully against `UploadHandler.ts` assertions inherently.

## Open Questions

> [!IMPORTANT]
> The phase 3 layout isolates the `walletManager.freezeFunds` securely mapping the Node's active `publicKey` escrow limits. Since the Node acts as a Proxy, the Phase 3 backend strictly freezes the Node's *own* Veri token liquidity effectively. Is this "Originator Node subsidizes the Proxy User" design accurate for the current phase, prior to introducing dual-staking frameworks in the future?

## Verification Plan

### Automated Tests
- Validate that `UploadHandler.test.ts` executes natively simulating pure Ethers signature maps strictly enforcing 401 extraction timeouts dynamically.
- Monitor `npm test` verifying compilation checks explicitly structurally omitting `any` boundaries.

### Manual Verification
- Render the local verimus Network mapping inherently executing a Metamask `eth_decrypt` upload bound limit natively executing successfully parsing backend limitations structurally dynamically.
