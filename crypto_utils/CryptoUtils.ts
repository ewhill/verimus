import * as crypto from 'crypto';

import { ethers } from 'ethers';

import logger from '../logger/Logger';
import type { Block } from '../types';
import { EIP712_DOMAIN, EIP712_SCHEMAS, normalizeBlockForSignature } from './EIP712Types';

/**
 * Generates an RSA key pair.
 */
function generateRSAKeyPair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    return { publicKey, privateKey };
}

/**
 * Sign data with an RSA private key.
 */
function signData(data: Buffer | string, privateKey: string) {
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(data);
    return signer.sign(privateKey, 'hex');
}

/**
 * Generates a SHA256 hash formatting it as hex.
 */
function hashData(data: Buffer | string): string {
    return data ? crypto.createHash('sha256').update(data).digest('hex') : '';
}

/**
 * Encrypts data using AES-256-GCM.
 * Returns { encryptedData, key, iv } (key and iv are hex encoded)
 */
function encryptAES(dataBuffer: Buffer | string) {
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(dataBuffer);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
        encryptedData: encrypted.toString('base64'),
        key: key.toString('hex'),
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
    };
}

/**
 * Creates AES-256-GCM encryption cipher stream.
 * Returns { cipherStream, key, iv } (key and iv are hex encoded)
 */
function createAESStream() {
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);
    const cipherStream = crypto.createCipheriv('aes-256-gcm', key, iv);
    return {
        cipherStream,
        key: key.toString('hex'),
        iv: iv.toString('hex'),
        getAuthTag: () => cipherStream.getAuthTag()
    };
}

/**
 * Creates AES-256-GCM decryption cipher stream.
 * Requires hex encoded key and iv.
 */
