# Milestone 5: Native Wei BigInt Arithmetic Migration

This document outlines the architectural migration required to natively unify token denominations to standard Ethereum `Wei` formatting mapped directly via BigInt capabilities.

## 1. Context & Motivation
Currently, Verimus balances and transaction economics rely natively on JavaScript's standard `Number` float formats, representing raw decimals effectively (e.g., `45.33 VERI`). While adequate for basic prototypes, it introduces fundamental technical debt:
- **Precision Loss:** IEEE 754 float architectures suffer from compounding bounds rounding exceptions structurally during aggregated computations.
- **EVM Unification Constraints:** EIP-712 definitions map financial limits mathematically to `uint256`. Pushing raw programmatic floats against Ethereum tools requires brittle localized padding or fraction mutational wrappers.
- **Smart Contract Interoperability:** Standard Layer-2 contracts refuse floating point numbers cleanly. Operating isolated bounds will break native EVM bridge architectures.

## 2. Target Component Scope

### The Mathematical Base
- Shift all ecosystem numerical mapping completely to native JavaScript `BigInt` structures.
- Enforce $1 \text{ VERI} = 1 \times 10^{18} \text{ Wei}$.

### A. Core Engine Overwrite
- `peer_handlers/consensus_engine/ConsensusEngine.ts`: Recalibrate decay interval payouts and Slashing burns mapped mathematically across base $10^{18}$ constraints natively leveraging `ethers.parseUnits()`.

### B. WalletManager Conversion 
- `wallet_manager/WalletManager.ts`: Modify `$inc` loop boundaries. Note: MongoDB driver dynamically supports Long types natively natively, but tracking 18 decimal representations may natively necessitate defining strict String schema casts uniformly preventing BSON boundary panic conditions. 

### C. Typescript Interface Bounds
- `types/index.d.ts`: Transition numerical limits natively encapsulating `bigint` typing exclusively. 

## 3. Implementation Workflow

1. **Schema Refactoring**: Upgrade MongoDB initialization constraints inside `spawn_nodes.sh` utilizing string-casted numbers strictly bounded correctly natively preventing numerical underflows.
2. **EIP-712 Redefinition**: Exise temporary scalar modifications inside `EIP712Types.ts` mapping the values gracefully.
3. **Frontend Formatting**: Implement localized visualization utilities gracefully rendering absolute string `Wei` sums to legible floating representations strictly inside the `ui/` React environment dynamically efficiently.
4. **Integration Wipe**: Instruct agents/developers to aggressively clear and completely purge `data/*` blocks resolving local historical structural corruption permanently natively bounding success logic cleanly.
