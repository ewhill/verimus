const fs = require('fs');

function removeDuplicates(file) {
    if (fs.existsSync(file)) {
        let text = fs.readFileSync(file, 'utf8');
        text = text.replace(/walletAddress: 'myPubKey',\n\s*walletAddress: 'myPubKey',/g, "walletAddress: 'myPubKey',");
        text = text.replace(/walletAddress: 'testPubKey',\n\s*walletAddress: 'testPubKey',/g, "walletAddress: 'testPubKey',");
        fs.writeFileSync(file, text);
    }
}

removeDuplicates('peer_handlers/global_auditor/test/GlobalAuditor.test.ts');
removeDuplicates('route_handlers/blocks_handler/test/BlocksHandler.test.ts');
