# EIP-6963 Provider Injection Implementation Plan

This plan details the specific tasks required to integrate EIP-6963 (Multi Injected Provider Discovery) across the Verimus localized UI frontend, resolving the Milestone 4 MetaMask integration prerequisites. The scope includes state management, cryptographic hooks, and front-end rendering without relying on archaic `window.ethereum` global mutations.

## Proposed Changes

---

### React Frontend State (`ui/src/store/index.js`)
We will expand the Zustand global store to handle the arrays of discovered UI wallets and track the user's specific connection.

#### [MODIFY] `index.js`
- Add state arrays `discoveredProviders: []` and `activeProvider: null`.
- Add dispatch type `ADD_DISCOVERED_PROVIDER`: Append unique providers into the `discoveredProviders` array, verifying uniqueness using `provider.info.uuid`.
- Add dispatch type `SET_ACTIVE_PROVIDER`: Record the user's selected EIP-6963 provider explicitly for subsequent transaction hooks.

---

### Web3 Cryptographic Shim (`ui/src/utils/web3.js`)
We must scrub out the hardcoded global Ethereum properties, making the utilities pure functions that operate over a provided EIP-6963 instance.

#### [MODIFY] `web3.js`
- Build an `initializeEIP6963Discovery(dispatch)` event listener method attaching to `window` for `eip6963:announceProvider`.
- Trigger `window.dispatchEvent(new Event("eip6963:requestProvider"))` to manually ping sleeping wallets natively.
- Refactor all signature exports (`derivePrivateKey`, `signOriginatorProxyMessage`, `decryptAESCore`, `getEncryptionPublicKey`, `generateDownloadAuthHeaders`) to accept an explicit `activeProvider` property instead of querying `window.ethereum`.
- Update `new ethers.BrowserProvider(window.ethereum)` logic universally to `new ethers.BrowserProvider(activeProvider)`.
- Replace `hasWeb3Provider()` to validate against the explicit passed provider natively.

---

### UI Execution Modals & Mount Points (`ui/src/components/*`)
We will bind the discovered store objects down into the view layer.

#### [MODIFY] `App.jsx`
- Call `initializeEIP6963Discovery(dispatch)` directly inside a `useEffect` on application mount, bootstrapping the discovery capabilities globally.

#### [MODIFY] `UploadModal.jsx`
- Import `activeProvider` from `useStore`.
- Update the invocations to `getEncryptionPublicKey` and `signOriginatorProxyMessage` ensuring synchronous execution utilizing the `activeProvider` natively rather than failing silently.

#### [MODIFY] `WalletConnection.jsx`
- Import `discoveredProviders` from `useStore`.
- Remove the archaic `window.ethereum` listeners.
- **Frictionless Logic Override:** 
  - When the user clicks "Connect Wallet", if `discoveredProviders.length === 1`, instantly connect to the singular provider (easiest, frictionless path).
  - If `discoveredProviders.length > 1`, pop open a small, elegant Provider Selection modal natively attached below the header. The menu will iterate over `discoveredProviders`, rendering the `provider.info.icon` (Base-64) and `provider.info.name` securely so the user can distinguish between MetaMask, Rabby, etc.
  - Upon user selection, dispatch `SET_ACTIVE_PROVIDER` logically mapping the targeted wallet and dispatch the standard `eth_requestAccounts` JSON-RPC call.
  - **Fallback:** If `discoveredProviders.length === 0`, gracefully present the existing "No Ethereum provider detected" error toast.
