import { ethers } from 'ethers';
import { encrypt } from '@metamask/eth-sig-util';
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
 * Retrieves the base public key string formatting structurally executing the underlying x25519 standard natively.
 */
export const getEncryptionPublicKey = async (account) => {
    if (!hasWeb3Provider()) throw new Error("Web3 boundary failed globally.");
    return await window.ethereum.request({
        method: 'eth_getEncryptionPublicKey',
        params: [account]
    });
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
 * Executes a pure asymmetric Metamask decryption RPC natively dropping local manual entries safely parsing hex back into plaintext mathematically.
 */
export const decryptAESCore = async (hexString, account) => {
    if (!hasWeb3Provider()) throw new Error("Web3 provider logically omitting extraction capabilities.");
    
    // Normalize format locally strictly mimicking the 0x mappings dynamically bounds.
    const normalizedHex = hexString.startsWith('0x') ? hexString : `0x${hexString}`;
    
    return await window.ethereum.request({
        method: 'eth_decrypt',
        params: [normalizedHex, account]
    });
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
