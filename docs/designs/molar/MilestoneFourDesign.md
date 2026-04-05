# Milestone 4: Native Front-End MetaMask Injection API

## Background
As defined in the Molar Roadmap, the Verimus ledger ecosystem has successfully migrated its backend identity and consensus bounds to EVM standards. Milestone 2 overhauled the ledger data model to strictly utilize `0x` execution addressing natively, and Milestone 3 transitioned `ConsensusEngine.ts` to rely exclusively on EIP-712 structured data hashing for signature validation. 

Despite these backend advancements, the localized physical front-end UI remains disconnected from standard Web3 interfaces. Currently, the UI blindly constructs execution payloads without natively invoking browser wallet capabilities to enforce cryptographic confirmations. The overarching problem for Milestone 4 is bridging the localized UI securely to an active Web3 wallet (e.g., MetaMask), ensuring that transaction dispatching natively leverages standard injected capabilities. This guarantees that users strictly authorize every network action through visible JSON-RPC confirmation events before the localized backend API executes them.

## Proposed Solution: Singular EIP-1193 Provider Injection (`window.ethereum`)
The initial industry standard approach is to implement explicit EIP-1193 provider injection, targeting the globally available `window.ethereum` object exposed by MetaMask. Using a library like `ethers`, we wrap this injected object inside an `ethers.BrowserProvider`. When a user attempts to execute a protected UI action (e.g., `UploadModal` or `SendModal`), the frontend marshals an `eth_signTypedData_v4` JSON-RPC call. The payload triggers a direct MetaMask signature popup, empowering the user to authorize the action before transmission to the Verimus endpoint.

**Pros:**
- **Simplicity & Directness:** Implements an incredibly widespread web3 pattern requiring minimal frontend package overhead.
- **Wallet Transparency:** Fulfills the roadmap requirement seamlessly by putting exact payload bounds immediately in front of the user inside an uncompromisable MetaMask popup.

**Cons:**
- **Provider Collisions:** Single provider target (`window.ethereum`) is notoriously fragile. If a user runs multiple extension-based wallets (e.g., Brave Wallet alongside MetaMask or Coinbase Wallet), race conditions frequently occur as varying extensions forcefully overwrite the global `window.ethereum` object, crashing the application deterministically.
- **Brittle UX:** Silent failure cascades occur if the targeted provider name doesn’t align with what the specific version of `ethers` is listening strictly against.

## Alternatives Considered

### Alternative 1: EIP-6963 (Multi Injected Provider Discovery)
Instead of hardcoding against the globally mutable `window.ethereum` object, the UI subscribes to the browser-native `eip6963:requestProvider` event dispatcher. Wallets that adhere to this standard explicitly announce themselves (`eip6963:announceProvider`), mapping their capabilities iteratively inside a standardized `EIP6963ProviderDetail` payload mapping.

**Pros:**
- **Complete Race Condition Elimination:** Bypasses provider injection wars completely, guaranteeing dependable connections in heavily populated extension environments.
- **Future Proofing:** Seamlessly supports any standard Web3 wallet (Rabby, Rainbow, Trust Wallet) without demanding Verimus developers write custom bridging shims, all while honoring the original mandate to support MetaMask natively.
- **Enhanced UX Transparency:** Enables dynamic rendering of the user's explicit connected wallet UI icon (e.g., MetaMask Fox vs Rabby Icon) directly inside the Verimus web application context.

**Cons:**
- **Implementation Complexity:** Injects supplementary event-listener subscription boilerplates strictly mapped to browser mount lifecycles.
- **TypeScript Overhead:** Requires manually defining and augmenting strict `window` Event interface definitions mapped to `EIP6963` standards, complicating early test implementation mapping bounds.

### Alternative 2: Backend Keystore Custody (Server-Side Auto-Signing)
Instead of forcing the frontend to establish a Web3 bridge, the physical Verimus node retains an encrypted session lockbox holding custody over the user's private keys. The Frontend submits simple unauthenticated payload instructions, and the Backend autonomously drafts, hashes, and signs the Ethereum packets out-of-band utilizing the node's local filesystem capabilities. 

**Pros:**
- **Frictionless UX:** Recreates the familiar seamless centralized upload experience for users without halting interactions endlessly behind continuous MetaMask popups.
- **Decoupled Browser Constraints:** Completely ignores the user's local operating system or browser limitations. Even vanilla Safari instances could upload perfectly since the Web3 execution happens solely Server-Side.

**Cons:**
- **Zero-Trust Annihilation:** Unilaterally abandons the secure, decentralized trust model established in prior Molar milestones. If the Verimus node memory is ever compromised, the local keys act universally vulnerable.
- **Regulatory Paradigm Breach:** Forcing a centralized node component to handle cryptographic signing of economic transactions directly breaks fundamental Web3 operating paradigms in an unacceptable capacity.

## Conclusion and Adopted Direction
Through comparative analysis, the initial **Proposed Solution (`window.ethereum` targeted injection)** presents substantial fragility risks strictly due to the volatile ecosystem of competitive Web3 wallet extensions. Acknowledging this, we are fundamentally abandoning the archaic `window.ethereum` mapping strategy.

Further, **Alternative 2 (Backend Keystore Custody)** is unequivocally rejected, as it invalidates the very security parameters this roadmap phase exists to defend. 

Consequently, we are upgrading and pivoting our approach to firmly embrace **Alternative 1 (EIP-6963 Multi Injected Provider Discovery)**. Despite the minor frontend TypeScript implementation complexities, this architecture dramatically extends the reliability of the UI. It safely captures the exact functionality needed for our MetaMask injection directives, actively mitigates race conditions from overlapping extensions, and aligns Verimus perfectly with modern EVM integration topology.
