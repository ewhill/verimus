# Phase 7: Universal Block Layout Types

We are upgrading the `LedgerGrid` and `BlockModal` components to securely visualize all active `BLOCK_TYPES` beyond standard storage contracts. This will create a universal explorer mapping all architectural system logic visibly rather than only parsing AES-256 blocks seamlessly.

## Proposed Changes

### UI Components

#### [MODIFY] [LedgerGrid.jsx](file:///Users/erichill/Documents/Code/verimus/ui/src/components/Views/LedgerGrid.jsx)
- **Type Display**: Enhance the grid and list rendering mappings by reading `pkg.type`.
- **Icon / Color Implementation**: Create a centralized mapping block representing different consensus events:
  - `STORAGE_CONTRACT`: 🟦 Blue Theme + `<svg>` Database icon
  - `CHECKPOINT`: 🟪 Purple Theme + `<svg>` Shield Lock icon
  - `TRANSACTION`: 🟩 Green Theme + `<svg>` Currency/Transfer icon
  - `STAKING_CONTRACT`: 🟧 Orange Theme + `<svg>` Flag/Stake icon
  - `SLASHING_TRANSACTION`: 🟥 Red Theme + `<svg>` Exclamation Warning icon
- These badges will append either beneath the hash ID or right next to the Index counters on the global layout natively.

#### [MODIFY] [BlockModal.jsx](file:///Users/erichill/Documents/Code/verimus/ui/src/components/Modals/BlockModal.jsx)
- **Modular Payload Rendering**: Segregate `fetchPrivatePayload()` exclusively behind a `pkg.type === 'STORAGE_CONTRACT'` guard conditional wrapper.
- **Native Block Payloads**: If a block is _not_ a `STORAGE_CONTRACT`, securely fetch its native `pkg.payload` object instead of pinging the AES decryption endpoints sequentially:
  - `TRANSACTION`: Render sender/recipient mappings natively + network amounts.
  - `CHECKPOINT`: Map the state/contract Merkle roots securely + hash bounds physically.
  - `STAKING_CONTRACT`: Reveal the physical operator string mapping directly into collateral lock lengths.
  - `SLASHING_TRANSACTION`: Clearly call out the penalized keys and burnt limits securely bridging the Slashing execution log.
- Remove the `"Node is not an authorized recipient"` shield fallback natively formatting out standard visible blocks since transactions and state bounds are global public information cleanly mapped via standard JSON.

## Open Questions

> [!WARNING]  
> Are there specific locations you prefer these block type badges to be positioned visually within the list and grid cards in `LedgerGrid.jsx`? 
> Currently, the logic proposes integrating them strictly into the `card-header` (grid view) next to the pending-status/index-badges, and aligning them in a new explicit 'Type' column in the `list` structural view cleanly.

## Verification Plan

### Automated Tests
- Validate UI format builds flawlessly using `npx eslint` syntax limits.
- The project frontend does not natively map `jest/vitest` suites on component rendering logic, but `npx tsc --noEmit` verifies strict payload binding maps securely.

### Manual Verification
- We will boot the nodes using `spawn_nodes.sh --mongo`, trigger storage uploads, explicitly drop local bounds executing simulated `TRANSACTION` payloads across peer states, and visually observe multiple block variations directly via the frontend URL (`localhost:31001/ledger`).
