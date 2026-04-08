# Project Bandana: Milestone 4 - Frontend UI Integration & Contract Renewals (Task Breakdown)

This document maps out the actionable steps needed to deliver chronological contract visibility directly to users via the Verimus application interface.

## Task 1: Component Ledger State Integration
**Objective**: Expose the current global blockchain index bounds to the contract renderer isolated from ledger polling logic.
- **Target File**: `ui/src/components/Modals/Payloads/StorageContractPayload.jsx`
- **Actions**:
    1. Introduce a React `useEffect` and `useState` hook mapping a local `currentIndex` variable.
    2. Upon mount, perform a `fetch('/api/ledger/metrics')` call, isolating and storing the returned `currentIndex` value.
    3. Ensure error handlers catch fetch failures without crashing the UI array.

## Task 2: Client-Side Map Projections & Displays
**Objective**: Calculate the physical offset parameters to translate static integer block coordinates back into human-readable metrics.
- **Target File**: `ui/src/components/Modals/Payloads/StorageContractPayload.jsx`
- **Actions**:
    1. Extract the `expirationBlockHeight` attribute from `payload.expirationBlockHeight`.
    2. Subtract `currentIndex` to evaluate `blocksRemaining`.
    3. Construct a time conversion helper function mapping `AVERAGE_BLOCK_TIME_MS = 5000`. Calculate `blocksRemaining * 5000` to yield remaining milliseconds.
    4. Implement string manipulations transforming the milliseconds into readable approximations (e.g., `<Typography>Time Remaining: ~12 Days, 4 Hours</Typography>`).
    5. Handle limits tracking `blocksRemaining <= 0` to indicate `Status: EXPIRED`.

## Task 3: Danger Assertions & Renewal Alerts
**Objective**: Warn users by altering visual interfaces when a chronological escrow is approaching physical completion.
- **Target File**: `ui/src/components/Modals/Payloads/StorageContractPayload.jsx`
- **Actions**:
    1. Establish an integer limit threshold equivalent to a 24-hour warning mark (e.g., `24 * 60 * 60 * 1000 / 5000 = 17280 blocks`).
    2. Introduce a Material UI `<Alert severity="warning">` tag conditionally rendered whenever `blocksRemaining > 0 && blocksRemaining < 17280`. The alert must state: "Warning: Your chronological escrow completes within 24 hours. Data is scheduled for verifiable physical deletion."

---

### Implementation Guidelines
- **Precision Constraints**: Remember that `expirationBlockHeight` is passed via the REST HTTP pipeline as a string. Ensure mathematical expressions utilize `BigInt()` parsing to combat Float64 precision limitations.
- **Stylistic Parity**: Honor the `ui/` directory spacing parameters mapping the `<Box>` components to render metrics cleanly alongside the existing `allocatedRestToll` output.
