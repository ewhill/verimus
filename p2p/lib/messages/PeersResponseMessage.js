const Message = require('../Message');

class PeersResponseMessage extends Message {
	constructor(options = {}) {
		super();
		const { peers = [], since = 0 } = options;
		this.peers = peers;
		this.since = since;
	}

	get peers() {
		return this.body.peers;
	}
	set peers(peers = []) {
		if (!Array.isArray(peers)) {
			throw new Error(`Invalid type for PeersResponseMessage 'peers' parameter.`);
		}
		this.body.peers = peers;
	}

	get since() {
		return this.body.since;
	}
	set since(since = 0) {
		if (typeof since !== 'number') {
			throw new Error(`Invalid type for PeersResponseMessage 'since' parameter.`);
		}
		this.body.since = new Date(since);
	}
}

module.exports = PeersResponseMessage;