
export class MockAwsClient<T = any> {
    private _data: T[] = [];
    constructor(data: T[] = []) { this._data = data; }
    config: any;
    destroy(): void {}
    middlewareStack: any;
    initConfig: any;
    handlers: any;
    async send(..._unusedArgs: any[]): Promise<any> { return {}; }
}
