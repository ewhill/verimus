# Phase 5b: Staking Collateral & Network Slashing Mechanics

## The Problem
Decentralized networks rely completely upon trustless alignment of financial incentives mapping optimal behaviors over time. Phase 5 audits identify non-compliant nodes but impose zero penalties beyond halting future reward dispersion. A malicious network operator could inject millions of Sybil instances to sweep initial payments and drop all the data an hour later with complete impunity. We must establish a strict deterrent enforcing data retention commitments.

## Proposed Solution: Verimus Tokens Escrow (Staking) and Slashing
Every node aspiring to participate as a Storage or Validator `roles` array constraint must lock an upfront base collateral sum (e.g. 50,000 $SYSTEM tokens) within a `STAKING_CONTRACT` block.
As they secure more file chunks, their locked stake threshold scales proportionally to total bytes hosted.

When the Phase 5 Sortition Audit detects a node failing Proof of Spacetime criteria across consecutive windows, a `SLASHING_TRANSACTION` block is consensus-proposed and explicitly drains $SYSTEM balances out of their locked escrow, burning them, terminating their standing in the network.

### Pros
- Secures the network from Sybil swarms inherently.
- Forwards extreme accountability against sloppy or unreliable infrastructure providers globally.

### Cons
- Creates a steep onboarding hurdle blocking hobbyist developers from running experimental nodes without acquiring heavy token balances.

## Alternative Solution: Withheld Payment Vesting Constraints
Rather than forcing heavy upfront collateral deposits, heavily delay all outbound rewards tracking 90 days. If the node fails a check on Day 89, cancel the vesting queue entirely representing lost electrical expenditure.

### Pros
- Permits frictionless node onboarding without acquiring base token collateral.

### Cons
- Sophisticated operators may deduce exact vesting intervals and carefully engineer complex strategies dynamically exploiting the delay constraints. Upfront stake enforces immediate, symmetric risk profiles across all scale levels.
