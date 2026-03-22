import { Message } from 'ringnet';
import { MessageOptions } from '../types/Types';

export interface ScorePayload {
    publicKey: string;
    score: number;
}

export interface NetworkHealthSyncOptions {
    score_payloads: ScorePayload[];
}

export class NetworkHealthSyncMessage extends Message {
    
    declare body: any;

    constructor(options: MessageOptions<NetworkHealthSyncOptions> = {}) {
        super(options);
        if (options.score_payloads !== undefined) this.score_payloads = options.score_payloads;
        else if (options.body?.score_payloads !== undefined) this.score_payloads = options.body.score_payloads;
    }
    
    get score_payloads(): ScorePayload[] { return this.body.score_payloads || []; }
    set score_payloads(value: ScorePayload[]) { this.body = { ...this.body, score_payloads: value }; }
}
