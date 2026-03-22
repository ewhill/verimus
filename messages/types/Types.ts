export type NetworkPayload<T> = { body?: Partial<T>; header?: any };
export type MessageOptions<T> = Partial<T> & NetworkPayload<T>;
