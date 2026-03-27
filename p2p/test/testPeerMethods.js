"use strict";

const test = require('node:test');
const assert = require('node:assert');
const { Peer, Message } = require('../index.js');

let peer;

const before = async () => {
	const sink = () => { };
	const fakeLogger = { error: sink, info: sink, log: sink, warn: sink };

	peer = new Peer({
		publicKeyPath: "first.peer.pub",
		privateKeyPath: "first.peer.pem",
		httpsServerConfig: {
			port: 26780,
		},
		publicAddress: "127.0.0.1:26780",
		logger: fakeLogger
	});

	await peer.init();
};

const after = async () => {
	await peer.close();
};

const doesThrow = async (fn, msg) => {
	let err = null;
	try {
		await fn();
	} catch (e) {
		err = e;
	}
	assert.notStrictEqual(err, null, msg);
};

const runTest = async (testCase) => {
	await before();
	try {
		await testCase();
	} finally {
		await after();
	}
};

test("PeerMethods", async () => {
	await runTest(testDiscoverAddress);
	await runTest(testSignature);
	await runTest(testSendToParams);

	await peer.close();
});

const testDiscoverAddress = async () => {
	const attemptedConnections = [];
	peer.attemptConnection = ({ originalAddress }) => {
		attemptedConnections.push(originalAddress);
		return Promise.resolve();
	};

	await peer.discover(["127.0.0.1"]);

	assert.ok(attemptedConnections.length > 0,
		`Discovering on address should produce at least one attempted ` +
		`connection.`);

	const hasAttemptedConnectionToOwnPort =
		attemptedConnections
			.slice(0)
			.map(i => i.slice(i.lastIndexOf(":") + 1))
			.indexOf(peer.port.toString()) > -1;
	assert.ok(hasAttemptedConnectionToOwnPort,
		`Discovering on address without port should assign port to the same ` +
		`as the peer.`);

	const allAttmptedAreWssProtocol =
		attemptedConnections
			.slice(0)
			.map(i => i.slice(0, 6) === 'wss://')
			.reduce((prev, curr) => prev && curr);
	assert.ok(allAttmptedAreWssProtocol,
		`Discovering of address without a protocol should assign the ` +
		`WebSocket protocol string.`);

	await doesThrow(() => {
		peer.enqueueDiscoveryAddress();
	},
		`Attempting to enqueue an invalid address for discovery should throw.`);
};

const testSignature = async () => {
	const testPeer = {
		remotePublicKey: 'asdasdasd',
		isConnected: true,
		isTrusted: true,
	};
	peer.peers_ = [testPeer];

	assert.ok(peer.isConnectedTo({ publicKey: 'asdasdasd' }),
		` reports if peer is connected to another peer.`);

	await doesThrow(async () => {
		await peer.discoverPeer(testPeer);
	},
		`Attempting to discover on peer to which this peer has already ` +
		`connected should throw.`);

	const testPeerSignatureBuffer = Buffer.from('aaa', 'utf8');
	peer.publicKey_ = testPeerSignatureBuffer;
	assert.ok(peer.isOwnSignature(testPeerSignatureBuffer),
		` reports if given signature is equal to this peer.`);

	peer.peers_ = [];
	await doesThrow(async () => {
		await peer.discoverPeer(testPeer);
	},
		`Attempting to discover on peer to which has signature equal ` +
		`to this peer signature should throw.`);
};

const testSendToParams = async () => {
	await doesThrow(async () => {
		await peer.sendTo();
	},
		`Attempting to call sendTo without connection or message should ` +
		`throw`);

	await doesThrow(async () => {
		await peer.sendTo({});
	},
		`Attempting to call sendTo without message should throw`);
};