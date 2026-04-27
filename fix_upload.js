const fs = require('fs');
const file = 'route_handlers/upload_handler/test/UploadHandler.test.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/publicKey: publicKey,/g, 'walletAddress: publicKey,');
content = content.replace(/            publicKey,\n/g, '            walletAddress: publicKey,\n');
fs.writeFileSync(file, content);
