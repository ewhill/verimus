# Secure Distributed Storage Engine (Verimus)

This project implements a secure, decentralized, blockchain-backed distributed storage infrastructure utilizing Node.js, TypeScript, and the Verimus P2P networking library.

## Key System Features
- **Strict Multi-Stage Decentralized Consensus:** Implements a rigorous peer-to-peer consensus state-machine (`Pending` -> `Eligible` -> `Confirmed` -> `Settled` -> `Committed`) establishing immutable ledger states across trustless topologies.
- **Stream-Based Payload Encryption:** Dynamic file processing utilizing Node.js Buffer streams ensures near-zero memory footprint for multi-gigabyte files, integrating AES payload masking.
- **Deep Storage Agnosticism:** Swap out the physical storage tier with built-in agnostic connectors mapping block components via abstract drivers:
  - `local` (Physical Disk)
  - `memory` (Hermetic RAM - ideal for tests)
  - `github` (Direct interaction with GitHub repos)
  - `s3` (AWS S3)
  - `glacier` (AWS Glacier Archive)
  - `samba` (Network SMB shares)
  - `remote-fs` (Network SFTP)
- **Decentralized Token Economics:** Natively enforces strict token balances via the newly minted `WalletManager`, rejecting double-spend transaction blocks and instituting a decentralized VERI marketplace initialized organically by an unforgeable Genesis `SYSTEM` treasury.
- **Advanced UI Platform:** The frontend relies on a dynamic React & Zustand state-management system resolving asynchronous telemetry data via Vite.

## Repository Setup & Integration

### Prerequisites
- Node.js (v18+)
- Native compiler dependencies (for `ssh2` or generic node-gyp bindings occasionally required on deployment devices)

### Installation & Build Step
1. Clone the repository and install root dependencies.
   ```bash
   npm install
   ```
2. Generate base RSA key pairs resolving to `./keys` outlining Node IDs.
   ```bash
   npm run keygen
   ```
3. Build the React/Vite web application UI artifacts.
   ```bash
   npm run build:ui
   ```

## Hermetic Deployment Environments

Verimus strictly separates its environments to guarantee absolute data integrity, preventing test loops from bleeding into physical production nodes.

### 1. Test Environment (`npm test`)
Fully hermetic automated execution mapping 100% in-memory data structures. It dynamically spawns `MongoMemoryServer` (Node.js RAM) for all its local database interactions.
*   **Requires:** Nothing but Node.js. Zero Docker or local `mongod` daemons necessary. Fast CI/CD pipelines.

### 2. Local Development Environment 
When you want to manually run the cluster and visually interact with the 5 simulated test nodes in your browser, utilize the testnet bootloader. It launches a standalone Node.js RAM daemon utilizing `mongodb-memory-server` bounded strictly to port `27018`, injects early fund distribution (`seed_funds.mjs`), and gracefully obliterates itself upon exit.
```bash
# Instantiate a 5-peer development cluster natively relying completely on in-memory processes
./scripts/spawn_nodes.sh --mongo
```

### 3. Production Deployment (`npm start`)
For actual public or staging deployments, the environment natively connects to your defined enterprise-grade `MONGO_URI`. It avoids mock environments entirely.
```bash
# Instantiate a genesis seed node natively binding standard ports over an SSD-level MongoDB
./scripts/start.sh --mongo --port 26780

# Instantiate a satellite node resolving an external master node IP
./scripts/start.sh --port 26781 --discover <remote_seed_ip>:26780
```
*Alternatively, execute bootstrap overrides manually:*
```bash
npx tsx index.ts --port 26780 --storage-type local --data-dir ./data
```

## System Configuration & Interfaces

The Node engine supports advanced abstract providers via environment bindings or explicitly passed runtime CLI flags. Furthermore, `credentials.json` allows for structured integration parameterizations.

### credentials.json Example
Create a file named `credentials.json` in the root explicitly defining underlying infrastructure keys:
```json
{
  "github": {
    "githubOwner": "octocat",
    "githubRepo": "hello-world",
    "githubToken": "ghp_xxxxxxxxxxxxxxxxxxx",
    "githubBranch": "main"
  },
  "s3": {
    "accessKeyId": "...",
    "secretAccessKey": "...",
    "bucket": "Verimus-secure-tier",
    "region": "us-east-1"
  }
}
```

Once started, navigate your browser to:
`https://localhost:26780/`

- **Node Dashboard:** Monitor global node health, consensus status, and mempool synchronization.
- **Files Hub:** Interactive virtual directory resolving deeply encrypted file paths.
- **Network Mesh Overview:** Live interactive map broadcasting active Peer status flags via WebSockets (`/api/peers`).

## Exhaustive Testing Strategy

The engine uses isolated environments to eliminate volatile filesystem residue. All physical data interactions bypass persistent allocations via `mongodb-memory-server` and explicit virtualized providers (`MemoryStorageProvider`).

```bash
# Execute full backend verification validating components, integrations, and logic handlers (Requires ZERO active physical databases/artifacts): 
npm test
```

## Abstract Directory Architecture

- `index.ts`: Unified node initialization injecting explicitly modeled modular route handlers and storage drivers.
- `peerNode.ts`: State machine coordinating asynchronous lifecycle logic bridging Websockets across `syncEngine` and `consensusEngine`.
- `route_handlers/`: Modular API directories bounding handler pipelines:
  - `blocks_handler/`, `files_handler/`, `peers_handler/`, etc.
  - Includes isolated test matrices embedded within `./test/*`
- `storage_providers/`: Abstract data sinks processing streamed buffers:
  - `local_provider/`, `memory_provider/`, `github_provider/`, `s3_provider/`, `glacier_provider/`, `samba_provider/`, `remote_fs_provider/`
  - Includes robust provider integration environments encapsulated in sub-test directories.
- `wallet_manager/`: Strictly enforces mathematical blockchain transactions dynamically checking public balances.
- `ui/`: React (Zustand/Vite) front-end deploying a single-page reactive web application.
