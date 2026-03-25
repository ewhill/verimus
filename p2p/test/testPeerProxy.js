"use strict";
const { spawn } = require("child_process");
const test = require('tape');

const { Peer, Message } = require('../index.js');
const { createPeerProxy } = require('../lib/PeerProxy.js');
const fs = require('fs');
const RSAKeyPair = require('../lib/RSAKeyPair.js');

// ----------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------

class GreetingMessage extends Message {
  constructor(options = {}) {
    super();

    const { greeting = '' } = options;
    this.greeting = greeting;
  }

  get greeting() { return this.body.greeting; }
  set greeting(greeting) { this.body.greeting = greeting; }
}

const sink = () => { };
const fakeLogger = { error: sink, info: sink, log: sink, warn: sink };

let peer1alpha;
let peer2alpha;
let peer3beta;
let peer4beta;
let peer4alpha;
let peerProxy;

const exec = async ({ command, args = [], timeout = -1 }) => {
  return new Promise((resolve, reject) => {
    if (timeout > 0) {
      setTimeout(
        reject(new Error(`Command failed to finish before timeout!`)), timeout);
    }

    const proc = spawn(command, args, { shell: true });

    // proc.stdout.on('data', (data) => {
    //     console.log(`stdout: ${data.toString()}`);
    //   });

    // proc.stderr.on('data', (data) => {
    //     console.log(`stderr: ${data.toString()}`);
    //   });

    proc.on('exit', (code) => {
      // console.log(`child process exited with code: ${code.toString()}`);
      if (code !== 0) {
        return reject(new Error(`Command ${command} failed with exit code: ${code}`));
      }
      return resolve();
    });
  });
};

const setup = async () => {
  await exec({
    command: "openssl",
    args: [
      "genrsa -out /tmp/https.key.pem 2048",
    ]
  });
  await exec({
    command: "openssl",
    args: [
      "req -new -key /tmp/https.key.pem -out /tmp/https.csr.pem -subj '/CN=localhost'",
    ]
  });
  await exec({
    command: "openssl",
    args: [
      "x509 -req -days 9999 -in /tmp/https.csr.pem " +
      "-signkey /tmp/https.key.pem -out /tmp/https.cert.pem",
    ]
  });

  const writeKey = (pathPre) => {
    const k = RSAKeyPair.generate();
    const e = k.export({mode: 'both', returnBuffer: false});
    fs.writeFileSync(`${pathPre}.peer.pem`, e.private);
    fs.writeFileSync(`${pathPre}.peer.pub`, e.public);
  };
  writeKey('/tmp/one.alpha');
  writeKey('/tmp/two.alpha');
  writeKey('/tmp/three.beta');
  writeKey('/tmp/four.alpha');
  writeKey('/tmp/four.beta');
};

const teardown = async () => {
  await exec({
    command: "rm",
    args: [
      "-f",
      "/tmp/one.alpha.peer.pem",
      "/tmp/one.alpha.peer.pub",
      "/tmp/two.alpha.peer.pem",
      "/tmp/two.alpha.peer.pub",
      "/tmp/three.beta.peer.pem",
      "/tmp/three.beta.peer.pub",
      "/tmp/four.beta.peer.pem",
      "/tmp/four.beta.peer.pub",
    ]
  });
};

