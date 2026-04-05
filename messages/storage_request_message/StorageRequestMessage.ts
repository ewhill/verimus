import { Message } from '../../p2p';
import { MessageOptions } from '../types/Types';

export interface StorageRequestOptions {
    storageRequestId: string;
    fileSizeBytes: number;
    chunkSizeBytes: number;
    requiredNodes: number;
    maxCostPerGB: number;
    senderAddress: string;
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

        if (options.senderAddress !== undefined) this.senderAddress = options.senderAddress;
        else if (options.body?.senderAddress !== undefined) this.senderAddress = options.body.senderAddress;
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

    get senderAddress(): string { return this.body.senderAddress; }
    set senderAddress(value: string) { this.body = { ...this.body, senderAddress: value }; }
}
