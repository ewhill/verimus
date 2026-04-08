const Message = require('../Message');

class EphemeralExchangeMessage extends Message {
	constructor(options = {}) {
		super();
		const { ephemeralPublicKey, signature } = options;
		this.ephemeralPublicKey = ephemeralPublicKey;
		this.signature = signature;
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
}

module.exports = EphemeralExchangeMessage;
