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
- **Advanced UI Platform:** The frontend relies on a dynamic React & Zustand state-management system resolving asynchronous telemetry data via Vite.

## Repository Setup & Integration

### Prerequisites
- Node.js (v18+)
- MongoDB (running locally on port 27017, or custom configured)
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

### Running the Application

For local testing simulating multi-node environments, harness the startup scripts.

```bash
# Instantiate Master/Genesis Node binding 26780 over standard local database boundaries
./scripts/start.sh --mongo --port 26780

# Instantiate Follower Node targeting alternative sequential ports
./scripts/start.sh --port 26781 --discover 127.0.0.1:26780

# Kill isolated deployments
./scripts/stop.sh --port 26780
```

*Alternatively, execute manual bootstrap overrides via tsx:*
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
- `routeHandlers/`: Modular API directories bounding handler pipelines:
  - `blocksHandler/`, `filesHandler/`, `peersHandler/`
  - Includes isolated test matrices embedded within `./test/*`
- `storage_providers/`: Abstract data sinks processing streamed buffers:
  - `localProvider/`, `memoryProvider/`, `githubProvider/`, `s3Provider/`, `glacierProvider/`, `sambaProvider/`, `remoteFSProvider/`
  - Includes robust provider integration environments encapsulated in sub-test directories.
- `ui/`: React (Zustand/Vite) front-end deploying a single-page reactive web application.
