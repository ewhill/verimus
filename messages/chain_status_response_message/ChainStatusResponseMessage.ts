import { Message } from 'ringnet';
import { MessageOptions } from '../types/Types';

export interface ChainStatusResponseOptions {
    latestIndex: number;
    latestHash: string;
}

export class ChainStatusResponseMessage extends Message {
    
    declare body: any;

    constructor(options: MessageOptions<ChainStatusResponseOptions> = {}) {
        super(options);
        if (options.latestIndex !== undefined) this.latestIndex = options.latestIndex;
        else if (options.body?.latestIndex !== undefined) this.latestIndex = options.body.latestIndex;
        
        if (options.latestHash !== undefined) this.latestHash = options.latestHash;
        else if (options.body?.latestHash !== undefined) this.latestHash = options.body.latestHash;
    }
    get latestIndex(): number { return this.body.latestIndex; }
    set latestIndex(value: number) { this.body = { ...this.body, latestIndex: value }; }
    get latestHash(): string { return this.body.latestHash; }
    set latestHash(value: string) { this.body = { ...this.body, latestHash: value }; }
}
