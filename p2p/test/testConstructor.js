"use strict";
const fs = require('fs');
const test = require('node:test');
const assert = require('node:assert');

const { Peer, Message } = require('../index.js');

// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------

test("PeerConstructor", async () => {
  const sink = () => { };
  const fakeLogger = { error: sink, info: sink, log: sink, warn: sink };

  const copyConstructorOptions = (opts) => {
    return { ...JSON.parse(JSON.stringify(opts)), logger: fakeLogger };
  };

  const constructorThrowsWithMessage = async (options, msg, text) => {
    let errorMessage = null;
    let peer = new Peer(options);

    try {
      await peer.init();
      await peer.close();
    } catch (e) {
      errorMessage = e.message;
    }

    assert.strictEqual(errorMessage, msg, text);
  };

  let constructorOptions = {
    httpsServerConfig: {
      port: 56788,
    },
    publicKeyPath: "first.peer.pub",
    privateKeyPath: "first.peer.pem",
    discoveryConfig: {
      addresses: ["127.0.0.1"],
      range: {
        start: 57080,
        end: 57090
      }
    },
    publicAddress: "127.0.0.1:56785",
    logger: fakeLogger
  };

  // Missing peer `privateKey`:
  let missingPrivateKeyOptions = copyConstructorOptions(constructorOptions);
  delete missingPrivateKeyOptions.privateKeyPath;
  await constructorThrowsWithMessage(missingPrivateKeyOptions,
    "Invalid path!",
    "When missing privateKey should throw error.");

  // Missing peer `publicKey`:
  let missingPublicKeyOptions = copyConstructorOptions(constructorOptions);
  delete missingPublicKeyOptions.publicKeyPath;
  const peer = new Peer(missingPublicKeyOptions);
  await peer.init();
  assert.notStrictEqual(peer.publicKey, null,
    "When not given publicKey, but given privateKey should derrive publicKey " +
    " from privateKey.");
  await peer.close();

});