// Mock Bundler mapped explicitly via dynamic object structural definitions

export class MockBundler {
    dataDir: string = 'mockDataDir';
    async bundle(_unusedFiles: string[]): Promise<string> { return 'mock_bundle'; }
    createBlockBundle(..._unusedArgs: any[]): { blockData: string; aesKey: string; aesIv: string; files: { path: string; contentHash: string; }[]; } | null { return { blockData: '', aesKey: '', aesIv: '', files: [] }; }
    async streamBlockBundle(..._unusedArgs: any[]): Promise<{ aesKey: string, aesIv: string, authTag: string, files: { path: string; contentHash: string; }[] } | null> { return null; }
    async streamErasureBundle(..._unusedArgs: any[]): Promise<{ aesKey: string, aesIv: string, authTag: string, files: { path: string; contentHash: string; }[], shards: Buffer[], originalSize: number } | null> { return null; }
}
