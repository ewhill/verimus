import { Message } from 'ringnet';
import type { Block } from '../../types';
import { MessageOptions } from '../types/Types';

export interface BlockSyncResponseOptions {
    block: Block;
}

export class BlockSyncResponseMessage extends Message {
    
    declare body: any;

    constructor(options: MessageOptions<BlockSyncResponseOptions> = {}) {
        super(options);
        if (options.block !== undefined) this.block = options.block;
        else if (options.body?.block !== undefined) this.block = options.body.block;
    }
    get block(): Block { return this.body.block; }
    set block(value: Block) { this.body = { ...this.body, block: value }; }
}
