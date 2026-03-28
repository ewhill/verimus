export const createMock = <T>(shape: Partial<T> = {} as Partial<T>): T => shape as T;
