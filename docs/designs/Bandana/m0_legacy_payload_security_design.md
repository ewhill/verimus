# Project Bandana: Milestone 0 - Legacy Payload Security Design

## 1. Background

Verimus utilizes the EIP-712 standard for cryptographic payload signing, meaning variables like `epochIndex`, `minEpochTimelineDays`, `shardIndex`, and `originalSize` are defined as `uint256` values within the signature schema. However, in the foundational TypeScript interfaces (`types/index.d.ts`), these parameters are typed simply as `number`. 

Because JavaScript evaluates `number` values as 64-bit floating-point variables, any payload exceeding `Number.MAX_SAFE_INTEGER` ($2^{53} - 1$) suffers invisible precision loss when deserialized. This allows maliciously constructed high-integer variables to undergo severe mathematical truncation before signature validation executes, fracturing the integrity of ledger economic bindings.

---

## 2. Initial Proposed Approach: Universal BigInt Migrations

The roadmap initially proposed updating all affected variables in `types/index.d.ts` directly from `number` to `bigint`. The `hydrateBlockBigInts` logic in `EIP712Types.ts` would explicitly cast the raw inputs into the `BigInt` format immediately upon memory ingestion. 

### Pros
- **Exact EVM Parity**: `bigint` is the sole JavaScript primitive that safely matches the 256-bit exact capacity of a standard EIP-712 `uint256` parameter.
- **Unmodified Signatures**: MetaMask and hardware wallets continue correctly mapping to numeric values during signature prompts without UI degradation.

### Cons
- **Deserialization Weakness**: If external clients submit REST payloads passing these values as raw unquoted integers (e.g., `{"epochIndex": 9007199254740995}`), the Express `JSON.parse` core will still corrupt the data via precision truncation *before* the backend `hydrateBlockBigInts` process ever runs. The proposed fix does not protect the initial HTTP boundary limits.

---

## 3. Alternative Approach 1: Convert EIP-712 Schemas to String Types

Instead of utilizing native `uint256` or `bigint`, all massive variables are explicitly converted to `string` primitives within both the EIP-712 signature schemas and the TypeScript models. The `WalletManager` converts the strings manually to `bigint` exclusively when performing mathematical operations.

### Pros
- **JSON Security**: Standard strings are immune to `JSON.parse` float-rounding errors across HTTP communication pathways.
- **Easy Validation**: String length can be instantly truncated and validated by router middleware.

### Cons
- **Wallet UI Degradation**: Altering an EIP-712 schema parameter from `uint256` to `string` causes hardware wallets (like Ledger/Trezor) and MetaMask to display the variable as a raw text string instead of a formatted economic integer. This destroys UX consistency for financial payloads.

---

## 4. Alternative Approach 2: Strict JSON Reviver Middleware (Stringified Network Ingress)

Types remain `bigint` internally and `uint256` in EIP-712 schemas, preserving correct hardware wallet interpretation. To bypass the `JSON.parse` exploit, the Upload handlers are modified to strictly reject numerical POST bodies for massive values. External clients are forced to transmit all `uint256` parameters strictly serialized securely as strings over the JSON API (e.g., `{"epochIndex": "9007199254740995"}`). The hydration process then executes `BigInt(string)` directly.

### Pros
- **Complete End-to-End Precision**: Avoids JavaScript parsing flaws entirely because strings are cleanly bridged straight to `BigInt` constructor execution.
- **Preserves Wallet Integrity**: External users continue signing standard `uint256` structs via Ethers.js, strictly maintaining MetaMask's native numeric UI.

### Cons
- **API Migration**: Requires modifying client-side scripts to quote integers before initiating `POST` requests, slightly complicating straightforward payload generations.

---

## 5. Comparative Analysis & Final Decision

The **Initial Proposed Approach (Universal BigInts)** solves internal logic operations perfectly but inherently fails to address the underlying network deserialization exploit within Node's `JSON.parse()`. 

While **Alternative 1 (String Types)** resolves the parsing exploit, it irreversibly damages hardware wallet UX by forcing textual schemas upon EVM structures. 

**Alternative 2 (Strict JSON Reviver Middleware)** provides the only bulletproof mathematical boundary. By allowing EIP-712 to correctly operate over `uint256` integers while forcing the raw HTTP transport layer to explicitly serialize those payloads as strings, Node.js never triggers numeric rounding truncations.

**Final Decision: Pivot from the Initial Roadmap Approach to Alternative 2 (Strict JSON Reviver Middleware).** 

Clients must submit stringified numbers into the `POST` endpoints, and `types/index.d.ts` will strictly adopt `bigint` internally tracking them exactly.

---

## 6. Revised Target Deliverables

1. **TypeScript Definitions**: Define parameters (`epochIndex`, `minEpochTimelineDays`, `shardIndex`, `n`, `k`, `originalSize`) as `bigint` inside `types/index.d.ts`.
2. **Ingress Serialization Bounds**: Modify UI clients and integrations to explicitly `toString()` massive metric components over the JSON body when targeting the `/api/` upload routers.
3. **Hydration Casting**: Restructure `hydrateBlockBigInts` to intercept explicitly quoted JSON numeric properties (e.g., string mappings) and precisely cast them into `bigint` properties within memory states.
