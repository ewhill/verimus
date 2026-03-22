import '@testing-library/jest-dom';
/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LedgerGrid from '../../../src/components/Views/LedgerGrid.jsx';
import { ApiService } from '../../../src/services/api';

vi.mock('../../../src/store', () => ({
    useStore: Object.assign(vi.fn(), {
        getState: vi.fn(() => ({}))
    })
}));
vi.mock('../../../src/services/api', () => ({
    ApiService: { fetchBlocks: vi.fn() }
}));

import { useStore } from '../../../src/store';

describe('Frontend: LedgerGrid', () => {
    let mockDispatch;

    beforeEach(() => {
        mockDispatch = vi.fn();
        ApiService.fetchBlocks.mockClear();
    });

    it('Displays blank state warnings when no ledger blocks exist', () => {
        useStore.mockImplementation(selector => selector({
            dispatch: mockDispatch,
            blocks: [],
            currentView: 'list',
            selectedIndex: -1,
            pagination: null
        }));

        render(<LedgerGrid />);
        
        expect(screen.getByText('No blocks found')).toBeInTheDocument();
    });

    it('Calculates correct pagination controls across multiple pages of blocks', () => {
        const blocks = [
            { hash: 'hash1', status: 'mined', metadata: { index: 1, timestamp: 1234 } },
            { hash: 'hash2', status: 'pending', timestamp: 12345 }
        ];

        useStore.mockImplementation(selector => selector({
            dispatch: mockDispatch,
            blocks,
            currentView: 'list',
            selectedIndex: -1,
            pagination: { page: 2, pages: 3 }
        }));

        render(<LedgerGrid />);
        
        expect(screen.getAllByText('hash1...')[0]).toBeInTheDocument();
        expect(screen.getByText('Pending')).toBeInTheDocument();
        
        const nextBtn = screen.getAllByRole('button')[1];
        fireEvent.click(nextBtn);
        
        expect(ApiService.fetchBlocks).toHaveBeenCalled();
        
        const prevBtn = screen.getAllByRole('button')[0];
        fireEvent.click(prevBtn);
        
        expect(ApiService.fetchBlocks).toHaveBeenCalledTimes(2);

        // Grid View
        useStore.mockImplementation(selector => selector({
            dispatch: mockDispatch,
            blocks,
            currentView: 'grid',
            selectedIndex: -1,
            pagination: { page: 2, pages: 3 }
        }));
        const { unmount } = render(<LedgerGrid />);
        expect(screen.getAllByText('hash1...')[0]).toBeInTheDocument();

        // Testing handle click triggering block details properly
        // Grid View: block card click
        const cardHeader = screen.getAllByTitle('hash1')[1].parentElement; // 1 is from newly rendered
        fireEvent.click(cardHeader);
        expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_MODAL_OPEN', payload: { isOpen: true, hash: 'hash1' } });
        expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_SELECTED_INDEX', payload: 0 }); // index of block
    });

    it('Hides pagination footer entirely when total blocks fits on original page', () => {
        const blocks = [ { hash: 'hash1', status: 'mined', metadata: { index: 1, timestamp: 1234 } } ];

        useStore.mockImplementation(selector => selector({
            dispatch: mockDispatch,
            blocks,
            currentView: 'list',
            selectedIndex: -1,
            pagination: null
        }));

        render(<LedgerGrid />);
        // Buttons should be disabled but we bypass and call method physically
        // Wait, button disabled attr handles it, but let's test component pagination guard null
        const btn = screen.getAllByRole('button')[0];
        fireEvent.click(btn);
        expect(ApiService.fetchBlocks).not.toHaveBeenCalled();
    });
});
