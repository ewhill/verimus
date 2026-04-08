"use strict";

const test = require('node:test');
const assert = require('node:assert');
const { Peer, Message } = require('../index.js');

class PingMessage extends Message {
	constructor() {
		super();
		this.body = { direction: 'ping' };
	}
}

class PongMessage extends Message {
	constructor() {
		super();
		this.body = { direction: 'pong' };
	}
}

const PingMessageHandler = (message, connection, logger = console) => {
	// Send 'pong' in reply...
	const pong = new PongMessage();
	connection.send(pong);
};

const PongMessageHandler = (message, connection, logger = console) => {
	// Noop
};


const { generateKeyPairSync } = require('node:crypto');
const fs = require('node:fs');

test("PeerBYOHTTPSServerTest", async () => {
	const fakeLogger = console;

	const generateMockKeys = (prefix) => {
		const { publicKey, privateKey } = generateKeyPairSync('rsa', {
			modulusLength: 2048,
			publicKeyEncoding: { type: 'spki', format: 'pem' },
			privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
		});
		fs.writeFileSync(`${prefix}.peer.pub`, publicKey);
		fs.writeFileSync(`${prefix}.peer.pem`, privateKey);
	};

	generateMockKeys('first');
	generateMockKeys('second');

	const peer1 = new Peer({
		httpsServerConfig: {
			credentials: {
				key: "https.key.pem",
				cert: "https.cert.pem"
			},
			port: 58780,
		},
		privateKeyPath: "first.peer.pem",
		publicKeyPath: "first.peer.pub",
		publicAddress: "127.0.0.1:58780",
		logger: fakeLogger,
	});

	const peer2 = new Peer({
		httpsServerConfig: {
			credentials: {
				key: "https.key.pem",
				cert: "https.cert.pem"
			},
			port: 58781,
		},
		privateKeyPath: "second.peer.pem",
		publicKeyPath: "second.peer.pub",
		discoveryConfig: {
			addresses: ["127.0.0.1:58780"]
		},
		publicAddress: "127.0.0.1:58781",
		logger: fakeLogger,
	});

	await peer1.init();
	await peer2.init();
	await peer1.discover();
	await peer2.discover();

	peer2.bind(PingMessage).to(PingMessageHandler);
	peer1.bind(PongMessage).to(async (...args) => {
		PongMessageHandler(...args);
		await peer1.close();
		await peer2.close();

		assert.ok(true, 'Peers can communicate.');
	});

	await peer1.broadcast(new PingMessage());
});

