const { Buffer } = require('buffer');
const crypto = require('crypto');
const EventEmitter = require('events');
const WebSocket = require('ws');

const EphemeralExchangeMessage = require('./messages/EphemeralExchangeMessage');
const { generateEphemeralSession, signEphemeralPayload, computeSessionSecret } = require('../../crypto_utils/CryptoUtils');
const { ethers } = require('ethers');
const RequestHandler = require('./RequestHandler');
const ManagedTimeouts = require('./ManagedTimeouts');
const Message = require('./Message');
const utils = require('./utils');

const WebSocketClient = WebSocket;
const WebSocketServer = WebSocket.Server;

const MAX_MESSAGE_SEND_TIMEOUT_MS = 30000; // 30s


class Client {
	cipher_ = {
		key: Buffer.from(crypto.randomBytes(32))
	};
	created_ = utils.utcTimestamp();
	eventEmitter_ = new EventEmitter();
	isTrusted_ = false;
	managedTimeouts_ = new ManagedTimeouts();
	requestHandlers_ = {};

	connection_;
	credentials_;
	address_;
	peerAddress_;
	logger_ = console;

	isConnected_ = false;
	isConnecting_ = false;
	connectPromise_;
	isTrusted_ = false;
	isUpgrading_ = false;
	upgradePromise_;
	upgradePromiseTimeout_;
	setupCipherPromise_;
	sendSetupCipherPromise_;
	receiveSetupCipherPromise_;
	setupCipherPromiseResolve_;
	setupCipherPromiseReject_;
	setupCipherTimeout_;
	heloPromise_;
	hasSentHelo = false;
	sendHeloPromise_;
	receiveHeloPromise_;
	receiveHeloTimeout_;
	receiveHeloPromiseResolve_;
	receiveHeloPromiseReject_;
	remoteCipher_;

	constructor({
		connection,
		credentials,
		address,
		peerAddress,
		expectedSignature,
		logger = this.logger_,
	}) {

		const { evmPrivateKey } = credentials;
		if (!evmPrivateKey) {
			throw new Error(`Invalid credentials (requires evmPrivateKey)!`);
		}
		this.ephemeralWallet_ = generateEphemeralSession();

		this.connection_ = connection;
		this.credentials_ = credentials;
		this.address_ = address;
		this.peerAddress_ = peerAddress;
		this.expectedSignature_ = expectedSignature;
		this.logger_ = logger;

		this.setupConnection();
	}

	setupConnection() {
		if (this.connection_.readyState !== WebSocket.OPEN) {
			this.isConnected_ = false;
			this.isConnecting_ = true;

			this.connectPromise_ = new Promise((resolve, reject) => {
				const connectCleanup = () => {
					this.isConnecting_ = false;
					this.connection_.removeEventListener(
						'error', onConnectError);
					this.connection_.removeEventListener(
						'open', onConnectOpen);
					this.connection_.removeEventListener(
						'close', onConnectClose);
				};

				const onConnectError = (e) => {
					connectCleanup();
					this.isConnected_ = false;
					return reject(e);
				};

				const onConnectOpen = () => {
					connectCleanup();
					this.isConnected_ = true;
					return resolve();
				};

				const onConnectClose = () => {
					connectCleanup();
					this.isConnected_ = false;
					return reject();
				};

				this.connection_.addEventListener('error', onConnectError);
				this.connection_.addEventListener('open', onConnectOpen);
				this.connection_.addEventListener('close', onConnectClose);
			}).then(() => {
				this.onConnected();
			});
		} else {
			this.connectPromise_ =
				Promise.resolve()
					.then(() => {
						this.onConnected();
					});
			this.isConnecting_ = false;
			this.isConnected_ = true;
		}

		return this.connectPromise_;
	}

	onConnected() {
		this.connection_.on('message', (e) => {
			this.onMessage_.apply(this, [e]);
		});

		this.connection_.on('close', (e) => {
			this.isConnected_ = false;
			this.isConnecting_ = false;
			this.isTrusted_ = false;
			this.managedTimeouts_.destroy();
			this.logger_.log(`Connection closed with code: ${e}`);
		});
	}

	connect() { return this.connectPromise_; }