const before = async () => {
  const sink = () => { };
  const fakeLogger = { error: sink, info: sink, log: sink, warn: sink };

  peer1alpha = new Peer({
    publicKeyPath: "/tmp/one.alpha.peer.pub",
    privateKeyPath: "/tmp/one.alpha.peer.pem",
    httpsServerConfig: {
      port: 46781,
    },
    publicAddress: "127.0.0.1:46781",
    logger: fakeLogger,
  });

  peer2alpha = new Peer({
    publicKeyPath: "/tmp/two.alpha.peer.pub",
    privateKeyPath: "/tmp/two.alpha.peer.pem",
    httpsServerConfig: {
      port: 46782,
    },
    publicAddress: "127.0.0.1:46782",
    logger: fakeLogger,
  });

  peer3beta = new Peer({
    publicKeyPath: "/tmp/three.beta.peer.pub",
    privateKeyPath: "/tmp/three.beta.peer.pem",
    httpsServerConfig: {
      port: 46783,
    },
    publicAddress: "127.0.0.1:46783",
    logger: fakeLogger,
  });

  peer4beta = new Peer({
    publicKeyPath: "/tmp/four.beta.peer.pub",
    privateKeyPath: "/tmp/four.beta.peer.pem",
    httpsServerConfig: {
      port: 46784,
    },
    publicAddress: "127.0.0.1:46784",
    logger: fakeLogger,
  });

  peer4alpha = new Peer({
    publicKeyPath: "/tmp/four.alpha.peer.pub",
    privateKeyPath: "/tmp/four.alpha.peer.pem",
    httpsServerConfig: {
      port: 46785,
    },
    publicAddress: "127.0.0.1:46785",
    logger: fakeLogger,
  });

  await peer1alpha.init();
  await peer2alpha.init();
  await peer3beta.init();
  await peer4beta.init();
  await peer4alpha.init();
  await peer1alpha.discover(["127.0.0.1:46782", "127.0.0.1:46783"]);
  await peer2alpha.discover(["127.0.0.1:46781", "127.0.0.1:46785"]);
  await peer3beta.discover(["127.0.0.1:46781"]);
  await peer4beta.discover(["127.0.0.1:46783"]);
  await peer4alpha.discover(["127.0.0.1:46781", "127.0.0.1:46782"]);

  peerProxy = createPeerProxy({
    peers: [
      peer4alpha,
      peer4beta,
    ],
    messageClasses: [
      GreetingMessage,
    ],
    logger: fakeLogger,
  });
};

const after = async () => {
  await peer1alpha.close();
  await peer2alpha.close();
  await peer3beta.close();
  await peer4beta.close();
  await peer4alpha.close();
};

// Peer1 (alpha) -->
//   --> Peer2 (alpha)
//   --> Peer3 (beta)
test("PeerProxy_proxiesMessageFromAlphaToBeta", async (assert) => {
  assert.plan(8);
  await setup();
  await before();

  const greeting =
    new GreetingMessage({ greeting: 'Hello from peer1alpha!' });

  let peer2alphaReceivePromiseResolver;
  const peer2alphaReceivePromise = new Promise((resolve) => {
    peer2alphaReceivePromiseResolver = resolve;
  });
  const peer2alphaMessageHandler =
    (message) => peer2alphaReceivePromiseResolver(message);
  peer2alpha.bind(GreetingMessage).to(peer2alphaMessageHandler);

  let peer3betaReceivePromiseResolver;
  const peer3betaReceivePromise = new Promise((resolve) => {
    peer3betaReceivePromiseResolver = resolve;
  });
  const peer3betaMessageHandler =
    (message) => peer3betaReceivePromiseResolver(message);
  peer3beta.bind(GreetingMessage).to(peer3betaMessageHandler);

  await peer1alpha.broadcast(greeting);
  const [peer2alphaMessage, peer3betaMessage] =
    await Promise.all([peer2alphaReceivePromise, peer3betaReceivePromise]);

  assert.true(!!peer2alphaMessage,
    'peer2alpha should receive message broadcasted from peer1alpha.');
  assert.equal(peer2alphaMessage.hash, greeting.hash);
  assert.deepEquals(peer2alphaMessage.body, greeting.body);
  assert.deepEquals(peer2alphaMessage.timestamp, greeting.timestamp);

  assert.true(!!peer3betaMessage,
    'peer3beta should receive message broadcasted from peer1alpha.');
  assert.equal(peer3betaMessage.hash, greeting.hash);
  assert.deepEquals(peer3betaMessage.body, greeting.body);
  assert.deepEquals(peer3betaMessage.timestamp, greeting.timestamp);

  await after();
  await teardown();
});

