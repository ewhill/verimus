import '@testing-library/jest-dom';
/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FileGrid from '../../../../src/components/Views/FilesView/FileGrid.jsx';

vi.mock('../../../../src/store', () => ({
    useStore: vi.fn(selector => selector({ dispatch: vi.fn() }))
}));

vi.mock('../../../../src/services/api', () => ({
    ApiService: {
        fetchPrivatePayload: vi.fn().mockResolvedValue({ success: false })
    }
}));

vi.mock('../../../../src/utils/web3', () => ({
    generateDownloadAuthHeaders: vi.fn().mockResolvedValue({ 'x-web3-address': '0x123' }),
    decryptAESCore: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]))
}));

import { useStore } from '../../../../src/store';
import { ApiService } from '../../../../src/services/api';

describe('Frontend: FileGrid', () => {
    let mockDispatch;

        beforeEach(() => {
        mockDispatch = vi.fn();
        useStore.mockImplementation(selector => selector({ dispatch: mockDispatch, web3Account: '0x32A8eE04236f56d2c48223Ce4742F3A1DC6936BD' }));
        vi.clearAllMocks();
    });

    it('Displays correct fallback UI text when zero files map to the current active path', () => {
        render(<FileGrid displayItems={[]} />);
        expect(screen.getByText('No files or folders matched your criteria.')).toBeInTheDocument();
    });

    it('Correctly calculates and drills down virtual folder contents upon double click', () => {
        const items = [
            { type: 'folder', name: 'myFolder', path: ['myFolder'] }
        ];
        render(<FileGrid displayItems={items} />);
        
        const f = screen.getByText('myFolder');
        fireEvent.click(f);
        expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_FILES_PATH', payload: ['myFolder'] });
    });

    it('Validates individual files map API download endpoints smoothly', async () => {
        const items = [
            { type: 'file', displayName: 'img.png', file: { path: 'img.png', versions: [{ blockHash: '123' }] } },
            { type: 'file', displayName: 'vid.mp4', file: { path: 'vid.mp4', versions: [{ blockHash: '2' }] } },
            { type: 'file', displayName: 'aud.mp3', file: { path: 'aud.mp3', versions: [{ blockHash: '3' }] } },
            { type: 'file', displayName: 'doc.txt', file: { path: 'doc.txt', versions: [{ blockHash: '4' }] } }
        ];

        render(<FileGrid displayItems={items} />);
        
        const docIcon = screen.getByText('doc.txt').parentElement.querySelector('.click-to-download');
        fireEvent.click(docIcon); // Open Dropdown
        
        const decryptBtn = screen.getByText('Decrypt File');
        fireEvent.click(decryptBtn); // Call fetchPrivatePayload
        
        await waitFor(() => {
            expect(ApiService.fetchPrivatePayload).toHaveBeenCalledWith('4', {"x-web3-address": "0x123"});
        });
    });

    it('Highlights selection of individual file rows upon user click', async () => {
        const items = [
            { type: 'file', displayName: 'multi.txt', file: { path: 'f.txt', versions: [
                { blockHash: 'v1', timestamp: 0, index: 1 },
                { blockHash: 'v2', timestamp: 1, index: 2 }
            ]}}
        ];

        const { container } = render(<FileGrid displayItems={items} />);
        
        const itemName = screen.getByText('multi.txt'); 
        fireEvent.click(itemName); // Open Dropdown
        
        expect(screen.getByText('Previous Revisions')).toBeInTheDocument();

        // Click download from dropdown
        const getBtns = screen.getAllByText('Get');
        fireEvent.click(getBtns[0]);
        
        await waitFor(() => {
            expect(ApiService.fetchPrivatePayload).toHaveBeenCalledWith('v2', {"x-web3-address": "0x123"});
        });
        
        // global grid click removes open
        const wrap = container.querySelector('.files-grid-wrap');
        fireEvent.click(wrap);
        expect(screen.queryByText('Previous Revisions')).not.toBeInTheDocument();
    });
});