	async upgrade() {
		if (!this.isConnected) {
			if (this.isConnecting) {
				await this.connect();
			} else {
				throw new Error(`Connection is not open!`);
			}
		}

		if (!this.isTrusted && !this.upgradePromise_) {
			this.isUpgrading_ = true;
			this.upgradePromise_ = new Promise((resolve, reject) => {
				this.upgradePromiseTimeout_ =
					this.managedTimeouts_.setTimeout(() => {
						return reject(new Error(
							`Timeout occurred waiting for upgrade!`));
					}, 6000);

				this.ephemeralExchangePromise
					.then(() => resolve())
					.catch(err => reject(err));
			}).then(() => {
				this.managedTimeouts_.clearTimeout(
					this.upgradePromiseTimeout_);
				this.isUpgrading_ = false;
				this.isTrusted_ = true;
			}).catch(err => {
				this.isUpgrading_ = false;
				this.logger_.error(err);
				// Ensure close and rethrow error after.
				return this.close()
					.then(() => {
						throw err;
					});
			});
		}

		return this.upgradePromise_;
	}

	/**
	 * Cleans up and tries to close the connection. Returns an 
	 * always-resolving promise that resolves when the work has been completed. 
	 * If the connection does not close within an adequet amount of time (5 
	 * seconds), it will be forcefully closed instead.
	 * 
	 * @return {Promise<void>} An always-resolving promise indicating the close
	 *                         work has been completing 
	 */
	close() {
		if (!this.isConnected_ && !this.isConnecting_) {
			return Promise.resolve();
		}

		return new Promise((resolve, reject) => {
			const closed = () => {
				this.managedTimeouts_.destroy();
				return resolve();
			};

			this.connection_.on('close', closed);
			this.isConnected_ = false;
			this.isConnecting_ = false;
			this.isTrusted_ = false;
			this.connection_.close();

			this.managedTimeouts_.setTimeout(() => {
				this.connection_.terminate();
				closed();
			}, 5000);
		});
	}

	onMessage_(message) {
		if (!(message instanceof String)) {
			message = message.toString('utf8');
		}

		let messageType;
		const bracketIndex = message.indexOf("{");

		if (bracketIndex < 0) {
			this.logger_.error(`Message could not be understood. Closing connection.`);
			this.connection_.terminate();
			return;
		} else if (bracketIndex === 0) {
			messageType = 'Message';
		} else if (bracketIndex > 0) {
			messageType = message.slice(0, bracketIndex);
			message = message.slice(bracketIndex);
		}

		if (this.isTrusted) {
			if (message.length > 100 * 1024 * 1024) {
				this.logger_.error(`Message size exceeds 100MB limit. Terminating payload to prevent potential V8 parse exhaustion.`);
				this.connection_.terminate();
				return;
			}
			try {
				message = JSON.parse(message);
			} catch (e) {
				this.logger_.error(e.stack);
				return;
			}

			let decryptedMessageBody;
			let messageSignature;
			try {
				let encryptedMessageBody = Buffer.from(message.body || '', 'base64');
				messageSignature =
					Buffer.from(message.header.signature || '', 'base64');

				if (!message.header || !message.header.iv) {
					this.logger_.error(`Message transmitted without required AES initialization vector in header. Rejecting payload.`);
					return;
				}
				const messageIv = Buffer.from(message.header.iv, 'base64');
				let decipher = crypto.createDecipheriv('aes-256-gcm',
					this.remoteCipher_.key, messageIv);

				if (!message.header.authTag) {
					this.logger_.error(`AES GCM Requires an Authentication Tag verifying payload integrity! Rejecting.`);
					return;
				}
				decipher.setAuthTag(Buffer.from(message.header.authTag, 'base64'));

				decryptedMessageBody = (Buffer.concat([
					decipher.update(encryptedMessageBody), decipher.final()]));
			} catch(e) {
				this.logger_.error(`Decryption failed. MITM or payload corruption detected.`);
				return;
			}

			// Check the message header's 'signature' validity...
			let hasValidSignature = false;
			try {
				const recoveredAddress = ethers.verifyMessage(decryptedMessageBody.toString('utf8'), Buffer.from(messageSignature, 'base64').toString('utf8'));
				hasValidSignature = (recoveredAddress.toLowerCase() === this.remoteCredentials_.walletAddress.toLowerCase());
			} catch (e) {
				hasValidSignature = false;
			}

			if (hasValidSignature) {
				try {
					message.body =
						JSON.parse(decryptedMessageBody.toString('utf8'));
				} catch (e) {
					/*
					* We're probably here as a result of a decrpytion error or 
					* verification error, in which case the message may have 
					* been corrupted. Best to exit...
					*/
					this.logger_.error(
						`A trusted message was received but either ` +
						`could not be decrypted with the agreed-upon ` +
						`encryption properties or could not be verified ` +
						`using the established RSA keys and given message ` +
						`signature.`);
					return;
				}
			} else {
				// Signature didn't match, throw error to exit.
				this.logger_.error(
					`ERROR: Message decrypted, but signature could not be ` +
					`verified.`);
				return;
			}
		}

		this.logger_.log(`Received message: "${messageType}".`);

		if (this.requestHandlers_.hasOwnProperty(messageType)) {
			const handler = this.requestHandlers_[messageType];
			const messageObj = handler.upgrade(message);
			const isEphemeralMessage = messageObj instanceof EphemeralExchangeMessage;

			if (!this.isTrusted && isEphemeralMessage) {
				try {
					handler.invoke(messageObj, this);
				} catch (e) {
					this.logger_.error(e.stack);
				}
			} else {
				this.logger_.error(
					`Message received but connection is not setup or trusted.`);
			}

			return; // Don't continue.
		}

		// Drop normal generic payload execution mapped out of untrusted socket bounds
		if (!this.isTrusted) {
			this.logger_.error(`Dropping untrusted generic message: ${messageType}`);
			return;
		}

		this.logger_.log(`Emitting message event for ${messageType}.`);
		this.eventEmitter_.emit('message', this, messageType, message);
	}

