# Grapevine Phase 5: Download Guardrails & Web3 Decoupling

This phase finalizes the Web3 Metamask Identity infrastructure. We will formally strip out legacy RSA decryption execution from the backend, moving strictly to client-side Web3 identity boundaries for data extraction. The system will inherently require active `EIP-191` challenge-response signatures when users attempt to pull payloads down from the network, securely protecting bandwidth and data ownership dynamically natively.

## User Review Required

> [!CAUTION]
> **RSA Decryption Deprecation:** This phase will fundamentally strip out `decryptPrivatePayload(privateKey, ...)` hooks natively embedded inside `DownloadHandler` and `PrivatePayloadHandler`. The Node will no longer possess the capability to decrypt the payload on behalf of the user. Have you implemented the React hooks (`eth_decrypt`) within the UI to logically pick up this decrypted artifact?

> [!WARNING]
> **Header Injection Constraints:** Both API routes (`/api/download/:hash` and `/api/blocks/:hash/private`) will mathematically enforce HTTP headers mapping Web3 bounds natively (`X-Web3-Address`, `X-Web3-Timestamp`, `X-Web3-Signature`). The UI Axios queries must physically append these or they will face hard `401 Unauthorized` blockades instinctively.

> [!TIP]
> **Decryption Boundary Finalized**: As requested, the UI React components will organically implement `eth_decrypt` and EVM signing boundaries, finalizing the full Grapevine decoupling roadmap seamlessly.

## Proposed Changes

--- 

### route_handlers/download_handler/DownloadHandler.ts

#### [MODIFY] [DownloadHandler.ts](../../route_handlers/download_handler/DownloadHandler.ts)
*   **Remove Legacy Decryption**: Fully excise the `decryptPrivatePayload` dependencies gracefully.
*   **Inject Guardrails**: Dynamically extract `x-web3-address`, `x-web3-timestamp`, and `x-web3-signature` from standard Express HTTP headers accurately. 
*   **Verify Constraints**: 
    1.  Assert the timestamp is strictly within a `< 5 Minute` skew boundary explicitly mechanically avoiding replay attacks intuitively.
    2.  Execute `ethers.verifyMessage` matching the unique structural payload `JSON.stringify({ action: 'download', blockHash: hash, timestamp: timestamp })`.
    3.  Assert the recovered address explicitly matches the `block.payload.ownerAddress` dynamically bounding the limit orders cleanly. 

---

### route_handlers/private_payload_handler/PrivatePayloadHandler.ts

#### [MODIFY] [PrivatePayloadHandler.ts](../../route_handlers/private_payload_handler/PrivatePayloadHandler.ts)
*   **Identical Header Asserts**: Port the identical timestamp/EVM signature verification limits exactly mapping `DownloadHandler` logic natively matching exactly accurately cleanly strictly logically smoothly properly.
*   **Obsolete Key Matching**: Strip out the logical block rejecting operations missing `targetBlock.publicKey !== this.node.publicKey`. Replace this mechanically validating the Web3 `ownerAddress` natively explicitly instead!

### ui/src/services/api.js & ui/src/utils/web3.js

#### [MODIFY] [api.js](../../ui/src/services/api.js) | [web3.js](../../ui/src/utils/web3.js)
*   **Web3 EVM Prompts**: Implement `generateDownloadAuthHeaders(hash)` natively inside `web3.js` prompting Metamask for a fresh `personal_sign` explicitly mapping the `JSON.stringify({ action: 'download', blockHash: hash, timestamp: timestamp })` configuration.
*   **Decryption Execution**: Implement `executeMetamaskDecryption(encryptedAesHex)` cleanly triggering `window.ethereum.request({ method: 'eth_decrypt' })`.
*   **Header Injection**: Overhaul `fetchPrivatePayload` and `downloadFile` logically inside `api.js` to unconditionally accept and append the natively generated Web3 headers dynamically via standard `fetch` variables preventing 401 bounds natively!

---

### test/integration/CriticalUserJourneys.test.ts

#### [MODIFY] [CriticalUserJourneys.test.ts](../../test/integration/CriticalUserJourneys.test.ts)
*   **Append Auth Headers**: Map the Web3 signature generator dynamically explicitly creating the native EVM headers intuitively mapped against `/api/download/:hash` testing requests gracefully resolving `200 OK` traces flawlessly dynamically cleanly mapping the EIP limits inherently!

## Open Questions

> [!NOTE]
> Do the storage nodes physically retain the `ownerAddress` variable explicitly inside their local Level/Mongo instances structurally? We must be sure `block.payload.ownerAddress` is resolvable strictly natively during `DownloadHandler` bounds mechanically perfectly!

## Verification Plan

### Automated Tests
- Run `npm test` verifying `DownloadHandler` tests perfectly trap 401 exceptions when Web3 headers are stripped or mathematically forged seamlessly elegantly. 

### Manual Verification
- Deploy `spawn_nodes.sh`, run the UI physically clicking download observing Axios interceptors accurately firing Metamask Prompts mapping the block limit gracefully intrinsically explicitly intrinsically.
