import React, { useEffect } from 'react';
import { useStore } from './store';
import { ApiService } from './services/api';
import ErrorBoundary from './components/Layout/ErrorBoundary';
import Header from './components/Layout/Header';
import FilesView from './components/Views/FilesView/FilesView';
import PeersView from './components/Views/PeersView';
import LogsView from './components/Views/LogsView';
import LedgerView from './components/Views/LedgerView';
import WalletView from './components/Views/WalletView';
import BlockModal from './components/Modals/BlockModal';
import NodeConfigModal from './components/Modals/NodeConfigModal';
import UploadModal from './components/Modals/UploadModal';
import ToastContainer from './components/Layout/ToastContainer';

function App() {
    const dispatch = useStore(s => s.dispatch);
    const currentRoute = useStore(s => s.currentRoute);
    const filesSearchQuery = useStore(s => s.filesSearchQuery);
    const searchQuery = useStore(s => s.searchQuery);
    const selectedBlockHash = useStore(s => s.selectedBlockHash);
    const isModalOpen = useStore(s => s.isModalOpen);
    const nodeConfig = useStore(s => s.nodeConfig);

    useEffect(() => {
        // Evaluate deep-link URL on native mount taking precedence over Zustand persistent cache
        const params = new URLSearchParams(window.location.search);
        const q = params.get('q');
        const block = params.get('block');
        const path = window.location.pathname.replace('/', '') || 'files';

        if (q) {
            if (path === 'files') {
                dispatch({ type: 'SET_FILES_SEARCH', payload: q });
            } else if (path === 'ledger') {
                dispatch({ type: 'SET_SEARCH', payload: q });
            }
        }
        if (block && path === 'ledger') {
            dispatch({ type: 'SET_MODAL_OPEN', payload: { isOpen: true, hash: block } });
        }

        // Run once on mount
        ApiService.fetchNodeConfig(dispatch);
        ApiService.resumePendingDownloads();

        const handlePopState = () => {
            const r = window.location.pathname.replace('/', '') || 'files';
            dispatch({ type: 'SET_ROUTE', payload: r });
        };
        
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [dispatch]);

    useEffect(() => {
        // Sync functional UI state directly into native browser History API dynamically
        const searchParams = new URLSearchParams(window.location.search);
        let routeUri = `/${currentRoute}`;

        // Clear query keys systematically mapping current view bounds
        searchParams.delete('q');
        searchParams.delete('block');

        if (currentRoute === 'files' && filesSearchQuery) {
            searchParams.set('q', filesSearchQuery);
        } else if (currentRoute === 'ledger') {
            if (searchQuery) searchParams.set('q', searchQuery);
            if (isModalOpen && selectedBlockHash) searchParams.set('block', selectedBlockHash);
        }

        const newQuery = searchParams.toString();
        const fullNewUri = `${routeUri}${newQuery ? `?${newQuery}` : ''}`;
        
        if (window.location.pathname + window.location.search !== fullNewUri) {
            window.history.replaceState({}, '', fullNewUri);
        }
    }, [currentRoute, filesSearchQuery, searchQuery, isModalOpen, selectedBlockHash]);

    const renderActiveView = () => {
        switch (currentRoute) {
            case 'peers':  return <PeersView />;
            case 'logs':   return <LogsView />;
            case 'ledger': return <LedgerView />;
            case 'wallet': return <WalletView />;
            case 'files':
            default:       return <FilesView />;
        }
    };

    return (
        <div className="app-container">
            <Header />
            <main>
                <ErrorBoundary>
                    {renderActiveView()}
                </ErrorBoundary>
            </main>
            <BlockModal />
            <NodeConfigModal />
            <UploadModal />
            <ToastContainer />
        </div>
    );
}

export default App;
