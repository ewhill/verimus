import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import fs from 'fs';

async function startDaemon() {
    try {
        console.log("Initializing Node.js native ephemeral MongoDB...");
        // Explicitly map port 27018 keeping it strictly hermetic from local 27017 daemons
        const mongod = await MongoMemoryServer.create({
            instance: { port: 27018, dbName: 'admin' }
        });
        
        console.log(`Hermetic MongoDB successfully provisioned at: ${mongod.getUri()}`);
        console.log("Database mapping completely isolated to physical RAM. Safe testing environment active.");
        
        // Natively seed early-testnet boundaries
        const client = new MongoClient(mongod.getUri());
        await client.connect();
        const ports = [26780, 26781, 26782, 26783, 26784];
        for (const port of ports) {
            const db = client.db(`secure_storage_db_${port}`);
            const pubFile = `keys/peer_${port}.peer.pub`;
            if (fs.existsSync(pubFile)) {
                const pubKey = fs.readFileSync(pubFile, 'utf8');
                await db.collection('blocks').insertOne({
                    metadata: { index: -1, timestamp: Date.now() },
                    type: 'TRANSACTION',
                    previousHash: 'mock_genesis_bypass',
                    hash: `mock_funds_alloc_${port}`,
                    payload: { senderId: 'SYSTEM', recipientId: pubKey, amount: 50000.0, senderSignature: 'SYSTEM_MINT' },
                    publicKey: 'SYSTEM',
                    signature: 'SYSTEM_MINT'
                });
                console.log(`Successfully injected 50,000 baseline test tokens into node ${port} ledger.`);
            }
        }
        await client.close();
        
        // Prevent event loop from terminating mimicking a background daemon
        setInterval(() => {}, 1000 * 60 * 60 * 24);
        
        process.on('SIGINT', async () => {
            console.log("\nTerminating in-memory databases. All test data volatilely eliminated.");
            await mongod.stop();
            process.exit(0);
        });
        
        process.on('SIGTERM', async () => {
             console.log("\nTerminating in-memory databases. All test data volatilely eliminated.");
             await mongod.stop();
             process.exit(0);
        });

    } catch (err) {
        console.error("Failed to boot native memory daemon:", err);
        process.exit(1);
    }
}

startDaemon();
