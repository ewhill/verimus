import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiService } from './api';

describe('ApiService', () => {
    let mockDispatch;

    beforeEach(() => {
        mockDispatch = vi.fn();
        global.fetch = vi.fn();
    });

    describe('fetchBlocks', () => {
        it('Constructs correct query params and dispatches success', async () => {
            const mockResponse = {
                success: true,
                blocks: [{ id: 1 }],
                pagination: { total: 1 }
            };
            
            global.fetch.mockResolvedValue({
                json: vi.fn().mockResolvedValue(mockResponse)
            });

            const state = {
                pagination: { page: 2, limit: 10 },
                searchQuery: 'test+hash ',
                filterOwn: true,
                ledgerSortMode: 'asc'
            };

            await ApiService.fetchBlocks(state, mockDispatch);
            
            expect(global.fetch).toHaveBeenCalledWith('/api/blocks?page=2&limit=10&q=test%2Bhash%20&own=true&sort=asc');
            expect(mockDispatch).toHaveBeenCalledWith({
                type: 'SET_BLOCKS',
                payload: { blocks: mockResponse.blocks, pagination: mockResponse.pagination }
            });
            expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_ERROR', payload: null });
        });

        it('Handles fetch crash and dispatches Connection lost', async () => {
            global.fetch.mockRejectedValue(new Error('Network failure'));
            
            const state = {}; // Should fallback to defaults
            
            await ApiService.fetchBlocks(state, mockDispatch);
            
            expect(global.fetch).toHaveBeenCalledWith('/api/blocks?page=1&limit=16&q=&own=false&sort=desc');
            expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_ERROR', payload: 'Connection lost' });
            expect(mockDispatch).not.toHaveBeenCalledWith({ type: 'SET_BLOCKS', payload: expect.anything() });
        });
        
        it('Handles 500 error body gracefully', async () => {
            const mockResponse = {
                success: false,
                message: 'Internal Server Error'
            };
            
            // fetch doesn't throw on 500 automatically, it returns response
            global.fetch.mockResolvedValue({
                json: vi.fn().mockResolvedValue(mockResponse)
            });
            
            // Note: The current api.js doesn't specifically handle `success: false` internally by dispatching an error.
            // It silently passes or logs. Wait, let's verify if `success: false` triggers dispatch.
            // The logic: if (data.success) { dispatch(...) }
            // So on 500, it just doesn't dispatch SET_BLOCKS.
            
            await ApiService.fetchBlocks({}, mockDispatch);
            
            expect(mockDispatch).not.toHaveBeenCalledWith({ type: 'SET_BLOCKS', payload: expect.anything() });
            expect(mockDispatch).not.toHaveBeenCalledWith({ type: 'SET_ERROR', payload: 'Connection lost' });
        });
    });

    describe('fetchFiles', () => {
        it('Dispatches successful files map', async () => {
            const mockResponse = { success: true, files: ['a'] };
            global.fetch.mockResolvedValue({ json: vi.fn().mockResolvedValue(mockResponse) });

            await ApiService.fetchFiles(mockDispatch);
            
            expect(global.fetch).toHaveBeenCalledWith('/api/files');
            expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_FILES_MAP', payload: ['a'] });
        });

        it('Dispatches error on rejection', async () => {
            global.fetch.mockRejectedValue(new Error('Crash'));
            await ApiService.fetchFiles(mockDispatch);
            expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_ERROR', payload: 'Connection lost' });
        });
    });

    describe('fetchNodeConfig', () => {
        it('Dispatches successful node config', async () => {
            const mockResponse = { success: true, config: 'x' };
            global.fetch.mockResolvedValue({ json: vi.fn().mockResolvedValue(mockResponse) });

            await ApiService.fetchNodeConfig(mockDispatch);
            
            expect(global.fetch).toHaveBeenCalledWith('/api/node/config');
            expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_NODE_CONFIG', payload: mockResponse });
        });

        it('Dispatches error on rejection', async () => {
            global.fetch.mockRejectedValue(new Error('Crash'));
            await ApiService.fetchNodeConfig(mockDispatch);
            expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_ERROR', payload: 'Connection lost' });
        });
    });

    describe('fetchPrivatePayload', () => {
        it('Returns JSON API responses', async () => {
            const mockResponse = { success: true, payload: 'base64' };
            global.fetch.mockResolvedValue({ json: vi.fn().mockResolvedValue(mockResponse) });

            const result = await ApiService.fetchPrivatePayload('hash123');
            
            expect(global.fetch).toHaveBeenCalledWith('/api/blocks/hash123/private');
            expect(result).toEqual(mockResponse);
        });

        it('Returns failure on API request crashes', async () => {
            global.fetch.mockRejectedValue(new Error('Crash'));
            const result = await ApiService.fetchPrivatePayload('hash123');
            expect(result).toEqual({ success: false });
        });
    });
});
