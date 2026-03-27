
export class MockMongoClient<T = any> {
    private _data: T[] = [];
    constructor(data: T[] = []) { this._data = data; }
    options: any;
    driverInfoList: any;
    appendMetadata(..._unusedArgs: any[]): any { throw new Error('Method not implemented: appendMetadata'); }
    serverApi: any;
    readConcern: any;
    writeConcern: any;
    readPreference: any;
    bsonOptions: any;
    timeoutMS: any;
    bulkWrite(..._unusedArgs: any[]): any { throw new Error('Method not implemented: bulkWrite'); }
    async connect(..._unusedArgs: any[]): Promise<any> { return this; }
    async close(..._unusedArgs: any[]): Promise<void> {}
    _close: any;
    db(..._unusedArgs: any[]): any { throw new Error('Method not implemented: db'); }
    startSession(..._unusedArgs: any[]): any { throw new Error('Method not implemented: startSession'); }
    withSession(..._unusedArgs: any[]): any { throw new Error('Method not implemented: withSession'); }
    watch(..._unusedArgs: any[]): any { throw new Error('Method not implemented: watch'); }
    [Symbol.asyncDispose]() { return Promise.resolve(); }
    addListener(..._unusedArgs: any[]): any { throw new Error('Method not implemented: addListener'); }
    on(..._unusedArgs: any[]): any { throw new Error('Method not implemented: on'); }
    once(..._unusedArgs: any[]): any { throw new Error('Method not implemented: once'); }
    removeListener(..._unusedArgs: any[]): any { throw new Error('Method not implemented: removeListener'); }
    off(..._unusedArgs: any[]): any { throw new Error('Method not implemented: off'); }
    removeAllListeners(..._unusedArgs: any[]): any { throw new Error('Method not implemented: removeAllListeners'); }
    listeners(..._unusedArgs: any[]): any { throw new Error('Method not implemented: listeners'); }
    rawListeners(..._unusedArgs: any[]): any { throw new Error('Method not implemented: rawListeners'); }
    emit(..._unusedArgs: any[]): any { throw new Error('Method not implemented: emit'); }
    listenerCount(..._unusedArgs: any[]): any { throw new Error('Method not implemented: listenerCount'); }
    prependListener(..._unusedArgs: any[]): any { throw new Error('Method not implemented: prependListener'); }
    prependOnceListener(..._unusedArgs: any[]): any { throw new Error('Method not implemented: prependOnceListener'); }
    eventNames(..._unusedArgs: any[]): any { throw new Error('Method not implemented: eventNames'); }
    getMaxListeners(..._unusedArgs: any[]): any { throw new Error('Method not implemented: getMaxListeners'); }
    setMaxListeners(..._unusedArgs: any[]): any { throw new Error('Method not implemented: setMaxListeners'); }
}
