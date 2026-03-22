const https = require('https');
const fs = require('fs');

async function runTest() {
    const agent = new https.Agent({ rejectUnauthorized: false });

    // 1. List Blocks
    console.log("Fetching Blocks...");
    const listRes = await fetch('https://127.0.0.1:26780/api/blocks', {});
    const listData: any = await listRes.json();
    console.log("Blocks API Result:");
    console.log(JSON.stringify(listData, null, 2));

    if (!listData.success || listData.blocks.length === 0) {
        console.error("No blocks found in ledger!");
        process.exit(1);
    }
    
    // Test the newly created one
    const pkg = listData.blocks[0];
    const hash = pkg.hash;
    
    // We already have the key/iv from upload, I'll hardcode them from the cURL output for this automated test
    const key = "9b07de7acc704c32ac8c9ffe37dc03c1b2193579630c6840ce91686eec9044e1";
    const iv = "0d050764a6afbab61c401d29487b2747";

    // 2. Download
    console.log(`\nDownloading block ${hash}...`);
    const downloadUrl = `https://127.0.0.1:26780/api/download/${hash}?key=${key}&iv=${iv}`;
    
    https.get(downloadUrl, { rejectUnauthorized: false }, (res) => {
        console.log(`Download Response Status: ${res.statusCode}`);
        if (res.statusCode !== 200) {
            console.error("Download failed!");
            process.exit(1);
        }
        
        let fileStream = fs.createWriteStream('/tmp/test_download2.zip');
        res.pipe(fileStream);
        
        fileStream.on('finish', () => {
            console.log("Download complete!");
            const stat = fs.statSync('/tmp/test_download2.zip');
            console.log(`File size: ${stat.size} bytes`);
            console.log("\nALL TESTS PASSED!");
            process.exit(0);
        });
    }).on('error', (e) => {
        console.error(e);
        process.exit(1);
    });
}

runTest().catch(console.error);