function createAESDecryptStream(keyHex: string, ivHex: string, authTagHex?: string) {
    const key = Buffer.from(keyHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    if (authTagHex) decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    return decipher;
}

/**
 * Encrypts an AES key/id using an RSA public key.
 */
function encryptWithRSA(publicKey: string, dataString: string): string {
    const buffer = Buffer.from(dataString, 'utf8');
    const encrypted = crypto.publicEncrypt({
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    }, buffer);
    return encrypted.toString('base64');
}

/**
 * Decrypts with RSA private key.
 */
function decryptWithRSA(privateKey: string, encryptedBase64: string): string {
    const buffer = Buffer.from(encryptedBase64, 'base64');
    const decrypted = crypto.privateDecrypt({
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    }, buffer);
    return decrypted.toString('utf8');
}

/**
 * Verify a signature using an RSA public key.
 */
function verifySignature(data: Buffer | string, signatureHex: string, publicKey: string) {
    try {
        const verifier = crypto.createVerify('RSA-SHA256');
        verifier.update(data);
        return verifier.verify(publicKey, signatureHex, 'hex');
    } catch (_unusedE) {
        return false;
    }
}

/**
 * Decrypts AES-256-GCM encrypted data.
 */
function decryptAES(encryptedBase64: string, keyHex: string, ivHex: string, authTagHex?: string): string {
    const key = Buffer.from(keyHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    if (authTagHex) decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(Buffer.from(encryptedBase64, 'base64'));
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
}

/**
 * Serializes, AES encrypts the payload, and RSA encrypts the AES keys.
 * Returns { encryptedPayloadBase64, encryptedKeyBase64, encryptedIvBase64 }
 */
function encryptPrivatePayload(publicKey: string, payloadObj: object) {
    const payloadStr = JSON.stringify(payloadObj);
    const aesResult = encryptAES(payloadStr);

    const encryptedKey = encryptWithRSA(publicKey, aesResult.key);
    const encryptedIv = encryptWithRSA(publicKey, aesResult.iv);
    const encryptedAuthTag = encryptWithRSA(publicKey, aesResult.authTag);

    return {
        encryptedPayloadBase64: aesResult.encryptedData,
        encryptedKeyBase64: encryptedKey,
        encryptedIvBase64: encryptedIv,
        encryptedAuthTagBase64: encryptedAuthTag
    };
}

/**
 * Reverses the private payload encryption.
 */
function decryptPrivatePayload(privateKey: string, privateObj: { encryptedPayloadBase64: string, encryptedKeyBase64: string, encryptedIvBase64: string, encryptedAuthTagBase64?: string }) {
    const { encryptedPayloadBase64, encryptedKeyBase64, encryptedIvBase64, encryptedAuthTagBase64 } = privateObj;

    // Decrypt AES keys using RSA
    const aesKeyHex = decryptWithRSA(privateKey, encryptedKeyBase64);
    const aesIvHex = decryptWithRSA(privateKey, encryptedIvBase64);
    const authTagHex = encryptedAuthTagBase64 ? decryptWithRSA(privateKey, encryptedAuthTagBase64) : undefined;

    // Decrypt the payload
    const decryptedStr = decryptAES(encryptedPayloadBase64, aesKeyHex, aesIvHex, authTagHex);
    return JSON.parse(decryptedStr);
}
/**
 * Builds a cryptographic Merkle Tree mapping explicit chunk leaves mapping up toward a deterministic node root.
 */
function buildMerkleTree(leaves: (Buffer | string)[]): { tree: string[][]; root: string } {
    if (leaves.length === 0) return { tree: [], root: '' };

    const tree: string[][] = [];
    let currentLayer = leaves.map(l => hashData(l));
    tree.push(currentLayer);

    while (currentLayer.length > 1) {
        const nextLayer: string[] = [];
        for (let i = 0; i < currentLayer.length; i += 2) {
            const left = currentLayer[i];
            const right = i + 1 < currentLayer.length ? currentLayer[i + 1] : left;
            nextLayer.push(hashData(left + right));
        }
        tree.push(nextLayer);
        currentLayer = nextLayer;
    }

    return { tree, root: currentLayer[0] };
}

/**
 * Maps the sibling cryptographic boundaries mathematically pointing any physical chunk directly toward the root.
 */
function getMerkleProof(tree: string[][], leafIndex: number): string[] {
    const proof: string[] = [];
    let currentIndex = leafIndex;

    for (let level = 0; level < tree.length - 1; level++) {
        const layer = tree[level];
        const isLeftOrEven = currentIndex % 2 === 0;
        
        if (isLeftOrEven) {
            const rightSiblingIndex = currentIndex + 1 < layer.length ? currentIndex + 1 : currentIndex;
            proof.push(layer[rightSiblingIndex]);
        } else {
            proof.push(layer[currentIndex - 1]);
        }
        
        currentIndex = Math.floor(currentIndex / 2);
    }

    return proof;
}

/**
 * Validates a returned physical data byte array against an escalating root boundary without mapping the full tree locally.
 */
function verifyMerkleProof(leaf: Buffer | string, proof: string[], root: string, leafIndex: number): boolean {
    if (!root) return false;
    let currentHash = hashData(leaf);
    let currentIndex = leafIndex;

    for (const siblingHash of proof) {
        if (currentIndex % 2 === 0) {
            currentHash = hashData(currentHash + siblingHash);
        } else {
            currentHash = hashData(siblingHash + currentHash);
        }
        currentIndex = Math.floor(currentIndex / 2);
    }
    
    return currentHash === root;
}

/**
 * Validates fundamentally natively block signatures mapped dynamically to EIP-712 standard web3 limits gracefully checking recovering logic implicitly correctly structurally!
 */
function verifyEIP712BlockSignature(block: Block): boolean {
    if (block.signature === 'SYSTEM_SIG' && block.signerAddress === ethers.ZeroAddress) return true;
    if (!block.signature || !block.type || !block.signerAddress) return false;

    try {
        const schema = EIP712_SCHEMAS[block.type];
        if (!schema) return false;

        const valueObj = normalizeBlockForSignature(block);
        
        // Ethers explicitly natively checks standard limits cleanly!
        const recoveredAddr = ethers.verifyTypedData(
            EIP712_DOMAIN,
            schema,
            valueObj.payload ? valueObj : valueObj, // the value itself is the Block mapping explicitly cleanly natively.
            block.signature
        );

        return recoveredAddr.toLowerCase() === block.signerAddress.toLowerCase();
    } catch ( e: any ) {
        logger.error(`EIP712 VERIFY ERROR for block type ${block.type}: ${e.stack || e.message || e}`);
        return false;
    }
}

/**
 * Generates an ephemeral secp256k1 session keypad.
 * Returns an object containing the new transient parameters.
 */
function generateEphemeralSession(): { ephemeralPrivateKey: string; ephemeralPublicKey: string } {
    const ephemeralWallet = ethers.Wallet.createRandom();
    return {
        ephemeralPrivateKey: ephemeralWallet.privateKey,
        ephemeralPublicKey: ephemeralWallet.publicKey
    };
}

/**
 * Proves ownership of the ephemeral context by signing it with the canonical EVM Private Key.
 */
async function signEphemeralPayload(evmPrivateKey: string, ephemeralPublicKey: string): Promise<string> {
    const wallet = new ethers.Wallet(evmPrivateKey);
    return wallet.signMessage(ephemeralPublicKey);
}

/**
 * Computes the shared AES-256-GCM symmetric session secret across the ECDH wire.
 */
function computeSessionSecret(localEphemeralPrivateKey: string, remoteEphemeralPublicKey: string): string {
    const signingKey = new ethers.SigningKey(localEphemeralPrivateKey);
    const sharedSecret = signingKey.computeSharedSecret(remoteEphemeralPublicKey);
    const hash = ethers.keccak256(sharedSecret);
    return hash.substring(2);
}

export {
    generateEphemeralSession,
    signEphemeralPayload,
    computeSessionSecret,
    generateRSAKeyPair,
    signData,
    verifySignature,
    verifyEIP712BlockSignature,
    hashData,
    encryptAES,
    decryptAES,
    createAESStream,
    createAESDecryptStream,
    encryptWithRSA,
    decryptWithRSA,
    encryptPrivatePayload,
    decryptPrivatePayload,
    buildMerkleTree,
    getMerkleProof,
    verifyMerkleProof
};
