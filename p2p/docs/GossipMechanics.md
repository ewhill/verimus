# P2P Gossip Protocols & Epidemic Routing

The Verimus P2P node integrates epidemic networking procedures enabling permissionless communication while maintaining bounded topologies.

### Routing Mechanics & Overlays
1. **Socket Cap Limits**:
    * Managed by the `maxConnections_` variable in `Peer.js`, defaulting to 50 connections. Connections exceeding this cap are dropped to defend against port saturation limits.
2. **Epidemic Time-to-Live (TTL)**:
    * Enforced via the `.broadcast(message)` protocol checking `message.ttl`. It decrements before transmitting payloads to immediate neighbors, ensuring loops drop when reaching 0, covering logarithmic network sizes.
3. **LRU Duplicate Deduplication**:
    * `seenMessageHashes_` acts as a 5000-slot dictionary cache mapping `message.header.hash` concatenated to `message.header.signature`. Identical requests arriving sequentially through independent nodes are ignored, preventing infinite feedback loops.
4. **Decoupled Peer Exchange (PEX)**:
    * Utilizes `PeersRequestMessage` and `PeersResponseMessage` abstractions for discovery. Unverified nodes are deposited into `this.discoveryAddressBook_`, mapping passively in memory without attempting automated dialing unless the connection floor evaluates below 50% utilization.
