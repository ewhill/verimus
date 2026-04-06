import React, { useEffect } from 'react';
import { useStore } from './store';
import { ApiService } from './services/api';
import ErrorBoundary from './components/Layout/ErrorBoundary';
import Header from './components/Layout/Header';
import PeersView from './components/Views/PeersView';
import LedgerView from './components/Views/LedgerView';
import WalletView from './components/Views/WalletView';
import BlockModal from './components/Modals/BlockModal';
import NodeConfigModal from './components/Modals/NodeConfigModal';
import UploadModal from './components/Modals/UploadModal';
import ToastContainer from './components/Layout/ToastContainer';
import { initializeEIP6963Discovery } from './utils/web3';

function App() {
    const dispatch = useStore(s => s.dispatch);
    const web3Account = useStore(s => s.web3Account);
    const nodeConfig = useStore(s => s.nodeConfig);
    const currentRoute = useStore(s => s.currentRoute);
    const activeWalletTab = useStore(s => s.activeWalletTab);
    const activeLedgerTab = useStore(s => s.activeLedgerTab);
    const activePeersTab = useStore(s => s.activePeersTab);
    const filesSearchQuery = useStore(s => s.filesSearchQuery);
    const searchQuery = useStore(s => s.searchQuery);
    const selectedBlockHash = useStore(s => s.selectedBlockHash);
    const isModalOpen = useStore(s => s.isModalOpen);

    useEffect(() => {
        const cleanupWeb3Listeners = initializeEIP6963Discovery(dispatch);

        // Evaluate deep-link URL on native mount taking precedence over Zustand persistent cache
        const params = new URLSearchParams(window.location.search);
        const q = params.get('q');
        const block = params.get('block');
        const segments = window.location.pathname.split('/').filter(Boolean);
        const route = segments[0] || 'ledger';

        if (q) {
            if (route === 'wallet') {
                dispatch({ type: 'SET_FILES_SEARCH', payload: q });
            } else if (route === 'ledger') {
                dispatch({ type: 'SET_SEARCH', payload: q });
            }
        }
        if (block && route === 'ledger') {
            dispatch({ type: 'SET_MODAL_OPEN', payload: { isOpen: true, hash: block } });
        }

        // Run once on mount explicitly fetching dynamic multi-tier originator topologies securely logically mapping optimally!
        ApiService.discoverOptimalProxy(dispatch).then(() => {
            ApiService.fetchNodeConfig(dispatch);
            ApiService.resumePendingDownloads();
        });

        const handlePopState = () => {
            const pathSegments = window.location.pathname.split('/').filter(Boolean);
            const r = pathSegments[0] || 'ledger';
            const t = pathSegments[1];
            if (r === 'wallet' && t) dispatch({ type: 'SET_WALLET_TAB', payload: t });
            else if (r === 'ledger' && t) dispatch({ type: 'SET_LEDGER_TAB', payload: t });
            else if (r === 'network' && t) dispatch({ type: 'SET_PEERS_TAB', payload: t });
            
            dispatch({ type: 'SET_ROUTE', payload: r });
        };
        
        window.addEventListener('popstate', handlePopState);
        return () => {
            window.removeEventListener('popstate', handlePopState);
            cleanupWeb3Listeners();
        };
    }, [dispatch]);

    useEffect(() => {
        if (!web3Account && (currentRoute === 'wallet' || currentRoute === 'files')) {
            dispatch({ type: 'SET_ROUTE', payload: 'ledger' });
            window.history.replaceState({}, '', '/ledger');
        }
    }, [web3Account, currentRoute, dispatch]);

    useEffect(() => {
        // Sync functional UI state directly into native browser History API dynamically
        const searchParams = new URLSearchParams(window.location.search);
        
        let tabSegment = '';
        if (currentRoute === 'wallet') tabSegment = activeWalletTab;
        else if (currentRoute === 'ledger') tabSegment = activeLedgerTab;
        else if (currentRoute === 'network') tabSegment = activePeersTab;

        let routeUri = `/${currentRoute}`;
        if (tabSegment) routeUri += `/${tabSegment}`;

        // Clear query keys systematically mapping current view bounds
        searchParams.delete('q');
        searchParams.delete('block');

        if (currentRoute === 'wallet' && filesSearchQuery) {
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
    }, [currentRoute, activeWalletTab, activeLedgerTab, activePeersTab, filesSearchQuery, searchQuery, isModalOpen, selectedBlockHash]);

    const renderActiveView = () => {
        if ((currentRoute === 'wallet' || currentRoute === 'files') && !web3Account) {
            return <LedgerView />;
        }
        if (currentRoute === 'network' && nodeConfig?.isAdmin === false) {
            return <LedgerView />;
        }
        switch (currentRoute) {
            case 'network':  return <PeersView />;
            case 'wallet': return <WalletView />;
            case 'ledger':
            default:       return <LedgerView />;
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
