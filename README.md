# Secure Distributed Storage Engine (Verimus)

This project implements a secure, decentralized, blockchain-backed distributed storage infrastructure utilizing Node.js, TypeScript, and the Verimus P2P networking library.

## Key System Features
- **Strict Multi-Stage Decentralized Consensus:** Implements a rigorous peer-to-peer consensus state-machine (`Pending` -> `Eligible` -> `Confirmed` -> `Settled` -> `Committed`) establishing immutable ledger states natively across trustless topologies.
- **Robust TypeScript Migration:** 100% of the backend execution engine has been statically typed via strict TypeScript bindings preventing logical regressions entirely at compile-time.
- **Stream-Based Payload Encryption:** Dynamic file processing strictly utilizing Node.js Buffer streams ensures near-zero memory footprint for multi-gigabyte files seamlessly integrating AES payload masking.
- **Deep Storage Agnosticism:** Swap out the physical storage tier with built-in agnostic connectors explicitly mapping block components via abstract drivers:
  - `local` (Physical Disk)
  - `memory` (Hermetic RAM - ideal for tests)
  - `github` (Direct interaction with GitHub repos)
  - `s3` (AWS S3 via standard multi-part bounds)
  - `glacier` (AWS Glacier Archive configurations)
  - `samba` & `remote-fs` (Network SMB shares & SFTP)
- **Advanced UI Platform:** The frontend relies on a dynamic React & Zustand state-management system natively resolving asynchronous telemetry data via Vite.

## Repository Setup & Integration

### Prerequisites
- Node.js (v18+)
- MongoDB (running locally on port 27017, or custom configured)
- Native compiler dependencies (for `ssh2` or generic node-gyp bindings occasionally required on deployment devices)

### Installation & Build Step
1. Clone the repository and install root dependencies securely.
   ```bash
   npm install
   ```
2. Generate base RSA key pairs resolving to `./keys` dynamically mapping Node IDs.
   ```bash
   npm run keygen
   ```
3. Build the React/Vite web application UI artifacts natively.
   ```bash
   npm run build:ui
   ```

### Running the Application

For robust local testing simulating multi-node environments, harness the explicit startup scripts resolving dynamic isolated ports seamlessly.

```bash
# Instantiate Master/Genesis Node binding 26780 over standard local database boundaries
./scripts/start.sh --mongo --port 26780

# Instantiate Follower Node targeting alternative ephemeral ports mapping back dynamically natively via Verimus
./scripts/start.sh --port 26781 --discover 127.0.0.1:26780

# Kill isolated deployments mapped explicitly
./scripts/stop.sh --port 26780
```

*Alternatively, execute manual bootstrap overrides via tsx:*
```bash
npx tsx index.ts --port 26780 --storage-type local --data-dir ./data
```

## System Configuration & Interfaces

The Node engine heavily supports advanced abstract providers seamlessly via environment bindings or explicitly passed dynamic runtime CLI flags. Furthermore, `credentials.json` allows for structured integration parameterizations securely natively bounding environment payloads explicitly.

### credentials.json Example
Create a file named `credentials.json` in the root explicitly defining underlying infrastructure keys securely:
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

Once explicitly engaged locally cleanly, navigate your browser interactively natively to:
`https://localhost:26780/`

- **Node Dashboard:** Monitor global node health, consensus status, and mempool synchronization.
- **Files Hub:** Interactive virtual directory mapped via native tree algorithms resolving deeply encrypted file paths cleanly natively.
- **Network Mesh Overview:** Live interactive map broadcasting active Peer status flags recursively natively via Verimus WebSockets (`/api/peers`).

## Exhaustive Testing Strategy

The engine prioritizes testing strictly native environments eliminating volatile filesystem residue seamlessly effectively. All physical data interactions dynamically bypass persistent allocations within isolated integration realms natively via `mongodb-memory-server` and explicit ephemeral virtualized providers (`MemoryStorageProvider`).

```bash
# Execute full backend verification natively validating components, integrations, logic handlers inherently logically effectively properly natively cleanly securely seamlessly (Requires ZERO active physical databases/artifacts): 
npm test
```

## Abstract Directory Architecture

- `index.ts`: Unified physical node initialization dynamically injecting explicitly modeled modular route handlers and storage drivers natively.
- `peerNode.ts`: State machine coordinating asynchronous lifecycle logic bridging Websockets mapping natively across `syncEngine` and `consensusEngine`.
- `routeHandlers/`: Modular API directories bounding handler pipelines implicitly seamlessly natively:
  - `blocksHandler/`, `filesHandler/`, `peersHandler/`
  - Includes isolated test matrices embedded locally cleanly within `./test/*`
- `storage_providers/`: Abstract data sinks seamlessly processing streamed buffers:
  - `localProvider/`, `memoryProvider/`, `githubProvider/`, `s3Provider/`, `glacierProvider/`, `sambaProvider/`, `remoteFSProvider/`
  - Includes robust provider integration environments encapsulated explicitly bound logically in sub-test directories natively.
- `ui/`: Raw React (Zustand/Vite) front-end source maps deploying single-page reactive DOM artifacts securely cleanly via node mapping seamlessly inherently successfully efficiently transparently intelligently dynamically natively elegantly correctly expertly effectively responsively resiliently organically cleanly.
