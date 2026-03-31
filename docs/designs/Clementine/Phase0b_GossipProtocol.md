# Phase 0b: Epidemic Routing (Gossip Protocol) Overlay

## Objective
To scale the transport layer beyond a fully-connected mesh by implementing strict connection limits and an epidemic routing (Gossip) protocol. This enables the network to support hundreds of thousands of nodes while avoiding socket exhaustion and amplification attacks.

## Core Architectural Changes

### 1. Hard Connection Limits
A peer can no longer maintain connections to all known nodes in the network.
- **Max Peers Configuration**: Enforce a hard cap (e.g., `maxConnections = 50`) on the total inbound and outbound WebSocket connections a single peer will accept or maintain.
- **Triage and Rotation**: The peer must monitor the health and reputation of its active connections, dropping unresponsive nodes to free up slots for new discoveries.

### 2. The Gossip Overlay & Relaying
Network broadcasts will now propagate epidemically (hop-by-hop) rather than through a direct flat mesh.
- **Relay Mechanism**: Modify `Peer.broadcast()` to send payloads only to active neighbors. When a peer receives a network message, it must re-invoke `broadcast()` to forward the payload to its own neighbors (excluding the sender).
- **Static Time-To-Live (TTL)**: Introduce a `ttl` integer field into the `p2p` `Message` structure (e.g., initial value of 20). Each relay decrements the TTL by 1. A message with a TTL of 0 is dropped without forwarding, establishing a strict upper bound on network diameter traversal.

### 3. LRU Cache Loop Prevention
To prevent broadcast storms and infinite routing loops, introduce an LRU (Least Recently Used) cache mechanism directly into the peer's message parsing pipeline.
- **Seen Message Tracker**: Track the `hash` of all recently received messages.
- **Deduplication**: If a message hash is already present in the LRU cache, the node silently drops the message. This serves as the primary firewall against network saturation.

### 4. Decentralized Peer Exchange (PEX)
Decouple the "known addresses list" from the "actively connected peers" array.
- Peers maintain a persistent address book of known nodes on disk but only selectively connect to a fraction of them.
- Introduce an explicit `GetPeersMessage` / `PeersResponseMessage` pattern to allow nodes to periodically request random swaths of known IP addresses from their neighbors to keep their local address books populated.
