import * as fs from 'fs';
import * as path from 'path';

import { ethers } from 'ethers';

import RSAKeyPair from '../p2p/lib/RSAKeyPair';


const PORTS = [26780, 26781, 26782, 26783, 26784];
const KEYS_DIR = path.join(__dirname, 'keys');

if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR);
}

for (const port of PORTS) {
    const baseKey = path.join(KEYS_DIR, `peer_${port}`);
    if (!fs.existsSync(`${baseKey}.peer.pem`)) {
        console.log(`Generating keys for port ${port}...`);
        const peerKeyPair = RSAKeyPair.generate();
        fs.writeFileSync(`${baseKey}.peer.pem`, peerKeyPair.private);
        fs.writeFileSync(`${baseKey}.peer.pub`, peerKeyPair.public);

        const evmWallet = ethers.Wallet.createRandom();
        fs.writeFileSync(`${baseKey}.evm.key`, evmWallet.privateKey);
        fs.writeFileSync(`${baseKey}.evm.address`, evmWallet.address);
    }
}

console.log("All keys generated.");
