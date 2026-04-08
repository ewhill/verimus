const Message = require('../Message');

class HelloMessage extends Message {
	constructor(options = {}) {
		super();
		const { publicAddress, publicKey, signature, nonce, walletAddress } = options;
		this.publicAddress = publicAddress;
		this.publicKey = publicKey;
		this.signature = signature;
		this.nonce = nonce;
		this.walletAddress = walletAddress;
	}

	get publicAddress() {
		return this.body.publicAddress;
	}
	set publicAddress(publicAddress) {
		this.body.publicAddress = publicAddress;
	}

	get publicKey() {
		return this.body.publicKey;
	}
	set publicKey(publicKey) {
		this.body.publicKey = publicKey;
	}

	get signature() {
		return this.body.signature;
	}
	set signature(signature) {
		this.body.signature = signature;
	}

	get nonce() { return this.body.nonce; }
	set nonce(nonce) { this.body.nonce = nonce; }

	get walletAddress() { return this.body.walletAddress; }
	set walletAddress(walletAddress) { this.body.walletAddress = walletAddress; }
}

module.exports = HelloMessage;