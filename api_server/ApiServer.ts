import crypto from 'crypto';
import os from 'os';
import path from 'path';


import express from 'express';
import multer from 'multer';

import { IS_DEV_NETWORK } from '../constants';
import logger from '../logger/Logger';
import PeerNode from '../peer_node/PeerNode';
import AuditEventsHandler from '../route_handlers/audit_events_handler/AuditEventsHandler';
import BlocksHandler from '../route_handlers/blocks_handler/BlocksHandler';
import ConsensusHandler from '../route_handlers/consensus_handler/ConsensusHandler';
import ContractsHandler from '../route_handlers/contracts_handler/ContractsHandler';
import DefaultHandler from '../route_handlers/default_handler/DefaultHandler';
import DownloadFileHandler from '../route_handlers/download_file_handler/DownloadFileHandler';
import DownloadHandler from '../route_handlers/download_handler/DownloadHandler';
import FilesHandler from '../route_handlers/files_handler/FilesHandler';
import LedgerMetricsHandler from '../route_handlers/ledger_metrics_handler/LedgerMetricsHandler';
import LogsHandler from '../route_handlers/logs_handler/LogsHandler';
import NodeConfigHandler from '../route_handlers/node_config_handler/NodeConfigHandler';
import UpdateNodeConfigHandler from '../route_handlers/node_config_handler/UpdateNodeConfigHandler';
import PeersHandler from '../route_handlers/peers_handler/PeersHandler';
import PrivatePayloadHandler from '../route_handlers/private_payload_handler/PrivatePayloadHandler';
import TransactionsHandler from '../route_handlers/transactions_handler/TransactionsHandler';
import UploadEventsHandler from '../route_handlers/upload_events_handler/UploadEventsHandler';
import UploadHandler from '../route_handlers/upload_handler/UploadHandler';
import WalletHandler from '../route_handlers/wallet_handler/WalletHandler';

export default function setupExpressApp(peerNode: PeerNode) {
    const app = express();
    const upload = multer({ dest: os.tmpdir() });

    let expectedUser = process.env.UI_USERNAME || 'admin';
    let expectedPass = process.env.UI_PASSWORD;
    if (!process.env.UI_PASSWORD) {
        if (IS_DEV_NETWORK) {
            expectedPass = 'admin';
        } else {
            expectedPass = crypto.randomBytes(16).toString('hex');
            logger.info(`[Auth] No UI_PASSWORD set in production. Generated secure password for ${expectedUser}: ${expectedPass}`);
        }
    }

    const checkAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
        const authHeader = req.headers.authorization || '';
        if (authHeader.startsWith('Basic ')) {
            const b64auth = authHeader.split(' ')[1] || '';
            const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');

            if (login === expectedUser && password === expectedPass) {
                return next();
            }
        }

        // Do not send WWW-Authenticate header to prevent native browser popups interrupting public wallet users.
        res.status(401).json({ success: false, message: 'Authentication required. Reserved for Node Owner.' });
    };

    // Serve static files from public directory
    if (!peerNode.isHeadless) {
        app.use(express.static(path.join(__dirname, '../public')));
    }
    app.use(express.json());

    // Lightweight health check endpoint — no auth, no DB dependency.
    // Used by headless workers to poll seed node readiness before joining the P2P network.
    app.get('/health', (_unusedReq, res) => {
        res.status(200).json({ status: 'ok', port: peerNode.port });
    });

    // Public Node Config (Allows clients to discover fee / roles)
    app.get('/api/node/config', new NodeConfigHandler(peerNode).handle);

    // Private Node Owner Routes
    app.get('/api/node/auth', checkAuth, (req, res) => res.json({ success: true, message: 'Authorized Admin' }));
    app.post('/api/node/config', checkAuth, new UpdateNodeConfigHandler(peerNode).handle);
    app.get('/api/audit/events', checkAuth, new AuditEventsHandler(peerNode).handle);
    app.get('/api/logs', checkAuth, new LogsHandler(peerNode).handle);

    // Public Wallet Owner Routes
    app.get('/api/peers', new PeersHandler(peerNode).handle);
    app.get('/api/upload/events', new UploadEventsHandler(peerNode).handle);
    app.get('/api/ledger/metrics', new LedgerMetricsHandler(peerNode).handle);
    app.get('/api/blocks', new BlocksHandler(peerNode).handle);
    app.get('/api/consensus', new ConsensusHandler(peerNode).handle);
    app.get('/api/contracts', new ContractsHandler(peerNode).handle);
    app.post('/api/upload', upload.array('files'), new UploadHandler(peerNode).handle);
    app.post('/api/transactions', new TransactionsHandler(peerNode).handle);
    app.get('/api/download/:hash', new DownloadHandler(peerNode).handle);
    app.get('/api/download/:hash/file/:filename', new DownloadFileHandler(peerNode).handle);
    app.get('/api/blocks/:hash/private', new PrivatePayloadHandler(peerNode).handle);
    app.get('/api/files', new FilesHandler(peerNode).handle);
    app.get('/api/wallet', new WalletHandler(peerNode).handle);

    // Fallback for SPA path-based routing
    if (!peerNode.isHeadless) {
        app.use(new DefaultHandler(peerNode).handle);
    } else {
        app.use((_unusedReq, res) => {
            res.status(404).json({ success: false, message: 'Node running in Headless Mode.' });
        });
    }

    return app;
};
