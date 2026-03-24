import { Message } from '../../p2p';
import { MessageOptions } from '../types/Types';

export interface StorageRequestOptions {
    storageRequestId: string;
    fileSizeBytes: number;
    chunkSizeBytes: number;
    requiredNodes: number;
    maxCostPerGB: number;
    senderId: string;
}

export class StorageRequestMessage extends Message {
    constructor(options: MessageOptions<StorageRequestOptions> = {}) {
        super(options);
        if (options.storageRequestId !== undefined) this.storageRequestId = options.storageRequestId;
        else if (options.body?.storageRequestId !== undefined) this.storageRequestId = options.body.storageRequestId;

        if (options.fileSizeBytes !== undefined) this.fileSizeBytes = options.fileSizeBytes;
        else if (options.body?.fileSizeBytes !== undefined) this.fileSizeBytes = options.body.fileSizeBytes;

        if (options.chunkSizeBytes !== undefined) this.chunkSizeBytes = options.chunkSizeBytes;
        else if (options.body?.chunkSizeBytes !== undefined) this.chunkSizeBytes = options.body.chunkSizeBytes;

        if (options.requiredNodes !== undefined) this.requiredNodes = options.requiredNodes;
        else if (options.body?.requiredNodes !== undefined) this.requiredNodes = options.body.requiredNodes;

        if (options.maxCostPerGB !== undefined) this.maxCostPerGB = options.maxCostPerGB;
        else if (options.body?.maxCostPerGB !== undefined) this.maxCostPerGB = options.body.maxCostPerGB;

        if (options.senderId !== undefined) this.senderId = options.senderId;
        else if (options.body?.senderId !== undefined) this.senderId = options.body.senderId;
    }

    get storageRequestId(): string { return this.body.storageRequestId; }
    set storageRequestId(value: string) { this.body = { ...this.body, storageRequestId: value }; }

    get fileSizeBytes(): number { return this.body.fileSizeBytes; }
    set fileSizeBytes(value: number) { this.body = { ...this.body, fileSizeBytes: value }; }

    get chunkSizeBytes(): number { return this.body.chunkSizeBytes; }
    set chunkSizeBytes(value: number) { this.body = { ...this.body, chunkSizeBytes: value }; }

    get requiredNodes(): number { return this.body.requiredNodes; }
    set requiredNodes(value: number) { this.body = { ...this.body, requiredNodes: value }; }

    get maxCostPerGB(): number { return this.body.maxCostPerGB; }
    set maxCostPerGB(value: number) { this.body = { ...this.body, maxCostPerGB: value }; }

    get senderId(): string { return this.body.senderId; }
    set senderId(value: string) { this.body = { ...this.body, senderId: value }; }
}
