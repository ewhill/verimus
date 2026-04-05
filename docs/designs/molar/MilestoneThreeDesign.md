# Milestone 3: EIP-712 Consensus Validation Integration

## Background
As part of the broader **Molar Roadmap** to integrate EVM standards (secp256k1 addresses) across the Verimus ledger ecosystem, we have decoupled physical network identity from ledger identity (Milestone 1 & 2). We now rely securely on `signerAddress` to track block ownership and wallet asset bounds.

However, the underlying mechanisms for validating and hashing these blocks inside `ConsensusEngine.ts` and throughout the network validation layer remain deeply tied to unstructured blob signatures (via Node.js `crypto` with SHA256 / RSA combinations or generic flat buffer signatures). 

When a user interacts with a Web3 provider like MetaMask on the frontend, asking them to sign an unstructured string blob (like a stringified JSON block) presents terrible user experience and security risks, as the user cannot see the structured parameters of what they are signing. The problem for Milestone 3 is to replace our unstructured block signing mechanisms with a standard that natively bridges Web3 wallet UX with our backend ledger cryptography.

## Proposed Solution: EIP-712 Structured Data Hashing
The proposed, industry-standard approach is to natively adopt **EIP-712 (Ethereum Typed Structured Data Hashing and Signing)**. EIP-712 allows our frontend to pass clearly defined, strictly typed objects (such as `TransactionBlock` or `StorageContractBlock`) to the user's Web3 wallet. The wallet then natively displays the fields (e.g. `recipientAddress`, `amount`, `metadata.index`) to the user in a human-readable format before they sign. 

The backend consensus engine (`ConsensusEngine.ts`) will be refactored to validate these signatures securely using `ethers.verifyTypedData(domain, types, value, signature)`, extracting the `signerAddress` programmatically and strictly confirming block ownership.

**Pros:**
- **Exceptional UX & Security:** Users transparently see what they are signing directly inside their MetaMask GUI. 
- **Strict Typing:** Moves the ledger further toward rigorous, unbreakable schema types since EIP-712 forces strict structural mapping across the node layers.
- **EVM Native:** Integrates effortlessly with `ethers.js` on both the frontend and the `ConsensusEngine.ts` validation processes.

**Cons:**
- **Implementation Complexity:** EIP-712 requires strict definitions of payload types and precise recursive schema mapping. Mismatches between frontend and backend schemas trigger invalid signatures seamlessly.
- **Migration Penalty:** All legacy block hashing and RSA signing bounds inside `ConsensusEngine.ts` will need to be ripped out completely, destroying backwards compatibility (which is already expected for Molar).

## Alternatives Considered

### Alternative 1: EIP-191 (`personal_sign`) stringified JSON execution
Instead of typing the data explicitly using EIP-712 schemas, we map the block object to a canonical JSON string and ask the user to sign the raw string via `personal_sign` (EIP-191). The backend would validate it using `ethers.verifyMessage(stringifiedBlock, signature)`.

**Pros:**
- Much simpler backend execution; relies merely on stringifying data without needing complex `EIP712Domain` or internal types setup.
- Universally supported even on vastly outdated Web3 providers.

**Cons:**
- **Unacceptable UX:** The Web3 wallet obscures the JSON payload as a massive unreadable text block (or hex dump). Users lose all readability, severely opening attack vectors for malicious spoofing.
- **Non-Deterministic Ordering:** JSON serialization is inherently brittle across different JavaScript engines (ordering of keys can mutate the signature unexpectedly).

### Alternative 2: Session Keys (Ephemeral RSA / ECDSA proxy accounts)
Instead of asking MetaMask to sign every block, the Web3 wallet signs a single "login" auth payload granting authority to an ephemeral background keypair (like an RSA key held in local memory or a secondary hidden ECDSA key). That background key directly signs all subsequent blocks, which are verified natively.

**Pros:**
- High throughput; users do not suffer from continuous MetaMask pop-ups when executing multiple data uploads.
- We would not need to drastically alter block-level cryptography architectures.

**Cons:**
- Significantly reduces zero-trust security bounds; a compromised browser tab exposes the ephemeral key to attackers capable of draining funds silently. 
- Adds massive architectural overhead mapping session delegations, expirations, and tracking authorizations securely within blocks.

## Conclusion and Adopted Direction
By heavily prioritizing robust Web3 UX and explicit cryptographic boundary definitions, the **Proposed Solution (EIP-712)** remains overwhelmingly superior. Alternative 1 introduces intolerable UX conditions that fundamentally clash with the user-empowerment ideals of web3, and Alternative 2 incurs immense technical debt while sabotaging security guarantees. We shall therefore proceed natively with adopting EIP-712 across the consensus engine bounds.
