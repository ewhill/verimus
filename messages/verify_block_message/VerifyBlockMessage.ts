import { Message } from 'ringnet';
import { MessageOptions } from '../types/Types';

export interface VerifyBlockOptions {
    blockId: string;
    signature: string;
}

export class VerifyBlockMessage extends Message {
    
    declare body: any;

    constructor(options: MessageOptions<VerifyBlockOptions> = {}) {
        super(options);
        if (options.blockId !== undefined) this.blockId = options.blockId;
        else if (options.body?.blockId !== undefined) this.blockId = options.body.blockId;
        
        if (options.signature !== undefined) this.signature = options.signature;
        else if (options.body?.signature !== undefined) this.signature = options.body.signature;
    }
    get blockId(): string { return this.body.blockId; }
    set blockId(value: string) { this.body = { ...this.body, blockId: value }; }
    get signature(): string { return this.body.signature; }
    set signature(value: string) { this.body = { ...this.body, signature: value }; }
}
