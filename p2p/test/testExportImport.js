"use strict";
const fs = require('fs');
const test = require('node:test');
const assert = require('node:assert');

const { Peer, Message } = require('../index.js');

// ----------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------

test("PeerExportImportTest", async () => {
  const sink = () => { };
  const fakeLogger = { error: sink, info: sink, log: sink, warn: sink };

  let p1 = new Peer({
    publicKeyPath: "first.peer.pub",
    privateKeyPath: "first.peer.pem",
    httpsServerConfig: {
      port: 57180,
    },
    publicAddress: "127.0.0.1:57180",
    logger: fakeLogger
  });

  await p1.init();

  let peerJson = p1.toString();
  p1.close();

  let p2 = new Peer(JSON.parse(peerJson));

  await p2.init();

  assert.strictEqual(peerJson, p2.toString(),
    "Exported peer and corresponding import of exported peer should be equal");

  await p2.close();
});