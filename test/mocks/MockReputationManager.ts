import { EventEmitter } from 'events';

import type { Collection } from 'mongodb';

import type { PeerReputation } from '../../types';

export class MockReputationManager extends EventEmitter {
    peersCollection: Collection<PeerReputation> | null = null;
    
    constructor() {
        super();
    }

    async isBanned(_unusedPublicKey: string): Promise<boolean> {
        return false;
    }

    async slash(_unusedPublicKey: string, _unusedAmount: number, _unusedReason: string): Promise<void> {}

    async reward(_unusedPublicKey: string, _unusedAmount: number): Promise<void> {}
}
