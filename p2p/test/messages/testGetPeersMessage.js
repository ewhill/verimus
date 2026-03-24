const test = require('tape');

const GetPeersMessage = require('../../lib/messages/GetPeersMessage');

test("GetPeersMessage", (assert) => {
  const emptyGetPeersMessage = new GetPeersMessage();

  assert.deepEqual(emptyGetPeersMessage.since, new Date(0),
    "Default value of since should be provided via constructor.");

  assert.deepEqual(emptyGetPeersMessage.limit, 50,
    "Default value of limit should be provided via constructor.");

  assert.throws(() => { emptyGetPeersMessage.since = 'a'; },
    "Attempting to set since property to non-number value should throw.");

  assert.throws(() => { emptyGetPeersMessage.limit = 'a'; },
    "Attempting to set limit property to non-number value should throw.");

  emptyGetPeersMessage.since = undefined;
  assert.deepEqual(emptyGetPeersMessage.since, new Date(0),
    "Default value of since should be provided via property setter.");

  emptyGetPeersMessage.limit = undefined;
  assert.deepEqual(emptyGetPeersMessage.limit, 50,
    "Default value of limit should be provided via property setter.");

  const nowDate = new Date(Date.now());
  let peersMessage = new GetPeersMessage({
    since: nowDate.getTime(),
    limit: 100,
  });

  assert.deepEqual(peersMessage.since, nowDate,
    "Set and get since property value should be equal");

  assert.deepEqual(peersMessage.limit, 100,
    "Set and get limit property value should be equal");

  assert.end();
});
