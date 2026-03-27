export function createMongoCursorStub(dataArray: any[]) {
    const cursor = {
        sort: () => cursor,
        limit: () => cursor,
        skip: () => cursor,
        toArray: async () => dataArray
    };
    return cursor;
}

export function createMock<T>(partial: Partial<T> = {}): T {
    return partial as T;
}
