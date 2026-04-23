const fetch = require('node-fetch');
async function test() {
    try {
        const res = await fetch("https://127.0.0.1:26780/api/ledger/mempool", {
            headers: { 'Authorization': 'Basic ' + Buffer.from('admin:test').toString('base64') }
        });
        const text = await res.text();
        console.log(text.slice(0, 500));
    } catch(e) {
        console.log(e.message);
    }
}
test();
