# Grapevine Phase 2: Web3 UI Integration

Phase 2 of the Grapevine Roadmap structurally integrates Metamask into the React UI, establishing the "Signer As Oracle" paradigm. The scope of this phase is restricted to the front-end Web3 layer, decoupling logical file ownership and ensuring the network abstracts AES encryption directly into EVM asymmetric paths securely.

## User Review Required

> [!IMPORTANT]
> Because Metamask generates encryption via the X25519 standard explicitly under the `eth_getEncryptionPublicKey` / `eth_decrypt` RPC schemas, we must dynamically map the Verimus `ui` component layer to rely heavily on `@metamask/eth-sig-util`. Since the Originator Node backend will *not* have access to the user's Metamask extensions whatsoever, no structural limits or verifications regarding encryption can occur backend-side. Is this complete UI isolation acceptable for Phase 2?

## Proposed Changes

---

### UI Core & State Dependencies

#### [MODIFY] [package.json](file:///Users/erichill/Documents/Code/verimus/ui/package.json)
Install `ethers` (for Ethereum address management and eventual personal signature verification utilities) and `@metamask/eth-sig-util` (for manual Javascript asymmetric encryption of the AES string limiting using the user's Metamask-provided public key seamlessly).

#### [MODIFY] [store/index.js](file:///Users/erichill/Documents/Code/verimus/ui/src/store/index.js)
Introduce `web3Account: null` mapping to the global Zustand state block. Attach a `SET_WEB3_ACCOUNT` dispatch mutation to track the connected Web3 user identity natively, and map this payload structure into the `partialize` whitelist strictly persisting identity across page reloads contextually.

### Web3 Utilities & Connections

#### [NEW] [utils/web3.js](file:///Users/erichill/Documents/Code/verimus/ui/src/utils/web3.js)
Construct explicit interface logic binding to `window.ethereum` structurally. Expose explicit hooks for standard `eth_requestAccounts`, `eth_getEncryptionPublicKey`, and `eth_decrypt`. In addition, create a `signOriginatorProxyMessage` utility forcing Metamask to evaluate an EIP-191 personal signature (e.g. `Approve Verimus Originator proxy for data struct <timestamp>`) proving active execution correctly.

#### [NEW] [components/Wallet/WalletConnection.jsx](file:///Users/erichill/Documents/Code/verimus/ui/src/components/Wallet/WalletConnection.jsx)
Build a modular React component that interfaces dynamically with `web3.js`, presenting the connection status globally (mapping the truncated 0x user-address UI interfaces) and attaching logical fallback listeners explicitly mapping DOM `accountsChanged` / `chainChanged` limitations. We will inject this cleanly into the overarching UI Navigation or Sidebar dynamically limiting context.

### Cryptographic UI Redirection

#### [MODIFY] [UploadModal.jsx](file:///Users/erichill/Documents/Code/verimus/ui/src/components/Modals/UploadModal.jsx)
Halt the Phase 1 process where the application organically prompts users to download a native `.key` blob. Instead, dynamically intercept the generated random 32-byte AES string, fetch the user's Metamask encryption public key organically, and perform pure offline asymmetric curve encryptions limiting using `@metamask/eth-sig-util` natively. Submit the *encrypted* `aesKey` hex alongside the requested Metamask proxy signature explicitly into the `/api/upload` form fields correctly limiting structurally mimicking Phase 3 logic limits natively.

#### [MODIFY] [FileGrid.jsx](file:///Users/erichill/Documents/Code/verimus/ui/src/components/Views/FilesView/FileGrid.jsx) & [BlockModal.jsx](file:///Users/erichill/Documents/Code/verimus/ui/src/components/Modals/BlockModal.jsx)
Override the manual Javascript `prompt()` execution loops mathematically requesting pasted JSON key strings. Structure the pipeline dynamically mapping the extracted Web3 Account Address: verify the encrypted hexadecimal strings natively mapping embedded into the `BlockPrivate` attributes explicitly, then trigger `eth_decrypt` strictly resolving the pure AES plaintext seamlessly into the pre-existing Phase 1 `decryptAndUnzip` buffer sequences securely avoiding manual extraction boundaries contextually limiting.

## Open Questions

> [!WARNING]
> Metamask's `eth_decrypt` RPC returns the plaintext strictly resolving inside the browser locally. We should ensure the overarching node.js execution tests locally wrap this layer natively, gracefully bypassing tests when standard UI limits fail dynamically detecting headless browsers natively. Should we formally inject Cypress/Playwright End-to-End mappings mimicking physical extensions to test this completely, or rely on explicit manual E2E checks mathematically?

## Verification Plan

### Automated Tests
- Explicitly trace test overrides mimicking standard execution paths gracefully ignoring web3 bounds via mock objects explicitly, maintaining green testing matrices correctly structurally overriding backend integrations without `window.ethereum` exceptions fundamentally mapping strictly locally.

### Manual Verification
- Execute `npm run dev` in the `/ui` workspace with an enabled injected Metamask extension natively.
- Connect wallet securely -> Encrypt and upload dummy test file structurally validating the prompt limiting -> Ensure payload boundaries post securely the asymmetric string mappings via Network requests organically.
- Download target block -> Trigger successful decryption bounds seamlessly unzipping securely mapping zero-knowledge checks structurally completing.
