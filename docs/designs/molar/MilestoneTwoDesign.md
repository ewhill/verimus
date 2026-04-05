# Design Document: Ledger Data Model & Economic Typing Evolution (Molar Milestone 2)

## Background & Problem Statement
Currently, the Verimus ledger database and all structural Typescript boundaries (including `BaseBlock`, `TransactionPayload`, and the `WalletManager`) accept raw RSA public keys natively inherited from the overarching P2P network layer. This creates a fundamentally incompatible state mapping for integrating standard Web3 Wallets (MetaMask), which exclusively generate and negotiate tokens mathematically utilizing uncompressed SECP256K1 `0x` addresses. 

To securely permit MetaMask bindings natively against the Verimus backend, the core `types/index.d.ts` schemas, as well as the underlying database traversal mechanisms inside `WalletManager.ts` and `BlocksHandler.ts`, must fully segregate from the legacy RSA node strings and rigorously adapt precise EVM specifications.

---

## Alternative Approaches Considered

To securely transition the database to read/write off EVM address boundaries, we evaluated exactly how aggressive the integration should become across varying node environments.

### Initially Proposed Concept: Dual-Stack Backwards Compatibility (Implicit Coercion)
Retain the generic field labels natively (`senderId`, `recipientId`, `publicKey`) within the foundational `BaseBlock` architecture. We refactor `WalletManager.ts` to dynamically evaluate string formats: if a string starts with `0x`, map it natively to our new MetaMask configurations, but if it evaluates to an extensive unformatted RSA keydump, fall back to parsing legacy logic. We simply run both identities loosely.

**Pros:** 
- Mathematically protects the existing network ecosystem. Engineers do not have to invoke `rm -rf data/*`.
- Ensures legacy network peers broadcasting older Verimus configurations won't inherently crash the Consensus boundary when transacting historical coins.

**Cons:**
- **Severe Technical Debt:** Typescript boundaries dramatically lose their specific, explicit constraints. 
- **Validation Bloat:** The highly sensitive `ConsensusEngine` will inherently become littered with fragile `typeof` branches and RegEx string tests navigating the difference between Node configurations.

### Alternative 1: Cryptographic Mapping Contract (Migration Pipeline)
Construct a localized one-time ledger event configuration (`BLOCK_TYPES.IDENTITY_MIGRATION`) where active nodes physically sign an RSA payload mapping and establishing ownership over their newly generated `0x` Ethereum address. The `WalletManager` intercepts this event, burning the RSA balance dynamically and safely moving the history perfectly mapping over to the new namespace.

**Pros:**
- Safely resolves the problem cryptographically and accurately ports historical capital into the new structure without forced database flushes.

**Cons:**
- **Architecture Overkill:** We are dedicating significant architectural cycles to build a transient smart-contract migration explicitly to prevent clearing internal files during localized alpha development.

### Alternative 2: Aggressive Type Overwrite & Network Flush
Completely dismantle the legacy logic in `types/index.d.ts`. Deprecate `senderId`, `recipientId`, and `publicKey` universally in favor of stringently applying EVM properties (`senderAddress`, `recipientAddress`, `operatorAddress`, and `signerAddress`). Furthermore, explicitly execute `ethers.getAddress()` at the `WalletManager` layer natively rejecting non-checksummed addresses outright. Destroy the active datastores fundamentally wiping history.

**Pros:**
- Exquisitely clean codebase strictly aligning with rigorous Ethereum Virtual Machine principles exactly where needed.
- Completely zeroes out the engineering overhead of juggling split-brain typing protocols during block validations.
- Leaves zero "ghost" dependencies on the P2P layer internally.

**Cons:**
- The forced transition actively shreds old development blocks seamlessly destroying balances requiring developers to execute a clean restart.

---

## Proposed Solution (Pivoted)

Through critical comparative analysis, it is emphatically clear that the overhead explicitly tied to maintaining backwards compatibility fundamentally overwhelms any slight convenience saved. Preserving unstructured schemas such as `publicKey` to parse varying cryptographical lengths actively introduces highly vulnerable parsing exploitation routes natively into the overarching Consensus Engine infrastructure.

Therefore, we must **change our opinion on the proposed approach** and formally reject the *Dual-Stack Backwards Compatibility* execution path. 

We will adopt **Alternative 2: Aggressive Type Overwrite & Network Flush**.

**Strategic Mapping:**
1. **Typescript Rigor:** We will rigorously strip identifiers out of `types/index.d.ts` exclusively mapping property definitions natively to ending in `*Address` (e.g., `signerAddress` instead of `publicKey`). We'll update the explicit documentation ensuring Type definitions enforce 42-character `0x` string mappings.
2. **Checksum Integrity:** `WalletManager.ts` will strictly invoke native Ethers checksum utility logic when hashing the $inc operations against Mongo collections, verifying the UI cannot accidentally double-spend using capitalized variants artificially.
3. **Ledger Reset:** We formally accept the structural network flush (`rm -rf data/*`) to align seamlessly alongside our success criteria defined precisely within the `Molar` roadmap.
