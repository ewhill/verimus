import { Request } from 'express';

export class MockRequest {
    body: any;
    params: any;
    query: any;
    headers: any;
    file?: any;
    files?: any[];
    ip: string;
    method: string;
    originalUrl: string;

    constructor(options: Partial<MockRequest> = {}) {
        this.body = options.body || {};
        this.params = options.params || {};
        this.query = options.query || {};
        this.headers = options.headers || {};
        this.file = options.file;
        this.files = options.files;
        this.ip = options.ip || '127.0.0.1';
        this.method = options.method || 'GET';
        this.originalUrl = options.originalUrl || '/';
    }

    get(headerName: string): string | undefined {
        return this.headers[headerName.toLowerCase()];
    }

    // Cast self to Request strictly for harness compatibility without "any" pollution
    asRequest(): Request {
        return this as unknown as Request;
    }
}
