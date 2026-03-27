import { EventEmitter } from 'events';

export class MockPeer extends EventEmitter {
    trustedPeers: any[] = [];
    peers: any[] = [];
    wsServer: any = null;

    async init(): Promise<void> {}
    async discover(): Promise<void> {}
    async close(): Promise<void> {}
    async broadcast(_unusedType: string, _unusedPayload: any): Promise<void> {}
    bind(_unusedMsg: { name: string } | string | Function): { to: (cb: Function) => void } { return { to: () => {} }; }
}
