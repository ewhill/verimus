import '@testing-library/jest-dom';
/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SidebarLocations from '../../../../src/components/Views/FilesView/SidebarLocations.jsx';

vi.mock('../../../../src/store', () => ({
    useStore: vi.fn()
}));

import { useStore } from '../../../../src/store';

describe('Frontend: SidebarLocations', () => {
    let mockDispatch;

    beforeEach(() => {
        mockDispatch = vi.fn();
        useStore.mockImplementation(selector => selector({
            dispatch: mockDispatch,
            filesLocationFilter: 'all',
            filesSelectedPath: [],
            filesSearchQuery: ''
        }));
    });

    it('Highlights visually the corresponding source directory during navigation', () => {
        const treeData = {
            locations: [],
            treeNodes: new Map(),
            hasUnknownFiles: false
        };

        render(<SidebarLocations treeData={treeData} />);
        
        const input = screen.getByPlaceholderText('Search files...');
        fireEvent.change(input, { target: { value: 'TEST' } });
        
        expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_FILES_SEARCH', payload: 'test' });

        // Change mock state to test clear button
        useStore.mockImplementation(selector => selector({
            dispatch: mockDispatch,
            filesLocationFilter: 'all',
            filesSelectedPath: [],
            filesSearchQuery: 'test'
        }));
        
        const { unmount } = render(<SidebarLocations treeData={treeData} />);
        const clearBtn = screen.getByRole('button');
        fireEvent.click(clearBtn);
        expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_FILES_SEARCH', payload: '' });
    });

    it('Correctly selects unallocated files into the Unknown Sources label', () => {
        const rootLoc = {
            name: 'Local',
            type: 'local',
            locationId: 'loc1',
            path: [],
            folders: new Map(),
            files: []
        };
        rootLoc.folders.set('f1', {
            name: 'f1',
            type: 'local',
            locationId: 'loc1',
            path: ['f1'],
            folders: new Map(),
            files: []
        });

        const treeData = {
            locations: [{ id: 'loc1' }],
            treeNodes: new Map([
                ['loc1', rootLoc],
                ['unknown', {
                    name: 'Unknown Sources',
                    type: 'unknown',
                    locationId: 'unknown',
                    path: [],
                    folders: new Map(),
                    files: []
                }]
            ]),
            hasUnknownFiles: true
        };

        // expanded local state mock
        useStore.mockImplementation(selector => selector({
            dispatch: mockDispatch,
            filesLocationFilter: 'loc1',
            filesSelectedPath: [], // exact match loc1
            filesSearchQuery: ''
        }));

        render(<SidebarLocations treeData={treeData} />);
        
        // Root local and nested 'f1' should be visible
        expect(screen.getByText('Local')).toBeInTheDocument();
        expect(screen.getByText('f1')).toBeInTheDocument();
        expect(screen.getByText('Unknown Sources')).toBeInTheDocument();
        
        // Testing different icons
        const sambaLoc = { ...rootLoc, locationId: 'locS', type: 'samba', name: 'Samba' };
        const s3Loc = { ...rootLoc, locationId: 'loc3', type: 's3', name: 'S3' };
        const fsLoc = { ...rootLoc, locationId: 'locF', type: 'remote-fs', name: 'Remote' };
        
        treeData.treeNodes.set('locS', sambaLoc);
        treeData.treeNodes.set('loc3', s3Loc);
        treeData.treeNodes.set('locF', fsLoc);
        treeData.locations.push({ id: 'locS' }, { id: 'loc3' }, { id: 'locF' });
        
        const { unmount } = render(<SidebarLocations treeData={treeData} />);
        expect(screen.getByText('Samba')).toBeInTheDocument();
        expect(screen.getByText('S3')).toBeInTheDocument();
        expect(screen.getByText('Remote')).toBeInTheDocument();

        // Testing clicks
        fireEvent.click(screen.getByText('Samba').closest('.sidebar-item'));
        expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_FILES_FILTER', payload: 'locS' });
    });
});