	onMessage(callback) {
		this.eventEmitter_.on('message', callback);
	}

	offMessage(callback) {
		this.eventEmitter_.off('message', callback);
	}

	bind_(RequestClass) {
		const requestHandler = new RequestHandler(RequestClass);
		this.requestHandlers_[RequestClass.name] = requestHandler;
		return this.requestHandlers_[RequestClass.name];
	}

	unbind_(RequestClass) {
		if (this.requestHandlers_.hasOwnProperty(RequestClass.name)) {
			const unbound = this.requestHandlers_[RequestClass.name];
			delete this.requestHandlers_[RequestClass.name];
			return unbound;
		}
		return false;
	}

	/**
	 * Sends a message to this client's remote and tries to resent the message 
	 * if the send fails.
	 * 
	 * @param  {Message} message 
	 *         The message to send to the connection.
	 */
	async send(message) {
		if (!message) {
			throw new Error(`Invalid message!`);
		}

		if (!this.isConnected) {
			if (this.isConnecting) {
				await this.connect();
			} else {
				throw new Error(`Connection is not open!`);
			}
		}

		const isEphemeralMessage = message instanceof EphemeralExchangeMessage;

		if (!isEphemeralMessage && !this.isTrusted) {
			this.logger_.warn(
				`Attempted to send message before connection could be ` +
				`upgraded: ${message}`);
			if (this.isUpgrading) {
				await this.upgrade();
			} else {
				throw new Error(`Connection is not trusted!`);
			}
		}

		let data;

		if (this.isTrusted) {
			try {
				let sigStr = message.header.signature;
				if (!sigStr) {
					const wallet = new ethers.Wallet(this.credentials_.evmPrivateKey);
					sigStr = await wallet.signMessage(JSON.stringify(message.body));
				}
				const signature = Buffer.from(sigStr, 'utf8').toString('base64');
				const iv = crypto.randomBytes(12);
				const cipher = crypto.createCipheriv(
					'aes-256-gcm', this.cipher_.key, iv);

				const messageBodyBuffer =
					Buffer.from(JSON.stringify(message.body));
				const encryptedMessageBodyBuffer =
					Buffer.concat([cipher.update(messageBodyBuffer),
					cipher.final()]);
				
				const header = {
					...message.header,
					authTag: cipher.getAuthTag().toString('base64'),
					signature,
					iv: iv.toString('base64')
				};

				data = message.constructor.name + JSON.stringify({
					header,
					body: encryptedMessageBodyBuffer.toString('base64')
				});
			} catch (e) {
				throw new Error(`Could not encrypt message!`);
			}
		} else {
			const clone = Message.from(message);
			data = message.constructor.name + clone.toString();
		}

		return new Promise((resolve, reject) => {
			const sendCallback = (err, backoff, connection, data) => {
				if (err) {
					backoff *= 1.5;

					if (backoff > MAX_MESSAGE_SEND_TIMEOUT_MS) {
						return reject(new Error(
							`Timeout reached attempting to send message!`));
					}

					this.managedTimeouts_.setTimeout(() => {
						this.connection_.send(data, (err) => {
							sendCallback(
								err, backoff, this.connection_, data);
						});
					}, backoff);
				} else {
					return resolve({ message });
				}
			};

			// this.logger_.log(`Sending message:\n`, data); // Removed due to disk space exhaustion

			this.connection_.send(data, (err) => {
				sendCallback(err, 5000, this.connection_, data);
			});
		});
	}

