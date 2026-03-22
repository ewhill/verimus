import '@testing-library/jest-dom';
/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FilesView from '../../../../src/components/Views/FilesView/FilesView.jsx';
import { ApiService } from '../../../../src/services/api';

vi.mock('../../../../src/store', () => ({
    useStore: vi.fn()
}));
vi.mock('../../../../src/services/api', () => ({
    ApiService: { fetchFiles: vi.fn() }
}));

import { useStore } from '../../../../src/store';

describe('Frontend: FilesView', () => {
    let mockDispatch;

    const filesMap = [
        { path: 'abc.txt', location: { id: 'loc1', type: 'local', label: 'Local Store' }, versions: [{blockHash:'abc1', timestamp:0, index:1}] },
        { path: 'folder/xyz.txt', location: { id: 'loc1', type: 'local', label: 'Local Store' }, versions: [{blockHash:'xyz1', timestamp:0, index:2}] },
        { path: 'test.dmg', location: { type: 'unknown' }, versions: [{blockHash:'tst1', timestamp:0, index:3}] },
    ];

    beforeEach(() => {
        mockDispatch = vi.fn();
        ApiService.fetchFiles.mockClear();
    });

    it('Fetches the initial file structure list and maps it to UI components correctly', () => {
        useStore.mockImplementation(selector => selector({
            dispatch: mockDispatch,
            filesMap: [],
            filesSearchQuery: '',
            filesLocationFilter: 'all',
            filesSelectedPath: []
        }));
        
        render(<FilesView />);
        expect(ApiService.fetchFiles).toHaveBeenCalledWith(mockDispatch);
        expect(screen.getByText('All Files')).toBeInTheDocument();
    });

    it('Filters displayed files by exact search query string from Header dynamically', () => {
        useStore.mockImplementation(selector => selector({
            dispatch: mockDispatch,
            filesMap,
            filesSearchQuery: 'xyz',
            filesLocationFilter: 'loc1',
            filesSelectedPath: []
        }));
        
        render(<FilesView />);
        
        // loc1 filter shows Local Store
        expect(screen.getAllByText('Local Store')[0]).toBeInTheDocument();
        expect(screen.getByText('1 item(s)')).toBeInTheDocument();
        expect(screen.getByTitle('folder/xyz.txt')).toBeInTheDocument();
    });

    it('Conditionally lists unallocated files within Unknown Sources container filter', () => {
        useStore.mockImplementation(selector => selector({
            dispatch: mockDispatch,
            filesMap,
            filesSearchQuery: 'test.dmg',
            filesLocationFilter: 'unknown',
            filesSelectedPath: []
        }));
        
        render(<FilesView />);
        expect(screen.getAllByText('Unknown Sources').length).toBeGreaterThan(0);
        expect(screen.getByText('1 item(s)')).toBeInTheDocument();
    });

    it('Navigates accurately across virtual directory depths when browsing', () => {
        // We select loc1 and path ['folder']
        useStore.mockImplementation(selector => selector({
            dispatch: mockDispatch,
            filesMap,
            filesSearchQuery: '',
            filesLocationFilter: 'loc1',
            filesSelectedPath: ['folder']
        }));
        
        render(<FilesView />);
        
        expect(screen.getAllByText('folder')[0]).toBeInTheDocument(); // Title is folder because we are in it
        expect(screen.getByTitle('xyz.txt')).toBeInTheDocument();
        
        // BackButton check
        const backBtn = screen.getByTitle('Go up one level');
        expect(backBtn).toBeInTheDocument();
        
        fireEvent.click(backBtn);
        expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_FILES_PATH', payload: [] });
    });

    it('Correctly prevents crash logic when searching against empty active paths', () => {
        // We select unknown and path []
        useStore.mockImplementation(selector => selector({
            dispatch: mockDispatch,
            filesMap,
            filesSearchQuery: '',
            filesLocationFilter: 'unknown',
            filesSelectedPath: []
        }));
        
        render(<FilesView />);

        expect(screen.getAllByText('Unknown Sources').length).toBeGreaterThan(0);
        expect(screen.getByTitle('test.dmg')).toBeInTheDocument();
    });
});
