# Phase 1b: Algorithmic Emission & Ledger Incentivization

## Objective
To solve the `GENESIS` capitalization deadlock that breaks the Phase 3 P2P Storage Marketplace, the network must mint and distribute `$VERI` to nodes providing throughput and data housing.

This upgrade transitions the network into a **Proof-of-Ledger-Storage** economy, enforcing an autonomous `SYSTEM` token faucet that follows a continuous time-based depreciation reflecting Kryder's Law.

---

## 1. The Autonomous `SYSTEM` Address
Because `SYSTEM` is not controlled by a private key, its balance evaluates to infinite. 

### Implementation Mechanism
- Inside `WalletManager.ts` and `ConsensusEngine.ts`, whenever a `TRANSACTION` block lists `SYSTEM` as the `senderId`, bypass "Insufficient Funds" balance checks.
- When generating verification blocks (e.g., within Phase 5 sortitions or Phase 1 consensus adoptions), the protocol weaves a payload mapping the incoming `amount` from `SYSTEM` to the verifier’s `publicKey`.

---

## 2. The Golden Ratio: Time-Based Continuous Decay
Rather than stepping down sharply using block height counts (e.g., Bitcoin's 210,000 block halving shock), `Verimus` employs an exponential depletion curve mapping network time to match a 15% physical hardware depreciation per year.

### Mathematical Anchor
Because `Verimus` has no block limits, an explosive surge in block counts would break index-based tokenomics. The reward equation relies on the current `block.metadata.timestamp` vs a hard-coded `GENESIS_TIMESTAMP`.

**The Continuous Decay Formula:**
```typescript
function calculateSystemReward(blockTimestamp: number, genesisTimestamp: number): number {
    const BASE_REWARD = 50.0; // Initial Genesis Payout Rate
    
    // 4 years in milliseconds to represent the physical half-life
    const FOUR_YEARS_MS = 4 * 365.25 * 24 * 60 * 60 * 1000; 
    
    // Calculate the 'decay constant' lambda (λ) for a 4-year half-life
    // lambda = ln(2) / half_life
    const DECAY_RATE = Math.LN2 / FOUR_YEARS_MS;
    
    const timeDeltaMs = Math.max(0, blockTimestamp - genesisTimestamp);
    
    // N(t) = N0 * e^(-λt)
    const reward = BASE_REWARD * Math.exp(-DECAY_RATE * timeDeltaMs);
    
    // Establish a dust limit (minimum mint floor)
    return Math.max(reward, 0.000001);
}
```

### Economic Strengths
1. **Decoupled from Throughput:** If millions of contracts execute in a day, the formula drops evenly without accelerating the emission halving.
2. **Kryder's Law Alignment:** At exactly 4 years from genesis, nodes will earn 25.0 $VERI, keeping the profit-ratio uniform against cheaper hard disk hardware.
3. **No Halving Volatility Shocks:** Rewards reduce continuously, preventing node exodus events triggered by sudden 50% drops.

---

## 3. Initial Capitalization Mechanics (When to Pay)
The `calculateSystemReward` payout must be appended into the network.

1. **Phase 1c/Phase 3 Foundation (Consensus Settlements):**
   - Whenever an auditing node proposes a validated `STORAGE_CONTRACT` that merges upstream, they generate a linked `TRANSACTION` block compensating their cryptographic labor.
2. **Phase 5 Foundation (Audits):**
   - Nodes selected via sortition to audit the ledger footprint are paid after verifying the health of the chunks against cryptographic hash mappings.

---

## 4. Execution Task Checklist

- [x] Modify `WalletManager.ts` to isolate `SYSTEM` boundary checks, ensuring no infinite loops.
- [x] Establish `GENESIS_TIMESTAMP` as a universally tracked constant inside `index.ts` or a shared `constants.ts`.
- [x] Integrate the `calculateSystemReward` routine to return normalized token floors without floating point corruption.
- [x] Hook the payout generation tracking new `TRANSACTION` schemas into validation checkpoints inside `ConsensusEngine.ts`.
- [x] Add integration tests verifying a 10-year timestamp shift generates the expected fractional block reward.
