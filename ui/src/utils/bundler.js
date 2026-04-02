import * as fflate from 'fflate';

function bufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

function bufferToHex(buffer) {
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Zips files using fflate, generates AES-256-GCM cipher natively via WebCrypto,
 * yielding an opaque Blob entirely decoupled from backend processes.
 */
export async function bundleAndEncryptFiles(files) {
    const zipDataObj = {};
    const metadata = [];

    // Process all files synchronously loading matrices
    for (const file of files) {
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        zipDataObj[file.name] = uint8Array;

        // Hash the explicit file directly mapping mathematical trees 
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashHex = bufferToHex(hashBuffer);

        metadata.push({
            path: file.name,
            contentHash: hashHex
        });
    }

    // Zip natively executing ZLIB deflation arrays 
    const zippedUint8Array = fflate.zipSync(zipDataObj, { level: 9 });

    // Generate strict AES-256-GCM symmetric bounding structurally
    const key = await window.crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    // Execute block cipher encoding natively limiting raw loops
    const encryptedBuffer = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        zippedUint8Array
    );

    // AES-GCM natively appends the 16-byte Auth Tag to the absolute end of the buffer context
    const authTagStart = encryptedBuffer.byteLength - 16;
    const authTagBuffer = encryptedBuffer.slice(authTagStart);
    const authTagHex = bufferToHex(authTagBuffer);

    // Extract exportable explicit parameters securely mapping limits
    const rawKey = await window.crypto.subtle.exportKey("raw", key);
    const aesKeyBase64 = bufferToBase64(rawKey);
    const aesIvBase64 = bufferToBase64(iv.buffer);

    return {
        // Blob includes the raw ciphertext PLUS the authTag suffix implicitly structured 
        encryptedBlob: new Blob([encryptedBuffer], { type: 'application/octet-stream' }),
        aesKeyBase64,
        aesIvBase64,
        authTagHex,
        fileMetadata: metadata
    };
}

/**
 * Decrypts symmetric ciphertexts inside the DOM natively and mathematically extracts zip matrices locally.
 */
export async function decryptAndUnzip(encryptedBuffer, aesKeyBase64, aesIvBase64) {
    // Reconstruct native Uint8 boundaries organically
    const rawKey = Uint8Array.from(window.atob(aesKeyBase64), c => c.charCodeAt(0));
    const iv = Uint8Array.from(window.atob(aesIvBase64), c => c.charCodeAt(0));

    const key = await window.crypto.subtle.importKey(
        "raw",
        rawKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
    );

    // Executing mathematically decoupled mapping inside the DOM exclusively
    const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        key,
        encryptedBuffer
    );
    
    // Execute fflate mapping synchronously parsing ZIP arrays natively
    return fflate.unzipSync(new Uint8Array(decryptedBuffer));
}
