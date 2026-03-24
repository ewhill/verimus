import { Message } from '../../p2p';
import { MessageOptions } from '../types/Types';

export interface StorageBidOptions {
    storageRequestId: string;
    storageHostId: string;
    proposedCostPerGB: number;
    guaranteedUptimeMs: number;
}

export class StorageBidMessage extends Message {
    constructor(options: MessageOptions<StorageBidOptions> = {}) {
        super(options);
        if (options.storageRequestId !== undefined) this.storageRequestId = options.storageRequestId;
        else if (options.body?.storageRequestId !== undefined) this.storageRequestId = options.body.storageRequestId;

        if (options.storageHostId !== undefined) this.storageHostId = options.storageHostId;
        else if (options.body?.storageHostId !== undefined) this.storageHostId = options.body.storageHostId;

        if (options.proposedCostPerGB !== undefined) this.proposedCostPerGB = options.proposedCostPerGB;
        else if (options.body?.proposedCostPerGB !== undefined) this.proposedCostPerGB = options.body.proposedCostPerGB;

        if (options.guaranteedUptimeMs !== undefined) this.guaranteedUptimeMs = options.guaranteedUptimeMs;
        else if (options.body?.guaranteedUptimeMs !== undefined) this.guaranteedUptimeMs = options.body.guaranteedUptimeMs;
    }

    get storageRequestId(): string { return this.body.storageRequestId; }
    set storageRequestId(value: string) { this.body = { ...this.body, storageRequestId: value }; }

    get storageHostId(): string { return this.body.storageHostId; }
    set storageHostId(value: string) { this.body = { ...this.body, storageHostId: value }; }

    get proposedCostPerGB(): number { return this.body.proposedCostPerGB; }
    set proposedCostPerGB(value: number) { this.body = { ...this.body, proposedCostPerGB: value }; }

    get guaranteedUptimeMs(): number { return this.body.guaranteedUptimeMs; }
    set guaranteedUptimeMs(value: number) { this.body = { ...this.body, guaranteedUptimeMs: value }; }
}
