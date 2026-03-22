import { Message } from 'ringnet';
import { MessageOptions } from '../types/Types';

export interface ProposeForkOptions {
    forkId: string;
    blockIds: string[];
}

export class ProposeForkMessage extends Message {
    
    declare body: any;

    constructor(options: MessageOptions<ProposeForkOptions> = {}) {
        super(options);
        if (options.forkId !== undefined) this.forkId = options.forkId;
        else if (options.body?.forkId !== undefined) this.forkId = options.body.forkId;
        
        if (options.blockIds !== undefined) this.blockIds = options.blockIds;
        else if (options.body?.blockIds !== undefined) this.blockIds = options.body.blockIds;
    }
    get forkId(): string { return this.body.forkId; }
    set forkId(value: string) { this.body = { ...this.body, forkId: value }; }
    get blockIds(): string[] { return this.body.blockIds; }
    set blockIds(value: string[]) { this.body = { ...this.body, blockIds: value }; }
}
