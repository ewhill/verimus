const fs = require('fs');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function uploadBlock(port, filename, content) {
    fs.writeFileSync(filename, content);
    const form = new FormData();
    const fileContent = fs.readFileSync(filename);
    form.append('files', new Blob([fileContent]), filename);

    const res = await fetch(`https://127.0.0.1:${port}/api/upload`, {
        method: 'POST',
        body: form
    });
    fs.unlinkSync(filename);
    return res.json();
}

async function getBlocks(port, own = false) {
    let url = `https://127.0.0.1:${port}/api/blocks`;
    if (own) url += `?own=true`;
    
    const res = await fetch(url);
    return res.json();
}

async function runTest() {
    console.log("Starting 'own' filter tests...");
    
    // 1. Upload to Node 1
    console.log("Uploading file to Node 1 (26780)...");
    const uploadRes = await uploadBlock(26780, 'test1.txt', 'Hello Node 1');
    if (!uploadRes.success) {
        console.error("Upload failed", uploadRes);
        process.exit(1);
    }
    const hash = uploadRes.hash;
    console.log(`Uploaded block hash: ${hash}`);

    // Check immediately to evaluate the pending block state
    console.log("Checking for pending block immediately...");
    await new Promise(r => setTimeout(r, 50));

    // 2. Query node 1 with own=false to inspect structure
    console.log("Querying Node 1 (26780) with own=false to inspect structure...");
    let node1All = await getBlocks(26780, false);
    let myBlock = node1All.blocks.find(b => b.hash === hash);
    if (myBlock) {
        console.log("Block found in the response. Has publicKey?", !!myBlock.publicKey);
        console.log("Sample publicKey from block:\n", myBlock.publicKey.substring(0, 100) + "...");
    } else {
        console.log("Block not found EVEN WITHOUT FILTER.");
    }

    // 3. Query node 1 with own=true
    console.log("Querying Node 1 (26780) with own=true...");
    let node1Own = await getBlocks(26780, true);
    let foundInNode1Own = node1Own.blocks.some(b => b.hash === hash);
    if (!foundInNode1Own) {
        console.error("ERROR: Block not found in Node 1 with own=true. Filter might be broken.");
        process.exit(1);
    } else {
        console.log("SUCCESS: Block found in Node 1 with own=true.");
    }

    // 3. Query node 2 with own=true
    console.log("Querying Node 2 (26781) with own=true...");
    let node2Own = await getBlocks(26781, true);
    let foundInNode2Own = node2Own.blocks.some(b => b.hash === hash);
    if (foundInNode2Own) {
        console.error("ERROR: Block found in Node 2 with own=true, but Node 2 did not upload it. Filter broken.");
        process.exit(1);
    } else {
        console.log("SUCCESS: Block NOT found in Node 2 with own=true.");
    }

    // 4. Query node 2 with own=false (should see the block)
    console.log("Querying Node 2 (26781) with own=false...");
    let node2All = await getBlocks(26781, false);
    let foundInNode2All = node2All.blocks.some(b => b.hash === hash);
    if (!foundInNode2All) {
        console.error("ERROR: Block not found in Node 2 with own=false. Consensus might be broken or filter logic is wrong.");
        process.exit(1);
    } else {
        console.log("SUCCESS: Block found in Node 2 with own=false.");
    }

    console.log("\\nAll own filter tests passed successfully!");
}

runTest().catch(console.error);
