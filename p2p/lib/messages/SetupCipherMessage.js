const Message = require('../Message');

class SetupCipherMessage extends Message {
	constructor(options = {}) {
		super();
		const { key } = options;
		this.key = key;
	}

	get key() {
		return this.body.key;
	}
	set key(key) {
		this.body.key = key;
	}
}

module.exports = SetupCipherMessage;
