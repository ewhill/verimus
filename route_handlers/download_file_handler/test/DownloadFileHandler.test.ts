import * as assert from 'node:assert';
import { describe, it } from 'node:test';

import type { Request, Response } from 'express';

import { createMock } from '../../../test/utils/TestUtils';
import DownloadFileHandler from '../DownloadFileHandler';

describe('Backend: downloadFileHandler Unit Tests', () => {
    it('Returns HTTP 400 asserting decryption MUST happen client-side', async () => {
        // @ts-ignore
        const handler = new DownloadFileHandler({});

        const req = createMock<Request>({ params: { hash: 'validh', filename: 'file.txt' } });
        let statusSet = 0;
        let bodyPayload = '';
        const res = createMock<Response>({
            status: function (s: number) { statusSet = s; return this as Response; },
            send: function (b: any) { bodyPayload = b as string; return this as Response; }
        });

        await handler.handle(req, res);

        assert.strictEqual(statusSet, 400);
        assert.ok(bodyPayload.includes('Decryption Client-Side Required'));
    });
});
