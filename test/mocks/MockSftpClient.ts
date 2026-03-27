
export class MockSftpClient<T = any> {
    private _data: T[] = [];
    constructor(data: T[] = []) { this._data = data; }
    async connect(..._unusedArgs: any[]): Promise<any> { return this; }
    async list(..._unusedArgs: any[]): Promise<any> { return []; }
    exists(..._unusedArgs: any[]): any { throw new Error('Method not implemented: exists'); }
    stat(..._unusedArgs: any[]): any { throw new Error('Method not implemented: stat'); }
    realPath(..._unusedArgs: any[]): any { throw new Error('Method not implemented: realPath'); }
    async get(..._unusedArgs: any[]): Promise<any> { return Buffer.from('data'); }
    fastGet(..._unusedArgs: any[]): any { throw new Error('Method not implemented: fastGet'); }
    async put(..._unusedArgs: any[]): Promise<any> { return 'uploaded'; }
    fastPut(..._unusedArgs: any[]): any { throw new Error('Method not implemented: fastPut'); }
    cwd(..._unusedArgs: any[]): any { throw new Error('Method not implemented: cwd'); }
    mkdir(..._unusedArgs: any[]): any { throw new Error('Method not implemented: mkdir'); }
    rmdir(..._unusedArgs: any[]): any { throw new Error('Method not implemented: rmdir'); }
    delete(..._unusedArgs: any[]): any { throw new Error('Method not implemented: delete'); }
    rename(..._unusedArgs: any[]): any { throw new Error('Method not implemented: rename'); }
    chmod(..._unusedArgs: any[]): any { throw new Error('Method not implemented: chmod'); }
    append(..._unusedArgs: any[]): any { throw new Error('Method not implemented: append'); }
    uploadDir(..._unusedArgs: any[]): any { throw new Error('Method not implemented: uploadDir'); }
    downloadDir(..._unusedArgs: any[]): any { throw new Error('Method not implemented: downloadDir'); }
    async end(): Promise<void> {}
    on(..._unusedArgs: any[]): any { throw new Error('Method not implemented: on'); }
    removeListener(..._unusedArgs: any[]): any { throw new Error('Method not implemented: removeListener'); }
    posixRename(..._unusedArgs: any[]): any { throw new Error('Method not implemented: posixRename'); }
    rcopy(..._unusedArgs: any[]): any { throw new Error('Method not implemented: rcopy'); }
    createReadStream(..._unusedArgs: any[]): any { throw new Error('Method not implemented: createReadStream'); }
    createWriteStream(..._unusedArgs: any[]): any { throw new Error('Method not implemented: createWriteStream'); }
}