// Peer2 (alpha) -->
//   --> Peer1 (alpha)
//   --> Peer3 (beta)
test.skip("PeerProxy_proxiesMessageFromAlphaOtherToBeta", async (assert) => {
  assert.plan(8);
  await setup();
  await before();

  const greeting =
    new GreetingMessage({ greeting: 'Hello from peer2alpha!' });

  let peer1alphaReceivePromiseResolver;
  const peer1alphaReceivePromise = new Promise((resolve) => {
    peer1alphaReceivePromiseResolver = resolve;
  });
  const peer1alphaMessageHandler =
    (message) => peer1alphaReceivePromiseResolver(message);
  peer1alpha.bind(GreetingMessage).to(peer1alphaReceivePromiseResolver);

  let peer3betaReceivePromiseResolver;
  const peer3betaReceivePromise = new Promise((resolve) => {
    peer3betaReceivePromiseResolver = resolve;
  });
  const peer3betaMessageHandler =
    (message) => peer3betaReceivePromiseResolver(message);
  peer3beta.bind(GreetingMessage).to(peer3betaMessageHandler);

  await peer2alpha.broadcast(greeting);
  const [peer1alphaMessage, peer3betaMessage] =
    await Promise.all([peer1alphaReceivePromise, peer3betaReceivePromise]);

  assert.true(!!peer1alphaMessage,
    'peer1alpha should receive message broadcasted from peer2alpha.');
  assert.equal(peer1alphaMessage.hash, greeting.hash);
  assert.deepEquals(peer1alphaMessage.body, greeting.body);
  assert.deepEquals(peer1alphaMessage.timestamp, greeting.timestamp);

  assert.true(!!peer3betaMessage,
    'peer3beta should receive message broadcasted from peer2alpha.');
  assert.equal(peer3betaMessage.hash, greeting.hash);
  assert.deepEquals(peer3betaMessage.body, greeting.body);
  assert.deepEquals(peer3betaMessage.timestamp, greeting.timestamp);

  await after();
  await teardown();
});

// Peer3 (beta) -->
//   --> Peer1 (alpha)
//   --> Peer2 (alpha)
test.skip("PeerProxy_proxiesMessageFromBetaToAlpha", async (assert) => {
  assert.plan(8);
  await setup();
  await before();

  const greeting =
    new GreetingMessage({ greeting: 'Hello from peer3beta!' });

  let peer1alphaReceivePromiseResolver;
  const peer1alphaReceivePromise = new Promise((resolve) => {
    peer1alphaReceivePromiseResolver = resolve;
  });
  const peer1alphaMessageHandler =
    (message) => peer1alphaReceivePromiseResolver(message);
  peer1alpha.bind(GreetingMessage).to(peer1alphaMessageHandler);

  let peer2alphaReceivePromiseResolver;
  const peer2alphaReceivePromise = new Promise((resolve) => {
    peer2alphaReceivePromiseResolver = resolve;
  });
  const peer2alphaMessageHandler =
    (message) => peer2alphaReceivePromiseResolver(message);
  peer2alpha.bind(GreetingMessage).to(peer2alphaMessageHandler);

  await peer3beta.broadcast(greeting);
  const [peer1alphaMessage, peer2alphaMessage] =
    await Promise.all([peer1alphaReceivePromise, peer2alphaReceivePromise]);

  assert.true(!!peer1alphaMessage,
    'peer1alpha should receive message broadcasted from peer1alpha.');
  assert.equal(peer1alphaMessage.hash, greeting.hash);
  assert.deepEquals(peer1alphaMessage.body, greeting.body);
  assert.deepEquals(peer1alphaMessage.timestamp, greeting.timestamp);

  assert.true(!!peer2alphaMessage,
    'peer2alpha should receive message broadcasted from peer1alpha.');
  assert.equal(peer2alphaMessage.hash, greeting.hash);
  assert.deepEquals(peer2alphaMessage.body, greeting.body);
  assert.deepEquals(peer2alphaMessage.timestamp, greeting.timestamp);

  await after();
  await teardown();
});

