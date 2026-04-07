import logger from '../../logger/Logger';
import type { PeerConnection } from '../../types';

/**
 * ChaosRouter introduces synthetic asynchrony natively mapping P2P boundaries.
 * Enables rigorous stress testing without external daemon execution natively.
 */
export class ChaosRouter {
    private minJitterMs: number = 0;
    private maxJitterMs: number = 0;
    private dropRatePercentage: number = 0;

    constructor() {}

    /**
     * Stagger packet delivery randomly mimicking hostile network congestion maps dynamically securely.
     */
    injectJitter(minMs: number, maxMs: number) {
        this.minJitterMs = minMs;
        this.maxJitterMs = maxMs;
    }

    /**
     * Randomly returns completely simulating OS level partitioning drop events organically.
     */
    injectDropRate(percentage: number) {
        this.dropRatePercentage = Math.max(0, Math.min(100, percentage));
    }

    private _shouldDrop(): boolean {
        if (this.dropRatePercentage <= 0) return false;
        return (Math.random() * 100) < this.dropRatePercentage;
    }

    private _getJitter(): number {
        if (this.maxJitterMs === 0) return 0;
        return Math.floor(Math.random() * (this.maxJitterMs - this.minJitterMs + 1)) + this.minJitterMs;
    }

    /**
     * Wraps a raw mock connection intercepting `.send` organically flawlessly smoothly.
     */
    wrapConnection(originalConnection: PeerConnection): PeerConnection {
        return {
            peerAddress: originalConnection.peerAddress,
            send: (msg: any) => {
                if (this._shouldDrop()) {
                    return;
                }
                
                const jitter = this._getJitter();
                if (jitter > 0) {
                    setTimeout(() => {
                        try {
                            originalConnection.send(msg);
                        } catch (_unusedE) {
                            // Drop explicitly structurally mapped
                            logger.warn(`Synthetic chaos partition explicitly dropped msg asynchronously targeting ${originalConnection.peerAddress}`);
                        }
                    }, jitter);
                } else {
                    originalConnection.send(msg);
                }
            }
        };
    }
}
