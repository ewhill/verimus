const test = require('tape');

const PeersRequestMessage = require('../../lib/messages/PeersRequestMessage');

test("PeersRequestMessage", (assert) => {
  const emptyPeersRequestMessage = new PeersRequestMessage();

  assert.deepEqual(emptyPeersRequestMessage.since, new Date(0),
    "Default value of since should be provided via constructor.");

  assert.deepEqual(emptyPeersRequestMessage.limit, 50,
    "Default value of limit should be provided via constructor.");

  assert.throws(() => { emptyPeersRequestMessage.since = 'a'; },
    "Attempting to set since property to non-number value should throw.");

  assert.throws(() => { emptyPeersRequestMessage.limit = 'a'; },
    "Attempting to set limit property to non-number value should throw.");

  emptyPeersRequestMessage.since = undefined;
  assert.deepEqual(emptyPeersRequestMessage.since, new Date(0),
    "Default value of since should be provided via property setter.");

  emptyPeersRequestMessage.limit = undefined;
  assert.deepEqual(emptyPeersRequestMessage.limit, 50,
    "Default value of limit should be provided via property setter.");

  const nowDate = new Date(Date.now());
  let peersMessage = new PeersRequestMessage({
    since: nowDate.getTime(),
    limit: 100,
  });

  assert.deepEqual(peersMessage.since, nowDate,
    "Set and get since property value should be equal");

  assert.deepEqual(peersMessage.limit, 100,
    "Set and get limit property value should be equal");

  assert.end();
});
