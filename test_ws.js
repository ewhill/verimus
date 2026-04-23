const WebSocket = require('ws');
console.log("NODE_TLS_REJECT_UNAUTHORIZED is", process.env.NODE_TLS_REJECT_UNAUTHORIZED);
let rejectUnauthorized = true;
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED == 0) {
    rejectUnauthorized = false;
}
console.log("rejectUnauthorized is", rejectUnauthorized);
const ws = new WebSocket('wss://127.0.0.1:26781', [], { rejectUnauthorized });
ws.on('error', (e) => {
    console.log("Error:", e.message);
});
ws.on('open', () => {
    console.log("Connected!");
});