	async sendEphemeralMessage() {
		if (!this.isConnected) throw new Error(`Connection not open!`);

		const ephemeralPublicKey = this.ephemeralWallet_.ephemeralPublicKey;
		const payload = JSON.stringify({ ePublicKey: ephemeralPublicKey, peerAddr: this.address });
		const innerSignature = await signEphemeralPayload(this.credentials_.evmPrivateKey, payload);

		const ephemeralMsg = new EphemeralExchangeMessage({
			ephemeralPublicKey,
			signature: innerSignature,
			publicAddress: this.address
		});

		return this.send(ephemeralMsg);
	}

	get receiveEphemeralPromise() {
		if (!this.isConnected) return Promise.reject(new Error(`Connection not open!`));

		if (!this.receiveEphemeralPromise_) {
			this.receiveEphemeralPromise_ = new Promise((resolve, reject) => {
				this.receiveEphemeralPromiseResolve_ = resolve;
				this.receiveEphemeralPromiseReject_ = reject;
				this.receiveEphemeralTimeout_ = this.managedTimeouts_.setTimeout(reject, 6000);
				
				this.bind_(EphemeralExchangeMessage).to(async (message, connection) => {
					await this.ephemeralExchangeHandler(message, connection);
				});
			}).then(() => {
				this.managedTimeouts_.clearTimeout(this.receiveEphemeralTimeout_);
				this.unbind_(EphemeralExchangeMessage);
			}).catch(err => {
				this.managedTimeouts_.clearTimeout(this.receiveEphemeralTimeout_);
				this.unbind_(EphemeralExchangeMessage);
				throw err;
			});
		}

		return this.receiveEphemeralPromise_;
	}

	async ephemeralExchangeHandler(message, connection) {
		try {
			const peerAddress = message.publicAddress;
			if (!message.ephemeralPublicKey || !message.signature) {
				return this.receiveEphemeralPromiseReject_(new Error(`Invalid ephemeral structure!`));
			}

			const ePubKey = message.ephemeralPublicKey;
			const sig = message.signature;
			
			const payload = JSON.stringify({ ePublicKey: ePubKey, peerAddr: peerAddress });

			const recoveredAddress = ethers.verifyMessage(payload, sig);

			if (this.expectedSignature_ && recoveredAddress.toLowerCase() !== this.expectedSignature_.toLowerCase()) {
				return this.receiveEphemeralPromiseReject_(new Error(`Connected wallet address did not match expected pinned identity. Dropping MITM socket.`));
			}

			this.peerAddress_ = peerAddress;
			this.remoteCredentials_ = { walletAddress: recoveredAddress };

			// Compute Session Secret Mutually
			const symmetricBuf = Buffer.from(computeSessionSecret(this.ephemeralWallet_.ephemeralPrivateKey, ePubKey), 'hex');
			this.cipher_.key = symmetricBuf;
			this.remoteCipher_ = { key: symmetricBuf };

			// Teardown Memory Forward Secrecy Footprint
			delete this.ephemeralWallet_;

			this.receiveEphemeralPromiseResolve_();
		} catch (err) {
			this.receiveEphemeralPromiseReject_(err);
		}
	}

	get ephemeralExchangePromise() {
		if (!this.isConnected) return Promise.reject(new Error(`Connection not open!`));

		if (!this.ephemeralExchangePromise_) {
			this.ephemeralExchangePromise_ = Promise.all([
				this.sendEphemeralMessage(),
				this.receiveEphemeralPromise
			]);
		}

		return this.ephemeralExchangePromise_;
	}

	get address() {
		return this.address_;
	}
	get peerAddress() {
		if (!this.peerAddress_) {
			return `${this.connection_._socket.remoteAddress}:` +
				`${this.connection_._socket.remotePort}`;
		}
		return this.peerAddress_;
	}

	get created() { return this.created_ };
	get on() { return this.connection_.on; }
	get isConnected() { return this.isConnected_; }
	get isConnecting() { return this.isConnecting_; }
	get isUpgrading() { return this.isUpgrading_; }
	get isTrusted() { return this.isTrusted_; }
	get isTrusted() { return this.isTrusted_; }
	get remotePublicKey() { return this.remoteCredentials_?.rsaKeyPair?.public?.toString('utf8'); }
	get remoteSignature() { return this.remotePublicKey; }
}

module.exports = Client;

