"use strict";

const test = require('tape');
const { Peer, Message } = require('../index.js');

let peer;

const before = async () => {
	const sink = () => { };
	const fakeLogger = { error: sink, info: sink, log: sink, warn: sink };

	peer = new Peer({
		publicKeyPath: "first.peer.pub",
		privateKeyPath: "first.peer.pem",
		httpsServerConfig: {
			port: 56980,
		},
		publicAddress: "127.0.0.1:56980",
		discoveryConfig: { addresses: ["127.0.0.1"], range: { start: 56980, end: 56990 } },
		logger: fakeLogger
	});

	await peer.init();
};

const after = async () => {
	await peer.close();
};

const runTest = async (assert, testCase) => {
	await before();
	await testCase(assert);
	await after();
};

test("PeerMethods", async (assert) => {
	assert.doesThrow = async (fn, msg) => {
		try {
			await fn();
			assert.fail(msg);
		} catch (e) {
			assert.pass(msg);
		}
	};

	await runTest(assert, testDiscoverAddress);
	await runTest(assert, testSignature);
	await runTest(assert, testSendToParams);

	await peer.close();
	assert.end();
});

const testDiscoverAddress = async (assert) => {
	let attemptedConnections = [];
	peer.discoverPeer = ({ address }) => {
		attemptedConnections.push(address);
		return Promise.resolve();
	};

	await peer.discover(["127.0.0.1"]);

	assert.true(attemptedConnections.length > 0,
		`Discovering on address should produce at least one attempted ` +
		`connection.`);

	const hasAttemptedConnectionToOwnPort =
		attemptedConnections
			.slice(0)
			.map(i => i.slice(i.lastIndexOf(":") + 1))
			.indexOf(peer.port.toString()) > -1;
	assert.true(hasAttemptedConnectionToOwnPort,
		`Discovering on address without port should assign port to the same ` +
		`as the peer.`);

	const allAttmptedAreWssProtocol =
		attemptedConnections
			.slice(0)
			.map(i => i.slice(0, 6) === 'wss://')
			.reduce((prev, curr) => prev && curr);
	assert.true(allAttmptedAreWssProtocol,
		`Discovering of address without a protocol should assign the ` +
		`WebSocket protocol string.`);

	await assert.doesThrow(() => {
		peer.enqueueDiscoveryAddress();
	},
		`Attempting to enqueue an invalid address for discovery should throw.`);
};

const testSignature = async (assert) => {
	const testPeer = {
		remotePublicKey: 'asdasdasd',
		isConnected: true,
		isTrusted: true,
	};
	peer.peers_ = [testPeer];

	assert.true(peer.isConnectedTo({ publicKey: 'asdasdasd' }),
		` reports if peer is connected to another peer.`);

	await assert.doesThrow(async () => {
		await peer.discoverPeer(testPeer);
	},
		`Attempting to discover on peer to which this peer has already ` +
		`connected should throw.`);

	const testPeerSignatureBuffer = Buffer.from('aaa', 'utf8');
	peer.publicKey_ = testPeerSignatureBuffer;
	assert.true(peer.isOwnSignature(testPeerSignatureBuffer),
		` reports if given signature is equal to this peer.`);

	peer.peers_ = [];
	await assert.doesThrow(async () => {
		await peer.discoverPeer(testPeer);
	},
		`Attempting to discover on peer to which has signature equal ` +
		`to this peer signature should throw.`);
};

const testSendToParams = async (assert) => {
	await assert.doesThrow(async () => {
		await peer.sendTo();
	},
		`Attempting to call sendTo without connection or message should ` +
		`throw`);

	await assert.doesThrow(async () => {
		await peer.sendTo({});
	},
		`Attempting to call sendTo without message should throw`);
};