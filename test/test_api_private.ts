const fetch = require('node-fetch');
const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });

async function verifyPayloads() {
    try {
        const cRes = await fetch('https://localhost:26780/api/node/config', { agent });
        const config = await cRes.json();
        
        const bRes = await fetch('https://localhost:26780/api/blocks', { agent });
        const bData = await bRes.json();
        
        const myBlock = bData.blocks.find(b => b.publicKey === config.publicKey);
        if(!myBlock) {
            console.log('No blocks owned by node.');
            return;
        }
        
        console.log('Found Owned Block:', myBlock.hash);
        
        const pRes = await fetch(`https://localhost:26780/api/blocks/${myBlock.hash}/private`, { agent });
        const pData = await pRes.json();
        
        console.log('Payload Data:', pData);
    } catch(err) {
        console.error(err);
    }
}
verifyPayloads();
