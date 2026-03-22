import '@testing-library/jest-dom';
/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LedgerToolbar from '../../../src/components/Views/LedgerToolbar.jsx';
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

describe('Frontend: LedgerToolbar', () => {
    let mockDispatch;

    beforeEach(() => {
        mockDispatch = vi.fn();
        ApiService.fetchBlocks.mockClear();
        vi.useFakeTimers();
    });

    it('Monitors Search input and dispatches block hash queries successfully', async () => {
        useStore.mockImplementation(selector => selector({
            dispatch: mockDispatch,
            filterOwn: true,
            currentView: 'list',
            searchQuery: '',
            ledgerSortMode: 'desc'
        }));

        render(<LedgerToolbar />);
        
        const searchInput = screen.getByPlaceholderText('Search files...');
        
        fireEvent.change(searchInput, { target: { value: 'file123' } });
        
        // Triggers debounced effect
        vi.runOnlyPendingTimers();
        
        expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_ROUTE', payload: 'ledger' });
        expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_SEARCH', payload: 'file123' });
        
        // Clear search
        const clearBtn = document.querySelector('.clear-icon');
        fireEvent.click(clearBtn);
        expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_SEARCH', payload: '' });
    });

    it('Toggles auto-refresh block mining polling status interval', () => {
        useStore.mockImplementation(selector => selector({
            dispatch: mockDispatch,
            filterOwn: false,
            currentView: 'list',
            searchQuery: '',
            ledgerSortMode: 'desc'
        }));

        render(<LedgerToolbar />);

        const switchBtn = document.querySelector('.switch-toggle');
        fireEvent.click(switchBtn);
        
        expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_FILTER_OWN', payload: true });
        // flush internal setTimeout
        vi.runOnlyPendingTimers();
        expect(ApiService.fetchBlocks).toHaveBeenCalled();
    });

    it('Changes viewing topology from Grid layout to flexible lists mapping', () => {
        useStore.mockImplementation(selector => selector({
            dispatch: mockDispatch,
            filterOwn: false,
            currentView: 'list',
            searchQuery: '',
            ledgerSortMode: 'desc'
        }));

        render(<LedgerToolbar />);
        
        const gridBtn = screen.getByText('⊞');
        fireEvent.click(gridBtn);
        
        expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_CURRENT_VIEW', payload: 'grid' });
    });

    it('Emits custom block sorting preferences for chronological rendering mapping', () => {
        useStore.mockImplementation(selector => selector({
            dispatch: mockDispatch,
            filterOwn: false,
            currentView: 'list',
            searchQuery: '',
            ledgerSortMode: 'desc'
        }));

        render(<LedgerToolbar />);
        
        const select = screen.getByRole('combobox');
        fireEvent.change(select, { target: { value: 'asc' } });
        
        expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_SORT_MODE', payload: 'asc' });
    });

    it('Commands manual ledger refresh updating metadata actively', () => {
        useStore.mockImplementation(selector => selector({
            dispatch: mockDispatch,
            filterOwn: false,
            currentView: 'list',
            searchQuery: '',
            ledgerSortMode: 'desc'
        }));

        render(<LedgerToolbar />);
        const btn = document.querySelector('.icon-btn');
        fireEvent.click(btn);
        
        expect(ApiService.fetchBlocks).toHaveBeenCalled();
    });
});
