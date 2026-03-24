# Project Clementine: Decentralized Storage Marketplace & Replication Proposal

## 1. Executive Summary
Currently, our network relies on an originating node storing encrypted data with its own private key, creating a critical single point of failure if that node disconnects or loses its key. To mitigate this risk and ensure robust data availability, this proposal outlines a marketplace-driven consensus model. It shifts the network from isolated single-node storage to decentralized, compensated replication across **N** trusted peers integrated into a blockchain economy.

## 2. Core Architectural Shifts

### 2.1 Block Typings & Peer Wallets
The blockchain will transition from holding homogeneous blocks to supporting specific **"Types"**. Because Project Clementine is a formal hard fork, legacy data blocks are fully deprecated. The ledger acts exclusively as a marketplace configuration matrix tracking:
- **`TRANSACTION` Blocks**: Tracks initial disbursements and ongoing balances across nodes.
- **`STORAGE_CONTRACT` Blocks**: Finalized agreements recording storage shards across peers.
- **Wallet States**: The local ledger state will calculate active wallet balances for every peer recursively based on the chain's immutable history, preventing Double-Spending or Over-Drafting.

### 2.2 Ring Cryptographic Authentication
Peers will encrypt underlying data using localized private keys bound and verified by the master `ring` signature. This maintains privacy while ensuring all bid responses, requests, and payloads undeniably originate from trusted ring members.

### 2.3 Peer Operational Modes
To accommodate flexible network participation, the architecture shifts to support explicit operational modes, allowing peers to opt-in to specific labor domains rather than forcing homogenous responsibilities across the entire grid:
1. **Storage Nodes**: Hosts that provision persistent physical capacity and storage providers to participate directly in the marketplace economy, receiving heavy contract payouts for securing raw data.
2. **Validator Nodes**: Lightweight nodes operating strictly as network auditors. These peers elect to opt-out of demanding storage contracts entirely. Instead, they act purely as third-party watchdogs, executing cryptographic verification routines (see Section 5.1) during sortition intervals to secure recurring, passive transactional rewards without dedicating any localized storage infrastructure.
3. **Request Originators**: Client nodes acting solely as data owners and wallet proxies, drafting and funding `StorageRequestMessage` contracts but opting out of both validating and hosting data locally.

## 3. The P2P Storage Marketplace Lifecycle

### 3.1 Broadcasting Storage Requests
When an originating peer wishes to store data, it broadcasts a `StorageRequestMessage` across the ring. This request specifies:
- **Redundancy**: `N`-node replication parameters.
- **Availability Constraints**: Expected read-access latency boundaries (seconds / minutes / hours / days).
- **Data Footprint**: Exact storage size.
- **Proof-of-Storage Chunk Size**: The cryptographic window size (e.g., hash every 1MB) used to build the verification map.

**Fund & Configuration Verification Penalty**: Receiving peers analyze the request locally. 
- If an originating peer lacks the funds to cover the request, it is flagged by the `ReputationManager` for malicious activity, penalized, and the request is dropped.
- If the requested `Chunk Size` is excessively small (defined as less than `1/N` the size of the whole file), this constitutes abusive network overhead. The requesting seed peer receives a minor reputation penalty and the request is ignored.

### 3.2 Bidding and Storage Economics
A peer's outward network bid aggregates internal provider costs and overhead. The `getCostPerGB()` and overhead structures are determined through **Peer Configuration**. Node operators can configure static base minimums or allow providers to fetch dynamic constraints (e.g., polling S3 API pricing structures over time to account for contract duration).

*Note on Network Constraints:* `MemoryProvider` abstractions are strictly prohibited in the production network implementation; memory providers will be restricted exclusively to unit and integration test environments.

Healthy nodes broadcast a `StorageBidMessage` containing their storage fee.

### 3.3 Contract Formation
The originating peer receives bids over a fixed timeframe. It selects the optimal `N` peers that satisfy the thresholds at the lowest cost, drafting a tentative **Storage Contract**.

**Handling Discarded/Failed Consensus Data**:
To handle the risk of data being transferred but consensus failing, contracts operate in a two-phase commit state constraint.
1. The contract is broadcast to the network's mempool, freezing the originating node's funds.
2. If the block fails to gain consensus among the wider network during this reservation phase, the contract is abandoned immediately. No storage transfer occurs, no funds are captured by the hosts, and the originating peer is responsible for issuing a brand-new contract request.

## 4. Contract Fulfillment & Initial Data Seeding

### 4.1 Data Transfer & Hash Mapping
The originating node (the `seed`) safely shards the encrypted file to the `N` selected storage peers. Contractual fulfillment is asserted during the write operation to avoid unnecessary back-and-forth sequences.
1. As the storage peer receives the payload stream, it computes cryptographic hashes of every chunk (as defined by the configured `Chunk Size`).
2. The storage node retains these chunk-hash pairs. Crucially, the seed node also pre-computes this exact hash map and embeds it into the tentative contract block itself.
3. Upon completing the stream, the seed peer issues a challenge requesting a random sparse-sample of chunk hashes.

### 4.2 Initial Verification Failure
If the returned hashes fail to match the seed's expectations, the initial verification sequence halts. The storage peer has failed to store the data properly or has attempted a malicious spoof. The contract bounds for that specific peer are voided, a reputation penalty is levied against them holding them accountable for data corruption, and the seed peer must solicit a replacement storage host from the remaining network bids.

If the hashes succeed, the storage peer signs a `FulfillmentReceipt`.

## 5. Ongoing Proof-of-Storage (Network Auditing)

To prevent a malicious node from streaming data directly to `/dev/null` or deleting it post-contract formation, the economic payouts are distributed transactionally over the life of the contract rather than upfront.

### 5.1 The Verification Routine
Since the precomputed chunk hashes are stored publicly in the minted `STORAGE_CONTRACT` block, any node on the network can verify the payload. 
- **Predefined Intervals**: The contract encodes specific, predefined chronological intervals at which the data must be verified, spanning from the creation time until the contract termination.
- **Third-Party Auditors (Deterministic Sortition)**: Rather than relying on a centralized or exploitable RNG lottery, the network selects the auditing peer via a decentralized cryptographic sortition model. At the start of each interval, all nodes independently compute a deterministic seed: `hash(StorageContractBlockId + IntervalTimestamp + LatestChainHash)`. The network peer whose public key hash falls closest to this seed (via XOR distance) becomes the undisputed verifier. This guarantees that all nodes universally agree on the chosen auditor without required communication, while the moving variables ensure the selection cycles evenly across all peers, eliminating hotspots.
- **Transactional Rewards**: If the host successfully returns the correct hashes requested by the crypto-elected auditor, a `TRANSACTION` block is generated. This block transfers a payout from the seed's locked funds to **both** the storing node (for successfully hosting the data) and the verifying node (as a reward for executing network consensus labor).

Failing these recurring checks triggers an immediate suspension of all future contract payouts and severe recurring network reputation penalties (including banishment) against the hosting node.

## 6. Consensus & Final Block Minting

A contract is initially established only if the seed verifies the data stream against all `N` contracted peers. 
Once all `N` `FulfillmentReceipts` are collected, the seed broadcasts the finalized `STORAGE_CONTRACT` block to the network spanning:
1. The initial contract conditions and payment intervals.
2. The `1..N` fulfillment signatures of the host peers.
3. The exact topological locations mapped for retrieval.
4. The full cryptographic chunk-hash map required for ongoing third-party auditing.

The network verifies the signatures. Upon consensus, the block is minted, formally placing the locked seed funds in escrow and permanently activating the ongoing Proof-of-Storage auditing timeline.
