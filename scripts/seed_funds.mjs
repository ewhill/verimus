import { MongoClient } from 'mongodb';
import fs from 'fs';

const client = new MongoClient('mongodb://127.0.0.1:27017');

async function seed() {
    try {
        await client.connect();
        const ports = [26780, 26781, 26782, 26783, 26784];
        
        for (const port of ports) {
            const db = client.db(`secure_storage_db_${port}`);
            const pubFile = `keys/peer_${port}.peer.pub`;
            
            if (!fs.existsSync(pubFile)) {
                console.log(`Skipping funding for ${port}, key not found.`);
                continue;
            }
            
            const pubKey = fs.readFileSync(pubFile, 'utf8');
            
            // Generate deterministic genesis distribution transaction
            await db.collection('blocks').insertOne({
                metadata: { index: -1, timestamp: Date.now() },
                type: 'TRANSACTION',
                previousHash: 'mock_genesis_bypass',
                hash: `mock_funds_alloc_${port}`,
                payload: { 
                    senderId: 'SYSTEM', 
                    recipientId: pubKey, 
                    amount: 50000.0, 
                    senderSignature: 'SYSTEM_MINT' 
                },
                publicKey: 'SYSTEM',
                signature: 'SYSTEM_MINT'
            });
            console.log(`Successfully injected 50,000 baseline test tokens into node ${port} ledger.`);
        }
    } catch (err) {
        console.error("Failed to seed offline database metrics:", err);
    } finally {
        await client.close();
    }
}

seed();
