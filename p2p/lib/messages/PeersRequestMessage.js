const Message = require('../Message');

class PeersRequestMessage extends Message {
	constructor(options = {}) {
		super(options);
		const { since = 0, limit = 50 } = options;
		this.since = since;
		this.limit = limit;
	}

	get since() {
		return this.body.since;
	}
	set since(since = 0) {
		if (typeof since !== 'number') {
			throw new Error(`Invalid type for PeersRequestMessage 'since' parameter.`);
		}
		this.body.since = new Date(since);
	}

	get limit() {
		return this.body.limit;
	}
	set limit(limit = 50) {
		if (typeof limit !== 'number') {
			throw new Error(`Invalid type for PeersRequestMessage 'limit' parameter.`);
		}
		this.body.limit = limit;
	}
}

module.exports = PeersRequestMessage;
