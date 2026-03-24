# Verimus P2P - Transport Layer
The `p2p` module constitutes the secure, peer-to-peer execution environment supporting the broader Verimus network footprint. It derives dynamic, cryptographic identities locally per peer context and seamlessly discovers endpoints using robust, decentralized epidemic messaging patterns. 

Built atop HTTPS WebSockets utilizing `RSA-2048` and authenticated `AES-256-GCM` encryption algorithms independently.

### Documentation Directory
For deep architectural insights, refer directly to the `./docs/` folder:
- **[Component Architecture](./docs/Architecture.md)** - Topologies of the localized subsystems.
- **[Gossip Mechanics](./docs/GossipMechanics.md)** - Peer Exchange protocols, duplicate caches, and routing matrices.
- **[Network Security](./docs/Security.md)** - Cryptographic handshake protocols, AEAD implementations, and identity bounds.
- **[Test Coverage](./docs/Testing.md)** - Test expectations, environment setups, and component validation frameworks.

## Installation
This package operates within the global `/p2p/` workspace bounds.
```bash
npm install
```

## Basic Implementation
### 1. Declaring a Peer Instance
```js
const { Peer, Message } = require('p2p');

const peer = new Peer({
  httpsServerConfig: { port: 26780 },
  publicKeyPath: 'myPeerPublicKey.pub',
  privateKeyPath: 'myPeerPrivateKey.pem',
  maxConnections: 50 // Enforces maximum neighbor mapping securely 
});
```

### 2. Initialization and PEX Bounding
Peers instantiate asynchronously matching port mapping bindings securely:
```js
await peer.init();
await peer.discover(["127.0.0.1:26781"]); 
```

### 3. Emitting Context Driven Messages
Define localized extensions using explicitly defined payload templates natively:
```js
class MyCustomMessage extends Message {
  constructor(options = {}) {
    super(options);
    this.value = options.value || '';
  }

  get value() { return this.body.value; }
  set value(v) { this.body.value = v; }
}

// Emits via dynamic Epidemic Routing protocols
await peer.broadcast(new MyCustomMessage({ value: "Hello Network!" }));
```

### 4. Listening for Overlays
Seamlessly structure endpoint handler dependencies mapped locally:
```js
const dynamicHandler = (message, connection) => {
  console.log('Received Message Payload: ', message.value);
};

peer.bind(MyCustomMessage).to(dynamicHandler);
```