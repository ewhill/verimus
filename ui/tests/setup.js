import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Default fetch mock so it does not crash on unhandled fetch
global.fetch = vi.fn(() => Promise.resolve({
    json: () => Promise.resolve({})
}));
