const test = require('tape');

const PeersResponseMessage = require('../../lib/messages/PeersResponseMessage');
const utils = require('../../lib/utils');

test("PeersResponseMessage", (assert) => {
  const emptyPeersResponseMessage = new PeersResponseMessage();

  assert.deepEqual(emptyPeersResponseMessage.since, new Date(0),
    "Default value of since should be provided via constructor.");

  assert.deepEqual(emptyPeersResponseMessage.peers, [],
    "Default value of peers should be provided via constructor.");

  assert.throws(() => { emptyPeersResponseMessage.since = 'a'; },
    "Attempting to set since property to non-number value should throw.");

  assert.throws(() => { emptyPeersResponseMessage.peers = 'a'; },
    "Attempting to set peers property to non-array value should throw.");

  emptyPeersResponseMessage.since = undefined;
  assert.deepEqual(emptyPeersResponseMessage.since, new Date(0),
    "Default value of since should be provided via property setter.");

  emptyPeersResponseMessage.peers = undefined;
  assert.deepEqual(emptyPeersResponseMessage.peers, [],
    "Default value of peers should be provided via property setter.");

  const nowDate = new Date(Date.now());
  const peersList = [{ a: 'a' }, { b: 'b' }];
  let peersMessage = new PeersResponseMessage({
    since: nowDate.getTime(),
    peers: peersList,
  });

  assert.deepEqual(peersMessage.since, nowDate,
    "Set and get since property value should be equal");

  assert.deepEqual(peersMessage.peers, peersList,
    "Set and get since property value should be equal");

  assert.end();
});

