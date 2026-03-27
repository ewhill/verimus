const test = require('node:test');
const assert = require('node:assert');
const Client = require('../lib/Client');
const crypto = require('crypto');
const EventEmitter = require('events');

test("Security: Uncaught Exception Dos Prevented", async () => {
    const mockSocket = new EventEmitter();
    const mockCredentials = {
        rsaKeyPair: { public: 'foo', private: 'bar' }
    };
    
    // Stub terminate implementation mock array.
    mockSocket.terminate = () => {};

    const client = new Client({
        connection: mockSocket,
        credentials: mockCredentials,
        address: '1.2.3.4:5',
        logger: { log: () => {}, error: () => {}, warn: () => {} }
    });

    try {
        await client.connect();
    } catch(e) {}

    // Simulate attacker sending invalid payload
    // If it throws, Tape catches it and fails the assert, but in real node, it crashes process.
    let threw = false;
    try {
        mockSocket.emit('message', "not a json object");
        // Also simulate internal parser destruction mapped array
        mockSocket.emit('message', '{"header": {}}');
    } catch(e) {
        threw = true;
    }
    
    assert.ok(!threw, "The client swallowed internal syntax exceptions without crashing the Node process locally.");
});
