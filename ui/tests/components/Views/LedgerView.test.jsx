import '@testing-library/jest-dom';
/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LedgerView from '../../../src/components/Views/LedgerView.jsx';

vi.mock('../../../src/store', () => {
    let _state = {};
    const mockUseStore = vi.fn(selector => selector(_state));
    mockUseStore.getState = () => _state;
    return {
        useStore: mockUseStore
    };
});
vi.mock('../../../src/services/api', () => ({
    ApiService: { fetchBlocks: vi.fn() }
}));

// Mock child components
vi.mock('../../../src/components/Views/LedgerToolbar.jsx', () => ({
    default: () => <div data-testid="toolbar">Toolbar</div>
}));
vi.mock('../../../src/components/Views/LedgerGrid.jsx', () => ({
    default: () => <div data-testid="grid">Grid</div>
}));

import { useStore } from '../../../src/store';
import { ApiService } from '../../../src/services/api';

describe('Frontend: LedgerView', () => {
    let mockDispatch;

    beforeEach(() => {
        mockDispatch = vi.fn();
        ApiService.fetchBlocks.mockClear();

        delete window.location;
        window.location = new URL('http://localhost/ledger');
    });

    it('Highlights initial blockchain metadata correctly from store', () => {
        window.location = new URL('http://localhost/ledger?upload=success');
        
        useStore.mockImplementation(selector => selector({
            dispatch: mockDispatch,
            blocks: [],
            selectedIndex: -1,
            isModalOpen: false
        }));

        render(<LedgerView />);
        
        expect(screen.getByText('Upload Successful')).toBeInTheDocument();
        
        // dismiss callout
        const dismissBtn = screen.getByRole('button');
        fireEvent.click(dismissBtn);
        expect(screen.queryByText('Upload Successful')).not.toBeInTheDocument();
        
        expect(ApiService.fetchBlocks).toHaveBeenCalledTimes(1);
    });

    it('Navigates blocks intuitively utilizing keyboard arrow key events', () => {
        const blocks = [
            { hash: '1', status: 'mined' },
            { hash: '2', status: 'pending' },
            { hash: '3', status: 'mined' }
        ];

        useStore.mockImplementation(selector => selector({
            dispatch: mockDispatch,
            blocks,
            selectedIndex: 1, // on pending
            isModalOpen: false
        }));

        render(<LedgerView />);
        
        // ArrowRight / Down
        fireEvent.keyDown(document, { key: 'ArrowRight' });
        expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_SELECTED_INDEX', payload: 2 });
        fireEvent.keyDown(document, { key: 'ArrowDown' });
        expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_SELECTED_INDEX', payload: 2 });
        
        // ArrowLeft / Up
        fireEvent.keyDown(document, { key: 'ArrowLeft' });
        expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_SELECTED_INDEX', payload: 0 });
        fireEvent.keyDown(document, { key: 'ArrowUp' });
        expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_SELECTED_INDEX', payload: 0 });
        
        // Ignore arrows on INPUT
        const input = document.createElement('input');
        document.body.appendChild(input);
        input.focus();
        fireEvent.keyDown(input, { key: 'ArrowRight' });
        // should not dispatch
        document.body.removeChild(input);
    });

    it('Opens the block modal interactively when Enter key pressed', () => {
        const blocks = [
            { hash: '1', status: 'mined' },
            { hash: '2', status: 'pending' }
        ];

        useStore.mockImplementation(selector => selector({
            dispatch: mockDispatch,
            blocks,
            selectedIndex: 0,
            isModalOpen: false
        }));

        const { rerender } = render(<LedgerView />);
        
        fireEvent.keyDown(document, { key: 'Enter' });
        expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_MODAL_OPEN', payload: { isOpen: true, hash: '1' } });

        // Escape to close
        useStore.mockImplementation(selector => selector({
            dispatch: mockDispatch,
            blocks,
            selectedIndex: 0,
            isModalOpen: true
        }));

        rerender(<LedgerView />);
        
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_MODAL_OPEN', payload: { isOpen: false, hash: null } });
    });
});
