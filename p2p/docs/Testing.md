# P2P Isolation Testing Strategy

The Verimus P2P integration enforces testing bounds through the `./test` folder executing `tape` assertions spanning local structures without instantiating full cluster topology dependencies.

### Suite Mechanics
- Execute `npm test` within the isolated `p2p` module.
- Over `105` test scenarios simulate abstract endpoints verifying core protocols.

### Key Covered Parameters
1. **Network Topology Configurations**: `PeerProxy` tests route isolated instances communicating via intermediate servers verifying active gossip protocols.
2. **Payload Parsing Bounds**: Identifies `Message.js` constructors extracting cryptographic properties.
3. **PEX Routing Limitations**: Evaluates `limit` and `since` properties across structured payload handlers simulating address book logic.
4. **Hermetic Memory Simulation**: Tape isolates endpoints opening temporary local server bounds while tearing down configurations preventing port leakage.
