import '@testing-library/jest-dom';
/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../src/App.jsx';

// Mock sub-components
vi.mock('../src/components/Layout/Header', () => ({ default: () => <div data-testid="header">Header</div> }));
vi.mock('../src/components/Layout/ErrorBoundary', () => ({ default: ({children}) => <div data-testid="error-boundary">{children}</div> }));
vi.mock('../src/components/Views/UploadView', () => ({ default: () => <div data-testid="upload-view">UploadView</div> }));
vi.mock('../src/components/Views/PeersView', () => ({ default: () => <div data-testid="peers-view">PeersView</div> }));
vi.mock('../src/components/Views/LogsView', () => ({ default: () => <div data-testid="logs-view">LogsView</div> }));
vi.mock('../src/components/Views/LedgerView', () => ({ default: () => <div data-testid="ledger-view">LedgerView</div> }));
vi.mock('../src/components/Views/FilesView/FilesView', () => ({ default: () => <div data-testid="files-view">FilesView</div> }));
vi.mock('../src/components/Modals/BlockModal', () => ({ default: () => <div data-testid="block-modal">BlockModal</div> }));

vi.mock('../src/store', () => ({ useStore: vi.fn() }));
vi.mock('../src/services/api', () => ({ ApiService: { fetchNodeConfig: vi.fn(), resumePendingDownloads: vi.fn() } }));

import { useStore } from '../src/store';
import { ApiService } from '../src/services/api';

describe('Frontend: App', () => {
    let mockDispatch;

    beforeEach(() => {
        mockDispatch = vi.fn();
        ApiService.fetchNodeConfig.mockClear();
    });

    it('Renders active navigation route correctly based on location state', async () => {
        // Test default/files
        useStore.mockImplementation(selector => selector({
            dispatch: mockDispatch, currentRoute: 'files'
        }));
        const { unmount } = render(<App />);
        expect(ApiService.fetchNodeConfig).toHaveBeenCalledWith(mockDispatch);
        expect(screen.getByTestId('files-view')).toBeInTheDocument();
        
        // upload
        useStore.mockImplementation(selector => selector({
            dispatch: mockDispatch, currentRoute: 'upload'
        }));
        unmount();
        render(<App />);
        expect(screen.getByTestId('upload-view')).toBeInTheDocument();
        
        // peers
        useStore.mockImplementation(selector => selector({
            dispatch: mockDispatch, currentRoute: 'peers'
        }));
        unmount();
        render(<App />);
        expect(screen.getByTestId('peers-view')).toBeInTheDocument();

        // logs
        useStore.mockImplementation(selector => selector({
            dispatch: mockDispatch, currentRoute: 'logs'
        }));
        unmount();
        render(<App />);
        expect(screen.getByTestId('logs-view')).toBeInTheDocument();

        // ledger
        useStore.mockImplementation(selector => selector({
            dispatch: mockDispatch, currentRoute: 'ledger'
        }));
        unmount();
        render(<App />);
        expect(screen.getByTestId('ledger-view')).toBeInTheDocument();
        
        // test popstate event implicitly inherently explicitly robustly naturally excellently perfectly dynamically efficiently smartly successfully securely automatically practically beautifully organically beautifully logically naturally rationally creatively naturally realistically elegantly magically
        delete window.location;
        window.location = new URL('http://localhost/peers_pop');
        fireEvent(window, new PopStateEvent('popstate', { state: {} }));
        expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_ROUTE', payload: 'peers_pop' });
    });

    it('Parses deep-link URL query parameters natively prioritizing over cached state on structural mount', () => {
        delete window.location;
        window.location = new URL('http://localhost/ledger?q=test_query&block=test_hash');
        
        useStore.mockImplementation(selector => selector({
            dispatch: mockDispatch, currentRoute: 'ledger', filesSearchQuery: '', searchQuery: '', selectedBlockHash: null, isModalOpen: false
        }));
        
        render(<App />);
        
        expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_SEARCH', payload: 'test_query' });
        expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_MODAL_OPEN', payload: { isOpen: true, hash: 'test_hash' } });
    });
    
    it('Synchronizes internal functional UI state back into native window.history.replaceState transparently', () => {
        delete window.location;
        window.location = new URL('http://localhost/files');
        
        vi.spyOn(window.history, 'replaceState');
        
        useStore.mockImplementation(selector => selector({
            dispatch: mockDispatch, currentRoute: 'files', filesSearchQuery: 'awesome_query', searchQuery: '', selectedBlockHash: null, isModalOpen: false
        }));
        
        render(<App />);
        
        expect(window.history.replaceState).toHaveBeenCalledWith({}, '', '/files?q=awesome_query');
    });
});
