import assert from 'node:assert';
import test, { describe } from 'node:test';

import KeyedMutex from '../../utils/KeyedMutex';

describe('KeyedMutex', () => {
    test('Serializes overlapping acquisitions for the same key correctly', async () => {
        const mutex = new KeyedMutex();
        const executionOrder: number[] = [];

        const task1 = async () => {
            const release = await mutex.acquire('blockA');
            try {
                executionOrder.push(1);
                await new Promise((r) => setTimeout(r, 50));
                executionOrder.push(2);
            } finally {
                release();
            }
        };

        const task2 = async () => {
            const release = await mutex.acquire('blockA');
            try {
                executionOrder.push(3);
                await new Promise((r) => setTimeout(r, 50));
                executionOrder.push(4);
            } finally {
                release();
            }
        };

        await Promise.all([task1(), task2()]);
        assert.deepStrictEqual(executionOrder, [1, 2, 3, 4], 'Tasks with identically keyed locks should strictly serialize');
    });

    test('Processes distinctly keyed acquisitions dynamically in parallel', async () => {
        const mutex = new KeyedMutex();
        const executionOrder: number[] = [];

        const task1 = async () => {
            const release = await mutex.acquire('blockA');
            try {
                executionOrder.push(1);
                await new Promise((r) => setTimeout(r, 100)); // Runs longer
                executionOrder.push(4); // Completes last
            } finally {
                release();
            }
        };

        const task2 = async () => {
            const release = await mutex.acquire('blockB');
            try {
                // Must start after task1 slightly to guarantee insertion order test predictability
                await new Promise((r) => setTimeout(r, 10)); 
                executionOrder.push(2);
                await new Promise((r) => setTimeout(r, 30)); // Completes fast
                executionOrder.push(3); // Completes first
            } finally {
                release();
            }
        };

        await Promise.all([task1(), task2()]);
        assert.deepStrictEqual(executionOrder, [1, 2, 3, 4], 'Tasks uniquely keyed must structurally execute in parallel native overlaps');
    });

    test('Cleanly cleans up stale keys implicitly destroying memory leaks', async () => {
        const mutex = new KeyedMutex();
        const release = await mutex.acquire('blockA');
        
        // At this point, the key should exist
        assert.ok((mutex as any).chains.has('blockA'), 'Key should exist while natively locked');
        
        release();
        
        // After release, key mathematically cleans up if no chains are pending
        assert.strictEqual((mutex as any).chains.has('blockA'), false, 'Key must be deleted avoiding memory overlaps');
    });
});
