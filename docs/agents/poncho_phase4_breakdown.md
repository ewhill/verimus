# Phase 4: Cryptographic Crypt Exploration

This phase introduces real-time visibility into the physical cryptographic data absorption pipelines, explicitly displaying the verifiable SHA-256 hashing and AES-256-GCM encryption streams natively in the UI. By intercepting internal stream events during block compilation, the frontend guarantees complete transparency into exactly how physical data is bound before it's shipped across the decentralised matrix.

## Proposed Changes

### Backend Telemetry Upgrades
We will hook directly into the Node.js native Data streams executing the Zip/RS matrix and map them securely into the existing Server-Sent Events (SSE) `upload_telemetry` channel organically.

#### [MODIFY] `bundler/Bundler.ts`
- **Method Modifications:** Enhance `streamErasureBundle` to accept an optional `onProgress?: (status: string, message: string) => void` telemetry callback.
- **SHA-256 Hashing Stream:** Within the `file.path` or `file.buffer` hashing loop, intercept `.on('data')` chunks. Emit `HASH_ABSORPTION` events mapping exact slice dimensions logically. Once closed, emit `HASH_RESOLVED` isolating the final physical Checksum trace securely.
- **AES Cipher Stream:** Intercept `cipherStream.on('data')` directly. Emit `AES_ENCRYPTION` streams indicating `AES-256-GCM Encryption Trace [${bytes} Bytes Processed]` natively.

#### [MODIFY] `route_handlers/upload_handler/UploadHandler.ts`
- **Callback Injection:** When invoking `this.node.bundler!.streamErasureBundle`, pass down an explicit callback wrapping `this.node.events.emit('upload_telemetry', ...)` passing the cryptographic structures securely forward.

---

### React UI Cryptographic Terminal
We will overhaul the `UploadView.jsx` telemetry arrays bridging continuous DOM execution.

#### [MODIFY] `ui/src/components/Views/UploadView.jsx`
- **Dual Terminals:** Split the `isUploading` presentation bounds. Retain the "Native Contract Negotiations" for Marketplace limits (`status: MARKET_INITIATED`, `BIDS_ACQUIRED`, `SHARD_DISPATCHED`, `CONSENSUS_INITIATED`).
- **Cryptographic Crypt Terminal:** Build an aggressive, highly technical secondary terminal exclusively indexing the high-frequency SHA-256 and AES logs (`status: HASH_ABSORPTION`, `HASH_RESOLVED`, `AES_ENCRYPTION`). 
- **Auto-Scrolling Matrices:** Ensure these terminals automatically scroll dynamically, pinning to absolute bottom constraints resolving streaming output naturally using React `useRef` hooks cleanly mapping array limits.
- **Styling:** Enhance the logs using specific CSS colors (e.g. `SHA-256` rendered bright cyan, `AES-256-GCM` mapped dark orange) natively improving geometric feedback.

## Verification Plan

### Automated/Subagent Verification
1. `npm test` and `npx tsc --noEmit` bounds MUST formally compile guaranteeing 0 type errors.
2. `npx eslint --fix` MUST complete natively maintaining codebase integrity.
3. Deploy the unified cluster (`spawn_nodes.sh --mongo`) and initialize the Vite frontend.
4. Using an organic Browser Subagent (or manual Chrome interactions due to OS File Picker limits), execute a native `.txt` file upload, mapping positive limits via wallet interactions.
5. Watch the dual-terminal layout populate correctly across both Contract Negotiations and Cryptographic Encryption outputs dynamically!
