# Project Bandana: Milestone 0 - Task Breakdown

This document provides a granular task breakdown to execute Milestone 0: **Legacy Payload Security Hardening**. The objective is to sweep all existing EIP-712 variables structurally acting as `uint256` over EVM borders, upgrade their TypeScript equivalents to secure `bigint`s, and rigorously enforce string-quoted transportation layers over HTTP to bypass Javascript's maximum safe integer truncations natively.

## 1. Internal Precision Upgrades

### Task 1.1: Overhaul Payload TypeScript Definitions

**Scope**: Eliminate all `number` types associated with `uint256` cryptographic structs in `types/index.d.ts`.
**Instructions**:

- Locate `StakingContractPayload` and change `minEpochTimelineDays: number` to `bigint`.
- Locate `CheckpointStatePayload` and change `epochIndex: number` to `bigint`.
- Locate `ErasureParameters` and change `n`, `k`, and `originalSize` from `number` to `bigint`.
- Locate `NodeShardMapping` and change `shardIndex: number` to `bigint`.
**Testing**: Run `npx tsc --noEmit` across the repository. This will intentionally generate mapping errors in files previously utilizing simple numbers (e.g., test mocks or initializations). Fix all compiler errors ensuring exact architectural parity.

### Task 1.2: Establish Strict Ingress Hydration Boundaries

**Scope**: Update the runtime deserialization process to strictly mandate and parse stringified integers to prevent silent `JSON.parse` precision mutation.
**Instructions**:

- Locate the `hydrateBlockBigInts` method within `crypto_utils/EIP712Types.ts`.
- Expand the method to check the new properties (`epochIndex`, `minEpochTimelineDays`, `shardIndex`, `originalSize`, `n`, `k`).
- Force a strict edge check mapping: if the incoming property is of type `number`, explicitly log a warning and throw an `Invalid Payload` exception (rejecting potentially truncated exploits). If it is a `string`, safely invoke the `BigInt(string)` constructor converting it natively to memory.
**Testing**: Update integration tests verifying `hydrateBlockBigInts`. Formulate a mock payload where `epochIndex = 9007199254740995` (raw number) and assert hydration throws an explicit rejection. Provide a secondary payload passing `"9007199254740995"` (string) and assert successful conversion to a 256-bit BigInt value.

---

## 2. API Transport Serialization

### Task 2.1: Enforce UI / Client-Side Serialization Casting

**Scope**: Guarantee any data posted across the network edge securely stringifies massive integer endpoints before REST deserialization happens organically.
**Instructions**:

- Traverse the React application (`ui/src/components` or `ui/src/pages`) and locate the origin layers dispatching `StakingContract` or `Checkpoint` generation limits via `fetch` or WebSockets over the `/api/` framework.
- Force all corresponding numerical inputs mapping into the `uint256` schemas to execute `.toString()` prior to the final outgoing `JSON.stringify()` dispatch boundary.
**Testing**: Perform Manual QA utilizing Chrome DevTools. Trigger a Staking Contract request and inspect the outgoing Network Payload. Confirm that `minEpochTimelineDays` strictly travels across the wire encapsulated in quotes (e.g. `"10"`) avoiding raw int mappings identically.
