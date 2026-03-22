# Chain Synchronization Protocol

This diagram shows how a node seamlessly re-enters the network, compares index parity with an active node, and drains historical ledgers securely before transitioning live.

```mermaid
sequenceDiagram
    participant NewNode
    participant Verimus
    participant ActivePeer
    
    NewNode->>Verimus: init()
    NewNode->>Verimus: wait for peers (5s)
    NewNode->>ActivePeer: Request(ChainStatusRequest, localIndex)
    ActivePeer->>NewNode: Response(ChainStatusResponse, latestIndex, nodePubKey)
    
    alt localIndex < latestIndex
        NewNode->>NewNode: Set isSyncing = true
        NewNode->>ActivePeer: Request(BlockSyncRequest, localIndex+1..latestIndex)
        
        loop For Each Missing Block
            ActivePeer->>NewNode: Response(BlockSyncResponse, BlockData)
            NewNode->>NewNode: Validate Block Cryptographically
            NewNode->>NewNode: Append to Local MongoDB Ledger
        end
        
        NewNode->>NewNode: Set isSyncing = false
        NewNode->>NewNode: Process Buffered Pending/Fork claims (SyncBuffer)
    else localIndex == latestIndex
        NewNode->>NewNode: Fully Synced
    end
```
