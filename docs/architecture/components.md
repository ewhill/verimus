# System Architecture: Verimus Secure Storage

This diagram illustrates the boundaries between the modern Zustand-driven frontend, the Express API Layer, the Core Node processing topologies (Consensus and Sync), and the underlying storage drivers.

```mermaid
graph TD
    subgraph UI[React Frontend (Vite)]
        Zustand[Zustand Store] --> Components[React Web App]
        Components --> ApiService[ApiService.js]
    end

    subgraph Backend[Node.js Backend]
        ApiService --> Express[Express API Routes]
        Express --> PeerNode[PeerNode Core]
        
        PeerNode --> ConsensusEngine[ConsensusEngine]
        PeerNode --> SyncEngine[SyncEngine]
        
        ConsensusEngine --> Mempool[(Mempool Cache)]
        SyncEngine --> SyncBuffer[(Orphan Sync Buffer)]
    end

    subgraph Data Layer
        PeerNode --> MongoDB[(MongoDB Ledger)]
        PeerNode --> Providers[Storage Providers]
        Providers --> Local[Local Disk]
        Providers --> Memory[Volatile Memory]
        Providers --> Samba[Samba SMB]
        Providers --> RemoteFS[Remote SSH FS]
        Providers --> AWS[AWS S3/Glacier]
        Providers --> Github[GitHub Repos]
    end

    subgraph Network Layer
        PeerNode --> Verimus[Verimus P2P Protocol]
        ConsensusEngine --> Verimus
        SyncEngine --> Verimus
        Verimus <--> OtherPeers[Other Network Nodes]
    end
```
