# Grapevine Phase 1: Client-Side Encryption Decoupling 

This execution plan maps the transition of Verimus AES cryptography away from the backend array and directly into the client’s browser natively, locking the Originator Node strictly into a zero-knowledge Erasure Routing broker.

## User Review Required
> [!WARNING]
> Because the backend no longer processes or holds the AES key natively, `DownloadFileHandler.ts` (which previously mathematically unzipped strings sequentially inside Node.js to pull single targets) will fundamentally break. We recommend deprecating that route and having the UI pull the full encrypted shard block blindly, relying entirely on the browser to unzip and extract single files for the user. Do you approve this deprecation?

## Proposed Changes

---

### UI Subsystem (`ui/src/`)

#### [NEW] `ui/src/utils/cryptoWorker.js` (or `bundler.js`)
- Implement a utility leveraging `fflate` for browser-native ZIP compression of the selected files.
- Implement `window.crypto.subtle` logic to generate a secure AES-256-GCM symmetric key and random IV.
- Pass the ZIP buffer into `crypto.subtle.encrypt()`, producing the completely opaque symmetric payload and natively harvesting the 16-byte GCM Authentication Tag.
- Return the `encryptedBlob`, `aesKeyBase64`, `aesIvBase64`, `authTagHex`, and the `fileMetadata` array (JSON strings mapping file names + SHA-256 hashes).

#### [MODIFY] `ui/package.json`
- Install `fflate` as a frontend dependency.

#### [MODIFY] `ui/src/services/api.js` & `ui/src/components/Modals/UploadModal.jsx`
- Intercept the upload flow to execute the new client-side compression/encryption utility.
- Automatically trigger a `verimus_payload.key` download inside the browser providing the user with their `aesKeyBase64` string for safekeeping.
- Submit to `/api/upload` constructing the `FormData` heavily: attaching `req.files[0]` as the single `encryptedBlob`, while pushing the `aesIvBase64`, `authTagHex`, and `fileMetadata` securely inside the multipart body natively.

#### [MODIFY] `ui/src/components/Modals/BlockModal.jsx` & `FileGrid.jsx`
- Replace direct `/api/download/:hash/file/:filename` links with native `<DecryptModal />` triggers.
- Prompt the user to supply their `verimus_payload.key` string securely. 
- Download the opaque ciphertext blob from the backend, decrypt it symmetrically in the browser DOM via `window.crypto.subtle`, and reconstruct the ZIP extracting files locally natively. 

---

### Backend Components (`bundler/` & `route_handlers/`)

#### [MODIFY] `bundler/Bundler.ts`
- Extract Erasure mapping out of the core AES pipeline natively. Add `streamPreEncryptedErasureBundle(encryptedBuffer: Buffer, K: number, N: number)`.
- This bypasses all `archiver` and `createAESStream` executions explicitly. It directly absorbs the raw memory buffer, calls `encodeErasureShards`, and structures the Merkle tree limits identically to the legacy stream loop. 

#### [MODIFY] `types/index.d.ts`
- Alter the `BlockPrivate` cryptographic payload structure natively.
- Change `key: string` to `key?: string` (marking it optional/deprecated), while heavily relying upon the public `iv` and `authTag` definitions inherently.

#### [MODIFY] `route_handlers/upload_handler/UploadHandler.ts`
- Intercept `req.body.aesIv`, `req.body.authTag`, and `req.body.fileMetadata` alongside the single pre-encrypted blob upload natively. 
- Execute `this.node.bundler.streamPreEncryptedErasureBundle(...)`.
- Package the `BlockPrivate` using the client's injected attributes natively, explicitly assigning `CLIENT_MANAGED` to the `key` parameter to secure zero-knowledge boundaries.

#### [MODIFY] `route_handlers/download_handler/DownloadHandler.ts`
- Sever the loop calling decryption logic globally. Retain the core loop generating matching `Bundler.reconstructErasureShards()`, but instantly stream the aggregated payload buffer back natively into the HTTP response stream (`application/octet-stream`), forcing the UI to securely adopt decryption duties globally.

#### [DELETE] `route_handlers/download_file_handler/DownloadFileHandler.ts`
- Safely drop this route, mapping a standard `400 Bad Request: Decryption Client-Side Required` message heavily to permanently prevent broken single-file pulls securely.

---

## Verification Plan

### Automated Tests
- Modify `Bundler.test.ts`: Write specific assertions ensuring `streamPreEncryptedErasureBundle` strictly evaluates payload parity mathematically mirroring expected constraints. 
- Rewrite `UploadHandler.test.ts` & `DownloadHandler.test.ts`: Verify mock arrays inject and emit expected zero-knowledge parameters symmetrically.
- Drop `DownloadFileHandler.test.ts` matching routing obsolescence implicitly.

### Manual Verification
- Deploy UI. Select two files, hit Upload.
- Verify the browser downloads a single symmetric key.
- Verify the network successfully bridges the encoded shards natively achieving `Block Validation` explicitly.
- Go to the Ledger Grid, execute a download requesting the key, and verify the resulting extracted files match identical properties natively.
