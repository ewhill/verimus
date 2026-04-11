import * as fs from 'fs';
import * as path from 'path';

import { ethers } from 'ethers';




const PORTS = [26780, 26781, 26782, 26783, 26784];
const KEYS_DIR = path.join(__dirname, '..', 'keys');

if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR);
}

for (const port of PORTS) {
    const baseKey = path.join(KEYS_DIR, `peer_${port}`);
    if (!fs.existsSync(`${baseKey}.evm.key`)) {
        console.log(`Generating keys for port ${port}...`);

        const evmWallet = ethers.Wallet.createRandom();
        fs.writeFileSync(`${baseKey}.evm.key`, evmWallet.privateKey, { mode: 0o600 });
        fs.writeFileSync(`${baseKey}.evm.address`, evmWallet.address); // public key ok
        if (evmWallet.mnemonic) {
            fs.writeFileSync(`${baseKey}.evm.mnemonic`, evmWallet.mnemonic.phrase, { mode: 0o600 });
        }
    }
}

console.log("All keys generated.");
