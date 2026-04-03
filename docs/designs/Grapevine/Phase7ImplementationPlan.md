# Web3 Identity & Asset Isolation

This implementation bridges Verimus storage contracts against explicit MetaMask EVM bindings. By binding the visual Wallet tabs exclusively behind the `web3Account` state and routing execution queries, we decouple the End User's interaction from the Host Node's internal wallet structure.

## Proposed Changes

### UI Routing & Component Flow

#### [MODIFY] `ui/src/App.jsx`
- Introduce the `web3Account` Zustand selector.
- Modify the fallback URL mapping: if `web3Account` is null, traversing to `/wallet`, `/files`, or the base `/` will redirect to the `/ledger` route.
- Remove query parameters and rewrite the browser history state when redirecting.

#### [MODIFY] `ui/src/components/Layout/Header.jsx`
- Conditionally render the entire "Wallet" top-level link against the `web3Account` availability. This hides both the "Wallet Dashboard" and "Asset Files" sub-tabs.

#### [MODIFY] `ui/src/components/Views/WalletView.jsx`
- Replace the "Active Node Balance" header with the connected Web3 EVM identity.
- Update `fetchWalletStats()` to target `fetch('/api/wallet?address=' + web3Account)` instead of `/api/wallet`.

#### [MODIFY] `ui/src/services/api.js`
- Integrate `useStore.getState().web3Account` inside `fetchBlocks`.
- Augment `getBaseQueryParams(state)` to conditionally append `&address=${web3Account}` whenever the query enforces the `own=true` parameter.

### Route Handlers (Backend Integration)

#### [MODIFY] `route_handlers/wallet_handler/WalletHandler.ts`
- Alter the handler to intercept and capture `req.query.address`.
- Swap local execution bounds to target `req.query.address` instead of `this.node.publicKey`.

#### [MODIFY] `route_handlers/blocks_handler/BlocksHandler.ts`
- Alter query mappings: If `req.query.own === 'true'` AND `req.query.address` exists, filter database queries by checking `payload.ownerAddress` instead of `publicKey`.

## Verification Plan

### Automated Tests
- Run `npm test` to verify backwards compatibility where an omitted `address` query fallback evaluates to internal limits.
- Ensure backend test modules explicitly target `req.query.address` validation cases.

### Manual Verification
- Execute `spawn_nodes.sh` to render the local cluster. 
- Verify that opening the UI without authentication defaults the layout to Ledger and hides Wallet/Files route components.
- Connect MetaMask and verify the Wallet component fetches the correct EVM test amounts and transactions.
