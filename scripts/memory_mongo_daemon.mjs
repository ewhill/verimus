import { MongoMemoryServer } from 'mongodb-memory-server';

async function startDaemon() {
    try {
        console.log("Initializing Node.js native ephemeral MongoDB...");
        // Explicitly map port 27018 keeping it strictly hermetic from local 27017 daemons
        const mongod = await MongoMemoryServer.create({
            instance: { port: 27018, dbName: 'admin' }
        });
        
        console.log(`Hermetic MongoDB successfully provisioned at: ${mongod.getUri()}`);
        console.log("Database mapping completely isolated to physical RAM. Safe testing environment active.");
        
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
