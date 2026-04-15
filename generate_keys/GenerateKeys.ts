import * as fs from 'fs';
import * as path from 'path';

import { ethers } from 'ethers';


const PORTS = [26780, 26781, 26782, 26783, 26784];
const KEYS_DIR = path.join(__dirname, '..', 'keys');

if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR);
}

for (let i = 0; i < PORTS.length; i++) {
    const port = PORTS[i];
    const baseKey = path.join(KEYS_DIR, `peer_${port}`);
    const nodeJsonPath = path.join(KEYS_DIR, `node_${i}.json`);

    let mnemonic: string;
    let privateKey: string;
    let address: string;

    if (!fs.existsSync(`${baseKey}.evm.key`)) {
        console.log(`Generating keys for port ${port} (node ${i})...`);

        const evmWallet = ethers.Wallet.createRandom();
        fs.writeFileSync(`${baseKey}.evm.key`, evmWallet.privateKey, { mode: 0o600 });
        fs.writeFileSync(`${baseKey}.evm.address`, evmWallet.address);
        if (evmWallet.mnemonic) {
            fs.writeFileSync(`${baseKey}.evm.mnemonic`, evmWallet.mnemonic.phrase, { mode: 0o600 });
        }
        mnemonic = evmWallet.mnemonic?.phrase ?? '';
        privateKey = evmWallet.privateKey;
        address = evmWallet.address;
    } else {
        privateKey = fs.readFileSync(`${baseKey}.evm.key`, 'utf8').trim();
        address = fs.readFileSync(`${baseKey}.evm.address`, 'utf8').trim();
        mnemonic = fs.existsSync(`${baseKey}.evm.mnemonic`)
            ? fs.readFileSync(`${baseKey}.evm.mnemonic`, 'utf8').trim()
            : '';
    }

    // Write node-indexed JSON for Terraform to consume at deploy time
    if (!fs.existsSync(nodeJsonPath)) {
        const nodeJson = JSON.stringify({ node: i, port, address, mnemonic }, null, 2);
        fs.writeFileSync(nodeJsonPath, nodeJson, { mode: 0o600 });
        console.log(`  -> Wrote ${path.relative(path.join(__dirname, '..'), nodeJsonPath)}`);
    }
}

console.log("All keys generated.");


