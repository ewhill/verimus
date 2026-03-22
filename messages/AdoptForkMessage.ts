import { Message } from 'ringnet';
import { MessageOptions } from './types';

export interface AdoptForkOptions {
    forkId: string;
    finalTipHash: string;
}

export class AdoptForkMessage extends Message {
    constructor(options: MessageOptions<AdoptForkOptions> = {}) {
        super(options);
        if (options.forkId !== undefined) this.forkId = options.forkId;
        else if (options.body?.forkId !== undefined) this.forkId = options.body.forkId;
        
        if (options.finalTipHash !== undefined) this.finalTipHash = options.finalTipHash;
        else if (options.body?.finalTipHash !== undefined) this.finalTipHash = options.body.finalTipHash;
    }
    get forkId(): string { return this.body.forkId; }
    set forkId(value: string) { this.body = { ...this.body, forkId: value }; }
    get finalTipHash(): string { return this.body.finalTipHash; }
    set finalTipHash(value: string) { this.body = { ...this.body, finalTipHash: value }; }
}
