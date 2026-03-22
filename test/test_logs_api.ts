const https = require('https');

const agent = new https.Agent({
    rejectUnauthorized: false
});

async function runTest() {
    try {
        console.log("Fetching logs from Node 1 (port 26780)...");
        
        https.get('https://localhost:26780/api/logs', { agent }, (res) => {
            if (res.statusCode !== 200) {
                console.error("HTTP Error:", res.statusCode);
                process.exit(1);
            }
            
            let data = '';
            res.on('data', chunk => data += chunk);
            
            res.on('end', () => {
                const logs = JSON.parse(data);
                console.log(`Successfully fetched ${logs.length} logs.`);
                
                if (logs.length > 0) {
                    console.log("First log:");
                    console.log(logs[0]);
                    console.log("Last log:");
                    console.log(logs[logs.length - 1]);
                }
                
                // Let's also verify that it doesn't exceed 200 logs
                if (logs.length <= 200) {
                    console.log("✅ Log tail is within the 200 limit.");
                } else {
                    console.error("❌ Log tail exceeded the 200 limit.");
                    process.exit(1);
                }
            });
        }).on('error', (err) => {
            console.error("Request failed:", err.message);
            process.exit(1);
        });

    } catch (error) {
        console.error("Test failed:", error.message);
        process.exit(1);
    }
}

runTest();
