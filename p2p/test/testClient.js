"use strict";
const test = require('node:test');
const assert = require('node:assert');
const { ethers } = require('ethers');
const crypto = require('crypto');
const Client = require('../lib/Client.js');
const EphemeralExchangeMessage = require('../lib/messages/EphemeralExchangeMessage.js');
const { generateEphemeralSession, signEphemeralPayload } = require('../../crypto_utils/CryptoUtils.js');

test("Implicit Remote Credential Derivation & Impersonation Prevention", async () => {
    const mockConnection = {
        on: () => {},
        terminate: () => {},
        send: () => {},
		addEventListener: () => {},
		removeEventListener: () => {}
    };

    const localWallet = ethers.Wallet.createRandom();
    const remoteWallet = ethers.Wallet.createRandom();

    const client = new Client({
        connection: mockConnection,
        credentials: { evmPrivateKey: localWallet.privateKey },
        logger: { error: ()=>{}, warn: ()=>{}, info: ()=>{}, log: ()=>{} },
    });
	client.ephemeralWallet_ = generateEphemeralSession();

    // Generate valid remote exchange packet
    const remoteEphemeralWallet = generateEphemeralSession();
    const payload = JSON.stringify({ ePublicKey: remoteEphemeralWallet.ephemeralPublicKey, peerAddr: '127.0.0.1:0' });
    const innerSignature = await signEphemeralPayload(remoteWallet.privateKey, payload);

    const validExchangeMsg = new EphemeralExchangeMessage({
        ephemeralPublicKey: remoteEphemeralWallet.ephemeralPublicKey,
        signature: innerSignature,
        publicAddress: '127.0.0.1:0'
    });

    // We stub this to capture the resolution
    client.receiveEphemeralPromiseReject_ = (err) => {
        assert.fail('Valid handshake was rejected: ' + err.message);
    };
    client.receiveEphemeralPromiseResolve_ = () => {};

    await client.ephemeralExchangeHandler(validExchangeMsg, mockConnection);

    assert.ok(client.remoteCredentials_, 'Remote credentials should be established.');
    assert.strictEqual(client.remoteCredentials_.walletAddress.toLowerCase(), remoteWallet.address.toLowerCase(), 'Client extracted and bound the correct EVM identity natively from the signature.');

    // Sub-Test: Impersonation
    const impersonatorWallet = ethers.Wallet.createRandom();
    const badSignature = await signEphemeralPayload(impersonatorWallet.privateKey, payload);
    
    const fakeExchangeMsg = new EphemeralExchangeMessage({
        ephemeralPublicKey: remoteEphemeralWallet.ephemeralPublicKey,
        signature: badSignature, // signed by someone else
        publicAddress: '127.0.0.1:0'
    });

    // Pinned identity expected
    client.expectedSignature_ = remoteWallet.address.toLowerCase();

    let rejected = false;
    client.receiveEphemeralPromiseReject_ = (err) => {
        rejected = true;
        assert.ok(err.message.includes('Connected wallet address did not match expected pinned identity'), 'Rejected impersonation attack correctly.');
    };

    await client.ephemeralExchangeHandler(fakeExchangeMsg, mockConnection);
    assert.strictEqual(rejected, true, 'Impersonation cleanly severs socket connection.');
});
