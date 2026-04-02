import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
    currentRoute: window.location.pathname.replace('/', '') || 'files',
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
        ledgerSortMode: state.ledgerSortMode
    })
}));
