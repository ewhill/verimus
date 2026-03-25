import { Response } from 'express';

export class MockResponse {
    public statusCode: number = 200;
    public body: any;
    public headers: Record<string, string> = {};
    public _isEndCalled: boolean = false;
    public sentPath: string = '';

    status(code: number): this {
        this.statusCode = code;
        return this;
    }

    json(data: any): this {
        this.body = data;
        return this;
    }

    send(data: any): this {
        this.body = data;
        return this;
    }

    setHeader(name: string, value: string): this {
        this.headers[name] = value;
        return this;
    }

    end(): this {
        this._isEndCalled = true;
        return this;
    }

    sendFile(path: string): this {
        this.sentPath = path;
        return this;
    }

    write(chunk: any): boolean {
        this.body = (this.body || '') + chunk.toString();
        return true;
    }

    once(event: string, cb: Function): this {
        return this;
    }

    emit(event: string, ...args: any[]): boolean {
        return true;
    }

    on(event: string, cb: Function): this {
        return this;
    }

    // Cast self to Response strictly for harness compatibility without "any" pollution
    asResponse(): Response {
        return this as unknown as Response;
    }
}
