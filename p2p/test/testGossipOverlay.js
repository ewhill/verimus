"use strict";

const test = require('node:test');
const assert = require('node:assert');

const mockKeys = require('./mockKeys.js');
const { Peer, Message } = require('../index.js');

const sink = () => { };
const fakeLogger = { error: sink, info: sink, log: sink, warn: sink };

class OverlayMessage extends Message {
  constructor(options = {}) {
    super(options);
    const { data = '' } = options;
    this.data = data;
  }
  get data() { return this.body.data; }
  set data(data) { this.body.data = data; }
}

let peer1, peer2;

const before = async () => {
  peer1 = new Peer({
    publicKey: mockKeys.first.public,
    privateKey: mockKeys.first.private,
    httpsServerConfig: { port: 56790 },
    publicAddress: "127.0.0.1:56790",
    logger: fakeLogger
  });

  peer2 = new Peer({
    publicKey: mockKeys.second.public,
    privateKey: mockKeys.second.private,
    httpsServerConfig: { port: 56791 },
    publicAddress: "127.0.0.1:56791",
    logger: fakeLogger
  });

  await peer1.init();
  await peer2.init();
  await peer2.discover(["127.0.0.1:56790"]);
};

const after = async () => {
  await peer1.close();
  await peer2.close();
};

const runTest = async (testCase) => {
  await before();
  try {
    await testCase.apply(null, []);
  } finally {
    await after();
  }
};

test("GossipOverlayTest", async () => {
  await runTest(testLRUCachePreventsDuplicates);
  await runTest(testTTLRestrictsPropagation);
});

async function testLRUCachePreventsDuplicates() {
  return new Promise(async (resolve, reject) => {
    let receivedCount = 0;

    const testHandler = (message, connection, logger = console) => {
      receivedCount++;
    };

    peer2.bind(OverlayMessage).to(testHandler);

    // Create a message that generates the identical hash + signature if sent back-to-back 
    // by reusing the exact same Message instance
    const msg = new OverlayMessage({ data: "duplicate-spam-test" });

    // Send the exact same message twice to simulate a routing loop payload injection 
    await peer1.sendTo(peer1.trustedPeers[0], msg);
    await peer1.sendTo(peer1.trustedPeers[0], msg);
    await peer1.sendTo(peer1.trustedPeers[0], msg);

    // Wait slightly to permit ingestion
    await new Promise(r => setTimeout(r, 200));

    // The LRU cache should drop the 2nd and 3rd instance, protecting the application layer
    assert.strictEqual(receivedCount, 1, "LRU cache should intercept and drop raw duplicates matching hash and signature");

    peer2.unbind(OverlayMessage);
    resolve();
  });
}

async function testTTLRestrictsPropagation() {
  return new Promise(async (resolve, reject) => {
    let receivedCount = 0;

    const testHandler = (message, connection, logger = console) => {
      receivedCount++;
    };

    peer2.bind(OverlayMessage).to(testHandler);

    // manipulate TTL to 0 to simulate an exhausted routing payload
    const msg = new OverlayMessage({ data: "exhausted-ttl-payload", ttl: 0 });

    await peer1.broadcast(msg);

    // Wait slightly to permit ingestion
    await new Promise(r => setTimeout(r, 200));

    // Peer1's broadcast routine dropped the payload because TTL bounds were exhausted
    assert.strictEqual(receivedCount, 0, "Broadcast bounds should instinctively halt propagation if TTL drops to zero");

    peer2.unbind(OverlayMessage);
    resolve();
  });
}
