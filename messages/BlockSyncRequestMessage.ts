import { Message } from 'ringnet';
import { MessageOptions } from './types';

export interface BlockSyncRequestOptions {
    index: number;
}

export class BlockSyncRequestMessage extends Message {
    constructor(options: MessageOptions<BlockSyncRequestOptions> = {}) {
        super(options);
        if (options.index !== undefined) this.index = options.index;
        else if (options.body?.index !== undefined) this.index = options.body.index;
    }
    get index(): number { return this.body.index; }
    set index(value: number) { this.body = { ...this.body, index: value }; }
}
