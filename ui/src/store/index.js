import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const getInitialSegments = () => typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean) : [];
const initialSegments = getInitialSegments();
const initialRoute = initialSegments[0] || 'ledger';
const initialTab = initialSegments[1];

export const useStore = create(
    persist(
        (set) => ({
    blocks: [],
    filesMap: [],
    filesSearchQuery: '',
    filesSortOrder: 'name_asc',
    filesLocationFilter: 'all',
    filesSelectedPath: [],
    searchQuery: '',
    filterOwn: true,
    filterCheckpoints: false,
    currentView: 'grid',
    selectedIndex: -1,
    pagination: { page: 1, limit: 16, pages: 1 },
    nodeConfig: { publicKey: null, signature: null },
    isModalOpen: false,
    isNodeConfigModalOpen: false,
    isUploadModalOpen: false,
    selectedBlockHash: null,
    isLoading: false,
    error: null,
    web3Account: null,
    web3EncryptionKey: null,
    discoveredProviders: [],
    activeProvider: null,
    currentRoute: initialRoute,
    activeWalletTab: (initialRoute === 'wallet' && initialTab) ? initialTab : 'dashboard',
    activeLedgerTab: (initialRoute === 'ledger' && initialTab) ? initialTab : 'global',
    activePeersTab: (initialRoute === 'network' && initialTab) ? initialTab : 'mesh',
    ledgerSortMode: 'index_desc',
    toasts: [],

    dispatch: (action) => set((state) => {
        switch (action.type) {
            case 'ADD_TOAST':
                if (!state.toasts.find(t => t.id === action.payload.id)) {
                    return { toasts: [...state.toasts, action.payload] };
                }
                return state;
            case 'UPDATE_TOAST':
                return { toasts: state.toasts.map(t => t.id === action.payload.id ? { ...t, ...action.payload } : t) };
            case 'REMOVE_TOAST':
                return { toasts: state.toasts.filter(t => t.id !== action.payload) };
            case 'SET_ROUTE': return { currentRoute: action.payload };
            case 'SET_WALLET_TAB': return { activeWalletTab: action.payload };
            case 'SET_LEDGER_TAB': return { activeLedgerTab: action.payload };
            case 'SET_PEERS_TAB': return { activePeersTab: action.payload };
            case 'SET_BLOCKS': return { blocks: action.payload.blocks, pagination: action.payload.pagination };
            case 'SET_FILES_MAP': return { filesMap: action.payload };
            case 'SET_NODE_CONFIG': return { nodeConfig: action.payload };
            case 'SET_MODAL_OPEN': return { isModalOpen: action.payload.isOpen, selectedBlockHash: action.payload.hash || null };
            case 'SET_NODE_CONFIG_MODAL_OPEN': return { isNodeConfigModalOpen: action.payload };
            case 'SET_UPLOAD_MODAL_OPEN': return { isUploadModalOpen: action.payload };
            case 'SET_FILES_FILTER': return { filesLocationFilter: action.payload };
            case 'SET_FILES_PATH': return { filesSelectedPath: action.payload };
            case 'SET_FILES_SEARCH': return { filesSearchQuery: action.payload };
            case 'SET_SEARCH': return { searchQuery: action.payload };
            case 'SET_FILTER_OWN': return { filterOwn: action.payload, pagination: { ...state.pagination, page: 1 } };
            case 'SET_FILTER_CHECKPOINTS': return { filterCheckpoints: action.payload, pagination: { ...state.pagination, page: 1 } };
            case 'SET_WEB3_ACCOUNT': return { web3Account: action.payload };
            case 'SET_WEB3_ENCRYPTION_KEY': return { web3EncryptionKey: action.payload };
            case 'ADD_DISCOVERED_PROVIDER':
                if (!state.discoveredProviders.find(p => p.info.uuid === action.payload.info.uuid)) {
                    return { discoveredProviders: [...state.discoveredProviders, action.payload] };
                }
                return state;
            case 'SET_ACTIVE_PROVIDER': return { activeProvider: action.payload };
            case 'SET_CURRENT_VIEW': return { currentView: action.payload };
            case 'SET_SELECTED_INDEX': return { selectedIndex: action.payload };
            case 'SET_PAGINATION': return { pagination: action.payload };
            case 'SET_SORT_MODE': return { ledgerSortMode: action.payload, pagination: { ...state.pagination, page: 1 } };
            case 'SET_ERROR': return { error: action.payload };
            default: return state;
        }
    })
}), {
    name: 'verimus-ui-storage',
    partialize: (state) => ({
        filesSearchQuery: state.filesSearchQuery,
        filesSortOrder: state.filesSortOrder,
        filesLocationFilter: state.filesLocationFilter,
        searchQuery: state.searchQuery,
        filterOwn: state.filterOwn,
        filterCheckpoints: state.filterCheckpoints,
        currentView: state.currentView,
        ledgerSortMode: state.ledgerSortMode,
        web3Account: state.web3Account,
        web3EncryptionKey: state.web3EncryptionKey
    })
}));
