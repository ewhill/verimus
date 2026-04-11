import { Request, Response } from 'express';

import BaseHandler from '../base_handler/BaseHandler';

export default class UploadEventsHandler extends BaseHandler {
    async handle(req: Request, res: Response): Promise<void> {
        // Enforce Server-Sent Events headers mapping Native Streaming limitations securely
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');


        // Flush boundaries enforcing immediate TCP resolution
        res.flushHeaders();

        // Send organic handshake validating pipeline
        res.write(`data: ${JSON.stringify({ status: 'INITIALIZED', message: 'SSE Telemetry Stream Bound' })}\n\n`);

        const telemetryListener = (payload: any) => {
            // Write JSON payloads mapped recursively preventing structural mismatches
            res.write(`data: ${JSON.stringify(payload)}\n\n`);
        };

        // Attach memory listeners natively bridging the P2P events boundary
        this.node.events.on('upload_telemetry', telemetryListener);

        // Sanitize TCP limits natively guaranteeing zero zombie leakages
        req.on('close', () => {
            this.node.events.off('upload_telemetry', telemetryListener);
            res.end();
        });
    }
}
