
export class MockSmbClient<T = any> {
    private _data: T[] = [];
    constructor(data: T[] = []) { this._data = data; }
    writeFile(..._args: any[]): void { _args[_args.length - 1](null); }
    readFile(..._args: any[]): void { _args[_args.length - 1](null, Buffer.from('data')); }
}
