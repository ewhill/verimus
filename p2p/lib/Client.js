const { Buffer } = require('buffer');
const crypto = require('crypto');
const EventEmitter = require('events');
const WebSocket = require('ws');

const RSAKeyPair = require('./RSAKeyPair');
const HelloMessage = require('./messages/HelloMessage');
const SetupCipherMessage = require('./messages/SetupCipherMessage');
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
		logger = this.logger_,
	}) {

		const { rsaKeyPair } = credentials;
		if (!rsaKeyPair) {
			throw new Error(`Invalid credentials!`);
		}

		this.connection_ = connection;
		this.credentials_ = credentials;
		this.address_ = address;
		this.peerAddress_ = peerAddress;
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

				this.heloPromise
					.then(() => this.setupCipherPromise)
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
	 * Cleans up and tries to close the connection gracefully. Returns an 
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
			throw new Error(`Message could not be understood.`)
		} else if (bracketIndex === 0) {
			messageType = 'Message';
		} else if (bracketIndex > 0) {
			messageType = message.slice(0, bracketIndex);
			message = message.slice(bracketIndex);
		}

		if (this.isTrusted) {
			if (message.length > 5 * 1024 * 1024) {
				this.logger_.error(`Message size exceeds 5MB limit. Terminating payload to prevent potential V8 parse exhaustion.`);
				this.connection_.terminate();
				return;
			}
			try {
				message = JSON.parse(message);
			} catch (e) {
				this.logger_.error(e.stack);
				return;
			}

			// Create an AES-256-CBC decipher to decrypt the message body
			let encryptedMessageBody = Buffer.from(message.body, 'base64');
			let messageSignature =
				Buffer.from(message.header.signature, 'base64');

			this.logger_.log(`Message signature (last 16 bytes): ` +
				`\n\t-> ${messageSignature.toString('base64').slice(-32)}`);
			this.logger_.log(`Encrypted message body: ` +
				`\n\t-> ${encryptedMessageBody.toString('base64')}`);

			if (!message.header || !message.header.iv) {
				this.logger_.error(`Message transmitted without required AES initialization vector in header. Rejecting payload.`);
				return;
			}
			const messageIv = Buffer.from(message.header.iv, 'base64');
			let decipher = crypto.createDecipheriv('aes-256-gcm',
				this.remoteCipher_.key, messageIv);

			if (message.header.authTag) {
				decipher.setAuthTag(Buffer.from(message.header.authTag, 'base64'));
			}

			let decryptedMessageBody = (Buffer.concat([
				decipher.update(encryptedMessageBody), decipher.final()]));

			// Check the message header's 'signature' validity...
			const hasValidSignature =
				this.remoteCredentials_.rsaKeyPair.verify(
					decryptedMessageBody, messageSignature);

			if (hasValidSignature) {
				try {
					message.body =
						JSON.parse(decryptedMessageBody.toString('utf8'));
				} catch (e) {
					/*
					* We're probably here as a result of a decrpytion error or 
					* verification error, in which case the message may have 
					* been corrupted. Best to exit gracefully...
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
			const isHelloMessage = messageObj instanceof HelloMessage;
			const isSetupCipherMessage =
				messageObj instanceof SetupCipherMessage;

			if (!this.isTrusted && (isHelloMessage || isSetupCipherMessage)) {
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

		const isHelloMessage = message instanceof HelloMessage;
		const isCipherSetupMessage = message instanceof SetupCipherMessage;

		if (!isHelloMessage && !isCipherSetupMessage && !this.isTrusted) {
			this.logger_.warn(
				`Attempted to send message before connection could be ` +
				`upgraded: ${message}`);
			if (this.isUpgrading) {
				await this.upgrade();
			} else {
				throw new Error(`Connection is not trusted!`);
			}
		}

		const clone = Message.from(message);

		if (this.isTrusted) {
			try {
				const signature =
					(this.credentials_.rsaKeyPair.sign(
						JSON.stringify(message.body))).toString('base64');
				const iv = crypto.randomBytes(12);
				const cipher = crypto.createCipheriv(
					'aes-256-gcm', this.cipher_.key, iv);

				const messageBodyBuffer =
					Buffer.from(JSON.stringify(message.body));
				const encryptedMessageBodyBuffer =
					Buffer.concat([cipher.update(messageBodyBuffer),
					cipher.final()]);
				clone.body = encryptedMessageBodyBuffer.toString('base64');
				clone.header = { 
					authTag: cipher.getAuthTag().toString('base64'), 
					signature, 
					iv: iv.toString('base64') 
				};
			} catch (e) {
				throw new Error(`Could not encrypt message!`);
			}
		}

		return new Promise((resolve, reject) => {
			const data = message.constructor.name + clone.toString();

			const sendCallback = (err, backoff, connection, data) => {
				if (err) {
					backoff *= 1.5;

					if (backoff > MAX_MESSAGE_SEND_TIMEOUT_MS) {
						return reject(new Error(
							`Timeout reached attempting to send message!`));
					}

					this.managedTimeouts_.setTimeout(() => {
						this.connection_.send(message.toString(), (err) => {
							sendCallback(
								err, backoff, this.connection_, message);
						});
					}, backoff);
				} else {
					return resolve({ message });
				}
			};

			this.logger_.log(`Sending message:\n`, data);

			this.connection_.send(data, (err) => {
				sendCallback(err, 5000, this.connection_, data);
			});
		});
	}

	get sendHeloPromise() {
		if (!this.isConnected) {
			return Promise.reject(new Error(`Connection not open!`));
		}

		if (!this.hasSentHelo_) {
			const publicKeyStr = this.credentials_.rsaKeyPair.public.toString('utf8');
			let nonce = 0;
			let hash = '';
			do {
				nonce++;
				hash = crypto.createHash('sha256').update(publicKeyStr + nonce).digest('hex');
			} while (!hash.startsWith('0000'));

			let helloMessage = new HelloMessage({
				publicAddress: this.address,
				publicKey: publicKeyStr,
				nonce
			});
			helloMessage.header = {
				signature: (this.credentials_.rsaKeyPair.sign(
					JSON.stringify(helloMessage.body)))
					.toString('base64')
			};
			this.sendHeloPromise_ = this.send(helloMessage);
			this.hasSentHelo_ = true;
		}

		return this.sendHeloPromise_;
	}

	get receiveHeloPromise() {
		if (!this.isConnected) {
			return Promise.reject(new Error(`Connection not open!`));
		}

		if (!this.receiveHeloPromise_) {
			this.receiveHeloPromise_ = new Promise((resolve, reject) => {
				this.receiveHeloPromiseResolve_ = resolve;
				this.receiveHeloPromiseReject_ = reject;
				this.receiveHeloTimeout_ =
					this.managedTimeouts_.setTimeout(reject, 4000);
				this.bind_(HelloMessage).to((message, connection) => {
					this.heloHandler(message, connection);
				});
			}).then(() => {
				this.managedTimeouts_.clearTimeout(
					this.receiveHeloTimeout_);
				this.unbind_(HelloMessage);
			}).catch(err => {
				this.managedTimeouts_.clearTimeout(
					this.receiveHeloTimeout_);
				this.unbind_(HelloMessage);
				throw err;
			});
		}

		return this.receiveHeloPromise_;
	}

	heloHandler(message, connection) {
		const nonceHash = crypto.createHash('sha256')
			.update(message.publicKey + message.nonce).digest('hex');
		
		if (!nonceHash.startsWith('0000')) {
			return this.receiveHeloPromiseReject_(new Error(`Invalid Hashcash nonce bounds evaluated!`));
		}

		const peerAddress = message.publicAddress.toString('utf8');
		const peerPublicKeyBuffer = Buffer.from(message.publicKey, 'utf8');
		const peerRsaKeyPair =
			new RSAKeyPair({ publicKeyBuffer: peerPublicKeyBuffer });

		if (!peerRsaKeyPair) {
			return this.receiveHeloPromiseReject_(new Error(
				`Message did not contain credentials!`));
		}

		const ownPublicKey = this.credentials_.rsaKeyPair.public.toString('utf8');
		const remotePublicKey = peerPublicKeyBuffer.toString('utf8');

		if (ownPublicKey === remotePublicKey) {
			return this.receiveHeloPromiseReject_(new Error(
				`Received public key matching own public key from peer. ` +
				`Closing connection so as to prevent potential connection to self.`));
		}

		const formattedPublicKey =
			peerRsaKeyPair.public.toString('utf8')
				.replace(new RegExp('\n', 'ig'), '\n\t\t');

		this.logger_.log(
			`Remote peer @ ${peerAddress}\n` +
			`\t-> Public key:\n\t\t${formattedPublicKey}`);

		this.peerAddress_ = peerAddress;
		this.remoteCredentials_ = {
			rsaKeyPair: peerRsaKeyPair
		};

		return this.receiveHeloPromiseResolve_();
	};

	get heloPromise() {
		if (!this.isConnected) {
			return Promise.reject(new Error(`Connection not open!`));
		}

		if (!this.heloPromise_) {
			this.heloPromise_ = Promise.all([
				this.sendHeloPromise,
				this.receiveHeloPromise
			]);
		}

		return this.heloPromise_;
	}

	get sendSetupCipherPromise() {
		if (!this.isConnected) {
			return Promise.reject(new Error(`Connection not open!`));
		}

		if (!this.hasSentSetupCipher_) {
			const encryptedKey =
				this.remoteCredentials_.rsaKeyPair.encrypt(this.cipher_.key)
					.toString('base64');
			let setupCipherMessage = new SetupCipherMessage({
				key: encryptedKey,
			});
			setupCipherMessage.header = {
				signature: (this.credentials_.rsaKeyPair.sign(
					JSON.stringify(setupCipherMessage.body)))
					.toString('base64')
			};

			this.sendSetupCipherPromise_ = this.send(setupCipherMessage);
			this.hasSentSetupCipher_ = true;
		}

		return this.sendSetupCipherPromise_;
	}

	get receiveSetupCipherPromise() {
		if (!this.isConnected) {
			return Promise.reject(new Error(`Connection not open!`));
		}

		if (!this.receiveSetupCipherPromise_) {
			this.receiveSetupCipherPromise_ = new Promise((resolve, reject) => {
				this.bind_(SetupCipherMessage).to((message, connection) => {
					this.setupCipherHandler(message, connection);
				});
				this.setupCipherPromiseResolve_ = resolve;
				this.setupCipherPromiseReject_ = reject;
				this.receiveSetupCipherTimeout_ =
					this.managedTimeouts_.setTimeout(reject, 4000);
			}).then(() => {
				this.managedTimeouts_.clearTimeout(
					this.receiveSetupCipherTimeout_);
				this.unbind_(SetupCipherMessage);
			});
		}

		return this.receiveSetupCipherPromise_;
	}

	setupCipherHandler(message, connection) {
		try {
			const key = this.credentials_.rsaKeyPair.decrypt(
				Buffer.from(message.key, 'base64'));
			connection.remoteCipher_ = { key };
		} catch (e) {
			return this.setupCipherPromiseReject_(new Error(
				`Could not decrypt encryption properties from SetupCipher ` +
				`message!`));
		}

		return this.setupCipherPromiseResolve_();
	}

	get setupCipherPromise() {
		if (!this.isConnected) {
			return Promise.reject(new Error(`Connection not open!`));
		}

		if (!this.setupCipherPromise_) {
			this.setupCipherPromise_ = Promise.all([
				this.sendSetupCipherPromise,
				this.receiveSetupCipherPromise
			]);
		}

		return this.setupCipherPromise_;
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

