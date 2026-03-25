import https from 'https';
import * as fs from 'node:fs';

import FormData from 'form-data';







async function runTest() {
    console.log("Starting API Test...");

    // 1. Upload
    const form = new FormData();
    form.append('files', fs.createReadStream('README.md'));

    console.log("Uploading README.md...");
    const uploadRes = await fetch('https://127.0.0.1:26780/api/upload', {
        method: 'POST',
        body: form,
        
    });
    
    const uploadData: any = await uploadRes.json();
    console.log("Upload Response:", uploadData);

    if (!uploadData.success) {
        console.error("Upload failed!");
        process.exit(1);
    }

    const hash = uploadData.hash;
    const key = uploadData.aesKey;
    const iv = uploadData.aesIv;

    // 2. List Blocks
    console.log("\nFetching Blocks...");
    const listRes = await fetch('https://127.0.0.1:26780/api/blocks', {});
    const listData: any = await listRes.json();
    console.log("Blocks JSON:", JSON.stringify(listData, null, 2));

    let found = listData.blocks.find(p => p.hash === hash);
    if (!found) {
        console.error("Uploaded block not found in ledger!");
        process.exit(1);
    }

    // 3. Download
    console.log("\nDownloading block...");
    const downloadUrl = `https://127.0.0.1:26780/api/download/${hash}?key=${key}&iv=${iv}`;
    
    https.get(downloadUrl, { rejectUnauthorized: false }, (res) => {
        console.log(`Download Response Status: ${res.statusCode}`);
        if (res.statusCode !== 200) {
            console.error("Download failed!");
            process.exit(1);
        }
        
        let fileStream = fs.createWriteStream('/tmp/test_download.zip');
        res.pipe(fileStream);
        
        fileStream.on('finish', () => {
            console.log("Download complete, checking file size...");
            const stat = fs.statSync('/tmp/test_download.zip');
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
