import { ethers } from 'ethers';
import { encrypt, decrypt, getEncryptionPublicKey as getEthSigPubKey } from '@metamask/eth-sig-util';

/**
 * Initializes the EIP-6963 event listener and triggers the global provider ping.
 */
export const initializeEIP6963Discovery = (dispatch) => {
    const handleProvider = (e) => {
        dispatch({ type: 'ADD_DISCOVERED_PROVIDER', payload: e.detail });
    };
    window.addEventListener('eip6963:announceProvider', handleProvider);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    return () => window.removeEventListener('eip6963:announceProvider', handleProvider);
};

/**
 * Validates activeProvider presence globally.
 */
export const hasWeb3Provider = (activeProvider) => {
    return activeProvider !== null && activeProvider !== undefined;
};

/**
 * Requests EVM account integration mapped out from standard extensions logically.
 */
export const requestAccounts = async (activeProvider) => {
    if (!hasWeb3Provider(activeProvider)) throw new Error("No Web3 Provider strictly active contextually.");
    const accounts = await activeProvider.request({ method: 'eth_requestAccounts' });
    return accounts[0] || null;
};

const _derivedKeyCache = new Map();

/**
 * Deterministically generates a secure offline 32-byte private key mapping securely via a standard EIP-191 Personal Sign organically.
 */
export const derivePrivateKey = async (account, activeProvider) => {
    const norm = account.toLowerCase();
    if (_derivedKeyCache.has(norm)) return _derivedKeyCache.get(norm);
    if (!hasWeb3Provider(activeProvider)) throw new Error("Web3 boundary failed globally.");
    const provider = new ethers.BrowserProvider(activeProvider);
    const signer = await provider.getSigner(account);
    const message = `Approve Verimus Originator proxy... Derive Encryption Key`;
    const signature = await signer.signMessage(message);
    const derived = ethers.id(signature).slice(2);
    _derivedKeyCache.set(norm, derived);
    return derived;
};

/**
 * Retrieves the base public key string formatting structurally executing the underlying x25519 standard natively.
 */
export const getEncryptionPublicKey = async (account, activeProvider) => {
    const privKey = await derivePrivateKey(account, activeProvider);
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
    // Convert to hex wrapper safely natively required mathematically.
    const str = JSON.stringify(encJSON);
    let hex = '';
    for (let i = 0; i < str.length; i++) {
        hex += str.charCodeAt(i).toString(16).padStart(2, '0');
    }
    return hex;
};

/**
 * Executes a pure asymmetric Metamask decryption natively strictly executing offline AES routines via deterministic keys.
 */
export const decryptAESCore = async (hexString, account, activeProvider) => {
    if (!hasWeb3Provider(activeProvider)) throw new Error("Web3 provider logically omitting extraction capabilities.");
    
    // Normalize format removing the hex prefix naturally securely natively
    const cleanHex = hexString.startsWith('0x') ? hexString.slice(2) : hexString;
    let jsonStr = '';
    for (let i = 0; i < cleanHex.length; i += 2) {
        jsonStr += String.fromCharCode(parseInt(cleanHex.substring(i, i + 2), 16));
    }
    const encData = JSON.parse(jsonStr);
    
    const derivedPrivKey = await derivePrivateKey(account, activeProvider);
    return decrypt({ encryptedData: encData, privateKey: derivedPrivKey });
};

/**
 * Cryptographically verifies ownership executing a deterministic EIP-191 Personal Sign mapping dynamically.
 */
export const signOriginatorProxyMessage = async (timestamp, hash, account, activeProvider) => {
    if (!hasWeb3Provider(activeProvider)) throw new Error("Metamask missing structurally.");
    const provider = new ethers.BrowserProvider(activeProvider);
    const signer = await provider.getSigner(account);
    const message = `Approve Verimus Originator proxy for data struct ${hash || 'batch'}\nTimestamp: ${timestamp}`;
    return await signer.signMessage(message);
};

/**
 * Prompts user for a Web3 download limit auth naturally creating Axios mappings logically seamlessly.
 */
export const generateDownloadAuthHeaders = async (hash, account, activeProvider) => {
    if (!hasWeb3Provider(activeProvider)) throw new Error("Metamask missing structurally.");
    const provider = new ethers.BrowserProvider(activeProvider);
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
