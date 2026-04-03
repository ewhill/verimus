import { ethers } from 'ethers';
import { encrypt, decrypt, getEncryptionPublicKey as getEthSigPubKey } from '@metamask/eth-sig-util';
import { Buffer } from 'buffer';

/**
 * Validates window provider presence globally.
 */
export const hasWeb3Provider = () => {
    return typeof window !== 'undefined' && typeof window.ethereum !== 'undefined';
};

/**
 * Requests EVM account integration mapped out from standard extensions logically.
 */
export const requestAccounts = async () => {
    if (!hasWeb3Provider()) throw new Error("No Web3 Provider available contextually. Install Metamask visually.");
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    return accounts[0] || null;
};

/**
 * Deterministically generates a secure offline 32-byte private key mapping securely via a standard EIP-191 Personal Sign organically.
 */
export const derivePrivateKey = async (account) => {
    if (!hasWeb3Provider()) throw new Error("Web3 boundary failed globally.");
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner(account);
    const message = `Approve Verimus Originator proxy... Derive Encryption Key`;
    const signature = await signer.signMessage(message);
    return ethers.id(signature).slice(2);
};

/**
 * Retrieves the base public key string formatting structurally executing the underlying x25519 standard natively.
 */
export const getEncryptionPublicKey = async (account) => {
    const privKey = await derivePrivateKey(account);
    return getEthSigPubKey(privKey);
};

/**
 * Encrypts arbitrary payloads explicitly utilizing asymmetric mapping natively avoiding node.js backend decryption boundaries completely organically. 
 */
export const encryptAESKeyBoundaries = (aesKeyAsText, publicKeyBase64) => {
    // Encrypts text securely matching the x25519-xsalsa20-poly1305 constraints explicitly expected by eth_decrypt bounds.
    const encJSON = encrypt({
        publicKey: publicKeyBase64,
        data: aesKeyAsText,
        version: 'x25519-xsalsa20-poly1305'
    });
    
    // Convert to hex wrapper safely mimicking the RPC formatting natively required mathematically.
    return Buffer.from(JSON.stringify(encJSON), 'utf8').toString('hex');
};

/**
 * Executes a pure asymmetric Metamask decryption natively strictly executing offline AES routines via deterministic keys.
 */
export const decryptAESCore = async (hexString, account) => {
    if (!hasWeb3Provider()) throw new Error("Web3 provider logically omitting extraction capabilities.");
    
    // Normalize format removing the hex prefix naturally securely natively
    const cleanHex = hexString.startsWith('0x') ? hexString.slice(2) : hexString;
    const encData = JSON.parse(Buffer.from(cleanHex, 'hex').toString('utf8'));
    
    const derivedPrivKey = await derivePrivateKey(account);
    return decrypt({ encryptedData: encData, privateKey: derivedPrivKey });
};

/**
 * Cryptographically verifies ownership executing a deterministic EIP-191 Personal Sign mapping dynamically.
 */
export const signOriginatorProxyMessage = async (timestamp, hash, account) => {
    if (!hasWeb3Provider()) throw new Error("Metamask missing structurally.");
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner(account);
    const message = `Approve Verimus Originator proxy for data struct ${hash || 'batch'}\nTimestamp: ${timestamp}`;
    return await signer.signMessage(message);
};

/**
 * Prompts user for a Web3 download limit auth naturally creating Axios mappings logically seamlessly.
 */
export const generateDownloadAuthHeaders = async (hash, account) => {
    if (!hasWeb3Provider()) throw new Error("Metamask missing structurally.");
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner(account);
    const timestamp = Date.now().toString();
    const payload = JSON.stringify({ action: 'download', blockHash: hash, timestamp: timestamp });
    const signature = await signer.signMessage(payload);
    return {
        'x-web3-address': account,
        'x-web3-timestamp': timestamp,
        'x-web3-signature': signature
    };
};
