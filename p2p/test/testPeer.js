"use strict";

const test = require('node:test');
const assert = require('node:assert');

const { Peer, Message } = require('../index.js');

const sink = () => { };
const fakeLogger = { error: sink, info: sink, log: sink, warn: sink };

// ===========================================================================
// ===========================================================================

class TestMessage extends Message {
  constructor(options = {}) {
    super();
    const { data = '' } = options;
    this.data = data;
  }

  get data() { return this.body.data; }
  set data(data) { this.body.data = data; }
}

let peer1, peer2;

const before = async () => {
  peer1 = new Peer({
    publicKeyPath: "first.peer.pub",
    privateKeyPath: "first.peer.pem",
    httpsServerConfig: {
      port: 56880,
    },
    publicAddress: "127.0.0.1:56880",
    logger: fakeLogger
  });

  peer2 = new Peer({
    publicKeyPath: "second.peer.pub",
    privateKeyPath: "second.peer.pem",
    httpsServerConfig: {
      port: 56881,
    },
    publicAddress: "127.0.0.1:56881",
    logger: fakeLogger
  });

  await peer1.init();
  await peer2.init();
  await peer2.discover(["127.0.0.1:56880"]);
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

test("PeerTest", async () => {
  await runTest(testSendReceivePeer1);
  await runTest(testSendReceivePeer2);
  await runTest(testMessageOrder);
  await runTest(testSendWhenClosed);
});

async function testSendReceivePeer1() {
  return new Promise((resolve, reject) => {
    const testHandler = (message, connection, logger = console) => {
      assert.strictEqual(message.data, "Howdy, it's peer1!!!",
        "Message body sent by peer1 and received by peer2 should be equal");

      peer2.unbind(TestMessage);
      return resolve();
    };

    peer2.bind(TestMessage).to(testHandler);
    peer1.broadcast(new TestMessage({ data: "Howdy, it's peer1!!!" }));
  });
}

async function testSendReceivePeer2() {
  return new Promise((resolve, reject) => {
    const testHandler = (message, connection, logger = console) => {
      assert.strictEqual(message.data, "Hello, from peer2!!!",
        "Message body sent by peer2 and received by peer1 should be equal.");

      peer1.unbind(TestMessage);
      return resolve();
    };

    peer1.bind(TestMessage).to(testHandler);
    peer2.broadcast(new TestMessage({ data: "Hello, from peer2!!!" }));
  });
}

async function testMessageOrder() {
  return new Promise((resolve, reject) => {
    const totalToSend = 7;
    const sent = [];
    const received = [];

    const testHandler = (message, connection, logger = console) => {
      received.push(message);

      if (received.length < totalToSend) {
        return;
      }

      let failed = false;
      for (let i = 0; i < received.length; i++) {
        failed = received[i].body.data !== sent[i].body.data;
        assert.strictEqual(received[i].body.data, sent[i].body.data,
          `Received message at position ${i} should match sent.`);
      }

      peer2.unbind(TestMessage);

      if (failed) {
        return reject();
      } else {
        return resolve();
      }
    };

    peer2.bind(TestMessage).to(testHandler);
    for (let i = 0; i < totalToSend; i++) {
      const msg = new TestMessage({ data: i });
      peer1.broadcast(msg);
      sent.push(msg);
    }
  });
}

async function testSendWhenClosed() {
  await peer1.close();

  // Timeout needed for close event to reach peer2 from peer1...
  await new Promise((resolve) => { setTimeout(resolve, 200); });

  let err;
  try {
    await peer2.broadcast(new TestMessage({ data: "asdasdasd" }));
  } catch (e) {
    err = e;
  }

  assert.strictEqual(err, undefined,
    `Attempting to send to closed connection should resolve silently with bounded TTL broadcast rules.`);
}
