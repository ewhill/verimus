import express from 'express';
import multer from 'multer';
import os from 'os';
import path from 'path';
import PeerNode from '../peer_node/PeerNode';
import NodeConfigHandler from '../route_handlers/node_config_handler/NodeConfigHandler';
import BlocksHandler from '../route_handlers/blocks_handler/BlocksHandler';
import PeersHandler from '../route_handlers/peers_handler/PeersHandler';
import UploadHandler from '../route_handlers/upload_handler/UploadHandler';
import DownloadHandler from '../route_handlers/download_handler/DownloadHandler';
import DownloadFileHandler from '../route_handlers/download_file_handler/DownloadFileHandler';
import PrivatePayloadHandler from '../route_handlers/private_payload_handler/PrivatePayloadHandler';
import FilesHandler from '../route_handlers/files_handler/FilesHandler';
import LogsHandler from '../route_handlers/logs_handler/LogsHandler';
import DefaultHandler from '../route_handlers/default_handler/DefaultHandler';

export default function setupExpressApp(peerNode: PeerNode) {
    const app = express();
    const upload = multer({ dest: os.tmpdir() });

    const checkAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
        const ip = req.ip || req.socket.remoteAddress || '';
        
        if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
            return next();
        }

        const expectedUser = process.env.UI_USERNAME || 'admin';
        const expectedPass = process.env.UI_PASSWORD || 'admin';

        const authHeader = req.headers.authorization || '';
        if (authHeader.startsWith('Basic ')) {
            const b64auth = authHeader.split(' ')[1] || '';
            const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');

            if (login === expectedUser && password === expectedPass) {
                return next();
            }
        }

        res.set('WWW-Authenticate', 'Basic realm="Secure Node Area"');
        res.status(401).send('Authentication required.');
    };

    app.use(checkAuth);

    // Serve static files from public directory
    if (!peerNode.isHeadless) {
        app.use(express.static(path.join(__dirname, '../public')));
    }
    app.use(express.json());

    app.get('/api/node/config', new NodeConfigHandler(peerNode).handle);
    app.get('/api/blocks', new BlocksHandler(peerNode).handle);
    app.get('/api/peers', new PeersHandler(peerNode).handle);
    app.post('/api/upload', upload.array('files'), new UploadHandler(peerNode).handle);
    app.get('/api/download/:hash', new DownloadHandler(peerNode).handle);
    app.get('/api/download/:hash/file/:filename', new DownloadFileHandler(peerNode).handle);
    app.get('/api/blocks/:hash/private', new PrivatePayloadHandler(peerNode).handle);
    app.get('/api/files', new FilesHandler(peerNode).handle);
    app.get('/api/logs', new LogsHandler(peerNode).handle);

    // Fallback for SPA path-based routing
    if (!peerNode.isHeadless) {
        app.use(new DefaultHandler(peerNode).handle);
    } else {
        app.use((req, res) => {
            res.status(404).json({ success: false, message: 'Node running in Headless Mode.' });
        });
    }

    return app;
};
