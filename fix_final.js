const fs = require('fs');

function replaceSafe(file, matchStr, replaceStr) {
    if (fs.existsSync(file)) {
        let text = fs.readFileSync(file, 'utf8');
        text = text.split(matchStr).join(replaceStr);
        fs.writeFileSync(file, text);
    }
}

replaceSafe('route_handlers/node_config_handler/test/NodeConfigHandler.test.ts', "            publicKey: 'pub',", "            walletAddress: 'pub',");
replaceSafe('route_handlers/peers_handler/test/PeersHandler.test.ts', "            publicKey: 'MOCK_PUB_KEY'", "            walletAddress: 'MOCK_PUB_KEY'");
replaceSafe('route_handlers/peers_handler/test/PeersHandler.test.ts', "            publicKey: 'MOCK_PUB_KEY',", "            walletAddress: 'MOCK_PUB_KEY',");

replaceSafe('peer_handlers/global_auditor/test/GlobalAuditor.test.ts', "            publicKey: 'myPubKey',", "            walletAddress: 'myPubKey',");
replaceSafe('route_handlers/blocks_handler/test/BlocksHandler.test.ts', "            publicKey: 'testPubKey',", "            walletAddress: 'testPubKey',");
replaceSafe('route_handlers/download_handler/test/DownloadHandler.test.ts', '            walletAddress: publicKey,', '            walletAddress: publicKey,');
// Wait, the duplicate property error in DownloadHandler:
replaceSafe('route_handlers/download_handler/test/DownloadHandler.test.ts', '            walletAddress: publicKey,\n            walletAddress: publicKey,', '            walletAddress: publicKey,');
replaceSafe('route_handlers/files_handler/test/FilesHandler.test.ts', "            walletAddress: 'testPubKey',\n            walletAddress: 'testPubKey',", "            walletAddress: 'testPubKey',");

