import { Message } from 'ringnet';
import { Block } from '../../types';
import { MessageOptions } from '../types/Types';

export interface PendingBlockOptions {
    block: Block;
}

export class PendingBlockMessage extends Message {
    
    declare body: any;

    constructor(options: MessageOptions<PendingBlockOptions> = {}) {
        super(options);
        if (options.block !== undefined) this.block = options.block;
        else if (options.body?.block !== undefined) this.block = options.body.block;
    }
    get block(): Block { return this.body.block; }
    set block(value: Block) { this.body = { ...this.body, block: value }; }
}
