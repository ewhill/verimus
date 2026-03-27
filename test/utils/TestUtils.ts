import { Response } from 'express';

export const createMock = <T>(shape: Partial<T> = {} as Partial<T>): T => shape as T;

export interface MockResponse extends Response { body: any; statusCode: number; headers: Record<string, string>; }

export function createRes(): MockResponse {
    const resData = { statusCode: 200, body: null as any };
    const res = createMock<MockResponse>({
        headers: {} as Record<string, string>,
        headersSent: false,
        once: function(_unusedEvt: any, _unusedCb: any) { return this as unknown as MockResponse; },
        on: function(_unusedEvt: any, _unusedCb: any) { return this as unknown as MockResponse; },
        emit: function(_unusedEvt: any, _unusedData: any) { return true; },
        write: function(_unusedChunk: any, _unusedEnc?: any, _unusedCb?: any) { return true; },
        end: function(_unusedChunk?: any, _unusedEnc?: any, _unusedCb?: any) { return this as unknown as MockResponse; },
        get statusCode() { return resData.statusCode; },
        set statusCode(c: number) { resData.statusCode = c; },
        get body() { return resData.body; },
        set body(b: any) { resData.body = b; },
        status: function(code: number) { resData.statusCode = code; return this as unknown as MockResponse; },
        json: function(data: any) { resData.body = data; return this as unknown as MockResponse; },
        send: function(data: any) { resData.body = data; return this as unknown as MockResponse; },
        setHeader: function(name: string, value: string) { (this as any).headers[name] = value; return this as unknown as MockResponse; }
    });
    return res;
}
