# Component Architecture

The `p2p` module follows a class-oriented object-composition hierarchy decoupled from the top-tier Verimus application.

### Core Components
1. **`Peer.js`**: The overarching operator that initializes connections, maintains the Discovery Address Book, and exposes APIs like `broadcastPeers`. It monitors and enforces the `maxConnections_` limit.
2. **`Client.js`**: Represents individual endpoint connections via the native WebSocket stream. Secures data streams via AES payload protocols using `crypto.createCipheriv`.
3. **`Server.js`**: Encapsulates `ws/wss` listener logic using `EventEmitter` triggers through the `handleUpgrade` bindings filtering inbound clients.
4. **`Message.js`**: Enforces strict topological structures for network transfers. It decodes properties alongside TTL, hash, and signatures parameters.
5. **`ManagedTimeouts.js`**: Eliminates hanging `setTimeout` dependencies, clearing orphan processes upon node closure.
6. **`RequestHandler.js`**: Maintains listener mapping states, validating message structures against handler configurations bound within `Peer.js`.
