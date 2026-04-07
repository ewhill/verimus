class KeyedMutex {
    private chains: Map<string, Promise<void>> = new Map();

    async acquire(key: string): Promise<() => void> {
        let release!: () => void;
        const currentLock = new Promise<void>((resolve) => {
            release = resolve;
        });

        const previousLock = this.chains.get(key);

        const newChain = (previousLock || Promise.resolve()).then(() => currentLock);
        this.chains.set(key, newChain);

        if (previousLock) {
            await previousLock;
        }

        return () => {
            if (this.chains.get(key) === newChain) {
                this.chains.delete(key);
            }
            release();
        };
    }
}

export default KeyedMutex;
