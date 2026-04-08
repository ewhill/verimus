const Message = require('../Message');

class EphemeralExchangeMessage extends Message {
	constructor(options = {}) {
		super();
		const { ephemeralPublicKey, signature, publicAddress } = options;
		this.ephemeralPublicKey = ephemeralPublicKey;
		this.signature = signature;
		this.publicAddress = publicAddress;
	}

	get ephemeralPublicKey() {
		return this.body.ephemeralPublicKey;
	}
	set ephemeralPublicKey(ephemeralPublicKey) {
		this.body.ephemeralPublicKey = ephemeralPublicKey;
	}

	get signature() {
		return this.body.signature;
	}
	set signature(signature) {
		this.body.signature = signature;
	}

	get publicAddress() {
		return this.body.publicAddress;
	}
	set publicAddress(publicAddress) {
		this.body.publicAddress = publicAddress;
	}
}

module.exports = EphemeralExchangeMessage;
