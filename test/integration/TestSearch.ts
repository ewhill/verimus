import * as fs from 'node:fs';


process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function uploadBlock(port, filename, content) {
    fs.writeFileSync(filename, content);
    
    // Polyfill using FormData inside Node.js
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

async function searchBlocks(port, queryStr) {
    const url = `https://127.0.0.1:${port}/api/blocks?q=${encodeURIComponent(queryStr)}`;
    const res = await fetch(url);
    return res.json();
}

async function runTest() {
    console.log("Starting Search functionality tests...");
    
    // 1. Upload known file to Node 1
    const filename = `search_test_${Date.now()}.md`;
    console.log(`Uploading known file ${filename} to Node 1 (26780)...`);
    const uploadRes: any = await uploadBlock(26780, filename, '# Test Search File\nTesting search');
    if (!uploadRes.success) {
        console.error("Upload failed", uploadRes);
        process.exit(1);
    }
    const hash = uploadRes.hash;
    console.log(`Uploaded block hash: ${hash}`);

    // Wait a brief moment to ensure block is processed
    await new Promise(r => setTimeout(r, 200));

    // 2. Search Node 1 for exact match
    console.log(`\nQuerying Node 1 (26780) with q=${filename}...`);
    let searchExact = await searchBlocks(26780, filename);
    let exactFound = (searchExact as { blocks: any[] }).blocks.some((b: any) => b.hash === hash);
    if (!exactFound) {
        console.error("ERROR: Block not found when searching for its exact filename.");
        process.exit(1);
    } else {
        console.log("SUCCESS: Block found when searching exact filename.");
    }

    // 3. Search Node 1 for partial match (case-insensitive)
    const partialName = filename.substring(0, 11).toUpperCase(); // e.g., "SEARCH_TEST"
    console.log(`\nQuerying Node 1 (26780) with partial/case-insensitive q=${partialName}...`);
    let searchPartial = await searchBlocks(26780, partialName);
    let partialFound = (searchPartial as { blocks: any[] }).blocks.some((b: any) => b.hash === hash);
    if (!partialFound) {
        console.error("ERROR: Block not found when searching partial/case-insensitive filename.");
        process.exit(1);
    } else {
        console.log("SUCCESS: Block found using partial case-insensitive search.");
    }

    // 4. Search Node 1 with an invalid query
    const invalidQuery = `not_a_real_file_${Date.now()}`;
    console.log(`\nQuerying Node 1 (26780) with invalid q=${invalidQuery}...`);
    let searchInvalid = await searchBlocks(26780, invalidQuery);
    let invalidFound = (searchInvalid as { blocks: any[] }).blocks.some((b: any) => b.hash === hash);
    if (invalidFound) {
        console.error("ERROR: Block incorrectly returned when searching for an invalid filename.", (searchInvalid as { blocks: any[] }).blocks);
        process.exit(1);
    } else {
        console.log("SUCCESS: Block filtered out for an invalid search term.");
    }

    console.log("\nAll search feature tests passed successfully!");
}

runTest().catch(err => {
    console.error(err);
    process.exit(1);
});
