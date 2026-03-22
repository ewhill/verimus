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
        downloadFile: vi.fn().mockResolvedValue()
    }
}));

import { useStore } from '../../../../src/store';
import { ApiService } from '../../../../src/services/api';

describe('Frontend: FileGrid', () => {
    let mockDispatch;

        beforeEach(() => {
        mockDispatch = vi.fn();
        useStore.mockImplementation(selector => selector({ dispatch: mockDispatch }));
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

    it('Validates individual files map API download endpoints smoothly', () => {
        const items = [
            { type: 'file', displayName: 'img.png', file: { path: 'img.png', versions: [{ blockHash: '123' }] } },
            { type: 'file', displayName: 'vid.mp4', file: { path: 'vid.mp4', versions: [{ blockHash: '2' }] } },
            { type: 'file', displayName: 'aud.mp3', file: { path: 'aud.mp3', versions: [{ blockHash: '3' }] } },
            { type: 'file', displayName: 'doc.txt', file: { path: 'doc.txt', versions: [{ blockHash: '4' }] } }
        ];

        render(<FileGrid displayItems={items} />);
        
        const doc = screen.getByText('doc.txt').parentElement.querySelector('.click-to-download');
        fireEvent.click(doc); // Downloads
        
        expect(ApiService.downloadFile).toHaveBeenCalledWith('/api/download/4/file/doc.txt', 'doc.txt');
    });

    it('Highlights selection of individual file rows upon user click', () => {
        const items = [
            { type: 'file', displayName: 'multi.txt', file: { path: 'f.txt', versions: [
                { blockHash: 'v1', timestamp: 0, index: 1 },
                { blockHash: 'v2', timestamp: 1, index: 2 }
            ]}}
        ];

        const { container } = render(<FileGrid displayItems={items} />);
        
        const btn = screen.getByText('2'); // Version badge
        fireEvent.click(btn); // Open Dropdown
        
        expect(screen.getByText('Previous Versions')).toBeInTheDocument();

        // Click download from dropdown
        const getBtns = screen.getAllByText('Get');
        fireEvent.click(getBtns[0]);
        expect(ApiService.downloadFile).toHaveBeenCalledWith('/api/download/v1/file/f.txt', 'f.txt');
        
        // global grid click removes open
        const wrap = container.querySelector('.files-grid-wrap');
        fireEvent.click(wrap);
        expect(screen.queryByText('Previous Versions')).not.toBeInTheDocument();
    });
});
