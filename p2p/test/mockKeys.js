const { generateKeyPairSync } = require('node:crypto');

const keys = {};

function getMockKey(name) {
    if (!keys[name]) {
        const { publicKey, privateKey } = generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        });
        keys[name] = { public: publicKey, private: privateKey };
    }
    return keys[name];
}

module.exports = new Proxy({}, {
    get: (target, prop) => {
        return getMockKey(prop);
    }
});
