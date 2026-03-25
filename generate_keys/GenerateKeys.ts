import * as fs from 'fs';
import * as path from 'path';

import RSAKeyPair from '../p2p/lib/RSAKeyPair';


const PORTS = [26780, 26781, 26782, 26783, 26784];
const KEYS_DIR = path.join(__dirname, 'keys');

if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR);
}

const ringKeyPath = path.join(KEYS_DIR, 'ring.ring.pem');
const ringPubKeyPath = path.join(KEYS_DIR, 'ring.ring.pub');

if (!fs.existsSync(ringKeyPath)) {
    const ringKeys = RSAKeyPair.generate();
    fs.writeFileSync(ringKeyPath, ringKeys.private);
    fs.writeFileSync(ringPubKeyPath, ringKeys.public);
}

const ringKeyPair = new RSAKeyPair({ privateKeyPath: ringKeyPath });

for (const port of PORTS) {
    const baseKey = path.join(KEYS_DIR, `peer_${port}`);
    if (!fs.existsSync(`${baseKey}.peer.pem`)) {
        console.log(`Generating keys for port ${port}...`);
        const peerKeyPair = RSAKeyPair.generate();
        fs.writeFileSync(`${baseKey}.peer.pem`, peerKeyPair.private);
        fs.writeFileSync(`${baseKey}.peer.pub`, peerKeyPair.public);
        
        const signature = ringKeyPair.sign(peerKeyPair.public);
        fs.writeFileSync(`${baseKey}.peer.signature`, signature.toString('hex'));
    }
}

console.log("All keys generated.");
