const test = require('tape');

const HelloMessage = require('../../lib/messages/HelloMessage');


test("HelloMessage", (assert) => {
  const emptyHelloMessage = new HelloMessage();

  assert.equal(emptyHelloMessage.publicKey, undefined,
    "Empty constructor value for publicKey should leave property unset.");
  assert.equal(emptyHelloMessage.signature, undefined,
    "Empty constructor value for signature should leave property unset.");

  const helloMessage = new HelloMessage({ publicKey: 'asd', signature: '123' });

  assert.equal(helloMessage.publicKey, 'asd',
    "Provided value for publicKey via constructor should set the publicKey.");
  assert.equal(helloMessage.signature, '123',
    "Provided value for signature via constructor should set the signature.");

  helloMessage.publicKey = 'a';
  assert.equal(helloMessage.publicKey, 'a',
    "Provided value for publicKey via setter should set the publicKey.");
  helloMessage.signature = 'b';
  assert.equal(helloMessage.signature, 'b',
    "Provided value for signature via setter should set the signature.");

  assert.end();
});

