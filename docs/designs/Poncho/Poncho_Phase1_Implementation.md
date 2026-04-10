# Poncho Phase 1: Decentralized Wallet Dashboard

This architectural blueprint outlines the explicit frontend and backend modifications designed to map continuous Blockchain tokenomics dynamically into the UI (Phase 1). This plan is formatted explicitly for an autonomous AI Agent to sequentially execute without external context.

## Proposed Changes

### Backend Route Layer
#### [NEW] [route_handlers/wallet_handler/WalletHandler.ts](../../route_handlers/wallet_handler/WalletHandler.ts)
- **Context:** The `WalletManager` governs local balances but exposes zero network HTTP bindings.
- **Action:** Create a brand new Express GET handler `WalletHandler.ts` returning:
  1. **Balance:** `await this.node.walletManager.calculateBalance(this.node.publicKey)`
  2. **Active Emission Limit:** Exert `WalletManager.calculateSystemReward(...)` using the latest block's timestamp vs the Genesis block's timestamp gracefully.
  3. **Transaction Feed:** Query the internal `this.node.ledger.blocksCollection` iterating to extract `BLOCK_TYPES.TRANSACTION` elements where `senderId` or `recipientId` equal the local node's `publicKey`.

#### [MODIFY] [api_server/ApiServer.ts](../../api_server/ApiServer.ts)
- Bind the new `WalletHandler` safely executing `app.get('/api/wallet', new WalletHandler(peerNode).handle)`.

### Frontend React Layer
#### [MODIFY] [ui/src/services/api.js](../../ui/src/services/api.js)
- Build a new fetcher function mapping the `/api/wallet` bounds identically hooking JSON responses safely. Note: You can also strictly execute `fetch('/api/wallet')` locally inside a newly spun `WalletView.jsx` file to restrict polluting global stores. 

#### [NEW] [ui/src/components/Views/WalletView.jsx](../../ui/src/components/Views/WalletView.jsx)
- **Component Design:** Utilize existing `glass-panel` layout frameworks natively tracking:
  - **Balances Widget:** Render the node's current raw numerical `$VERI` float perfectly.
  - **Emission Analytics:** Chart the exponential Kryder's Law decay rate boundaries (e.g. `Current Mint Yield: N tokens`).
  - **Transaction Ledger:** Integrate an interactive table/list enumerating the fetched `BLOCK_TYPES.TRANSACTION` histories natively tracking raw `$SYSTEM` emissions vs standard peers seamlessly.

#### [MODIFY] [ui/src/App.jsx](../../ui/src/App.jsx) & [Header.jsx](../../ui/src/components/Layout/Header.jsx)
- **App.jsx Route:** Integrate `case 'wallet': return <WalletView />;` seamlessly onto the main view-router switch block appropriately.
- **Header.jsx Links:** Expose the `Wallet` navigation button continuously beside `Network` and `Ledger` organically! 

## Verification Plan

### Automated Tests
- Execution of `npx tsc --noEmit` locally enforcing the newly integrated `WalletHandler.ts` maintains pure strict TypeScript compliance natively.

### Manual Verification
- Spin up the physical testing infrastructure hitting `npm run build:ui` and `./scripts/spawn_nodes.sh --mongo`.
- Visually interact with the new `Wallet` tab inside Chrome bounding real-time node float arrays dynamically!
