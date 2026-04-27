const fs = require('fs');

function replaceSafe(file, matchStr, replaceStr) {
    if (fs.existsSync(file)) {
        let text = fs.readFileSync(file, 'utf8');
        text = text.split(matchStr).join(replaceStr);
        fs.writeFileSync(file, text);
    }
}

// 1. UploadHandler
replaceSafe('route_handlers/upload_handler/test/UploadHandler.test.ts', '            publicKey,', '            walletAddress: publicKey,');
replaceSafe('route_handlers/upload_handler/test/UploadHandler.test.ts', '            publicKey: publicKey,', '            walletAddress: publicKey,');

// 2. PrivatePayloadHandler
replaceSafe('route_handlers/private_payload_handler/test/PrivatePayloadHandler.test.ts', "            publicKey: 'MY_KEY',", "            walletAddress: 'MY_KEY',");
replaceSafe('route_handlers/private_payload_handler/test/PrivatePayloadHandler.test.ts', '            publicKey,', '            walletAddress: publicKey,');

// 3. FilesHandler
replaceSafe('route_handlers/files_handler/test/FilesHandler.test.ts', "            publicKey: 'testPubKey',", "            walletAddress: 'testPubKey',");

// 4. DownloadHandler
replaceSafe('route_handlers/download_handler/test/DownloadHandler.test.ts', '            publicKey: publicKey,', '            walletAddress: publicKey,');

// 5. BlocksHandler
replaceSafe('route_handlers/blocks_handler/test/BlocksHandler.test.ts', "            publicKey: 'testPubKey',", "            walletAddress: 'testPubKey',");

// 6. SyncEngine
replaceSafe('peer_handlers/sync_engine/test/SyncEngine.test.ts', "        mockNode.publicKey = 'local-storage';", "        mockNode.walletAddress = 'local-storage';");

// 7. GlobalAuditor
replaceSafe('peer_handlers/global_auditor/test/GlobalAuditor.test.ts', "            publicKey: 'myPubKey',", "            walletAddress: 'myPubKey',");

// Integration tests
replaceSafe('test/integration/LedgerPruning.test.ts', "node.publicKey", "node.walletAddress");
replaceSafe('test/integration/LoadStress.test.ts', "node.publicKey", "node.walletAddress");
replaceSafe('test/integration/ManualTest.ts', "node1.publicKey", "node1.walletAddress");
replaceSafe('test/integration/NetworkPartition.test.ts', "node.publicKey", "node.walletAddress");
replaceSafe('test/integration/SlashingAndStaking.test.ts', "node.publicKey", "node.walletAddress");
