import type { Block } from '../../types';

export class MockMempool {
    pendingBlocks: Map<string, Block> = new Map();

    addBlock(_unusedBlock: Block): void {
        this.pendingBlocks.set(_unusedBlock.hash || 'mock', _unusedBlock);
    }

    removeBlock(_unusedHash: string): void {
        this.pendingBlocks.delete(_unusedHash);
    }
}
