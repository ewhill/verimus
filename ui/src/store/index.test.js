import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './index';

describe('useStore Toast Management', () => {
    beforeEach(() => {
        useStore.setState({ toasts: [] });
    });

    it('should add a toast via ADD_TOAST', () => {
        const { dispatch } = useStore.getState();
        dispatch({
            type: 'ADD_TOAST',
            payload: { id: 'test1', status: 'pending', title: 'Test', message: 'Message' }
        });
        const state = useStore.getState();
        expect(state.toasts).toHaveLength(1);
        expect(state.toasts[0].id).toBe('test1');
    });

    it('should not add a duplicate toast via ADD_TOAST', () => {
        const { dispatch } = useStore.getState();
        dispatch({
            type: 'ADD_TOAST',
            payload: { id: 'test1', status: 'pending', title: 'Test 1', message: 'Message 1' }
        });
        dispatch({
            type: 'ADD_TOAST',
            payload: { id: 'test1', status: 'pending', title: 'Test 2', message: 'Message 2' }
        });
        const state = useStore.getState();
        expect(state.toasts).toHaveLength(1);
        expect(state.toasts[0].title).toBe('Test 1');
    });

    it('should update an existing toast via UPDATE_TOAST', () => {
        const { dispatch } = useStore.getState();
        dispatch({
            type: 'ADD_TOAST',
            payload: { id: 'test1', status: 'pending', title: 'Test', message: 'Message' }
        });
        dispatch({
            type: 'UPDATE_TOAST',
            payload: { id: 'test1', status: 'success', title: 'Updated' }
        });
        const state = useStore.getState();
        expect(state.toasts).toHaveLength(1);
        expect(state.toasts[0].status).toBe('success');
        expect(state.toasts[0].title).toBe('Updated');
        expect(state.toasts[0].message).toBe('Message');
    });

    it('should remove a toast via REMOVE_TOAST', () => {
        const { dispatch } = useStore.getState();
        dispatch({
            type: 'ADD_TOAST',
            payload: { id: 'test1', status: 'pending' }
        });
        dispatch({
            type: 'ADD_TOAST',
            payload: { id: 'test2', status: 'success' }
        });
        dispatch({
            type: 'REMOVE_TOAST',
            payload: 'test1'
        });
        const state = useStore.getState();
        expect(state.toasts).toHaveLength(1);
        expect(state.toasts[0].id).toBe('test2');
    });
});

describe('useStore UI State Persistence', () => {
    beforeEach(() => {
        localStorage.clear();
        useStore.setState({ 
            filesSearchQuery: '',
            filesLocationFilter: 'all',
            filterOwn: true,
            currentView: 'grid'
        });
    });

    it('Persists UI filtering and sorting states into localStorage', () => {
        const { dispatch } = useStore.getState();
        
        // Dispatches to mutate the state
        dispatch({ type: 'SET_FILES_SEARCH', payload: 'findMe123' });
        dispatch({ type: 'SET_FILES_FILTER', payload: 'remote' });
        dispatch({ type: 'SET_FILTER_OWN', payload: false });
        dispatch({ type: 'SET_CURRENT_VIEW', payload: 'list' });
        
        // Assert Native memory memory maps 
        const state = useStore.getState();
        expect(state.filesSearchQuery).toBe('findMe123');
        expect(state.filesLocationFilter).toBe('remote');
        expect(state.filterOwn).toBe(false);
        expect(state.currentView).toBe('list');

        // Extract JSON representation cached by the `persist` Zustand middleware 
        const storedJSON = localStorage.getItem('verimus-ui-storage');
        expect(storedJSON).not.toBeNull();
        
        const cachedStore = JSON.parse(storedJSON);
        // The persist middleware namespaces properties under `.state`
        expect(cachedStore.state).toBeDefined();
        expect(cachedStore.state.filesSearchQuery).toBe('findMe123');
        expect(cachedStore.state.filesLocationFilter).toBe('remote');
        expect(cachedStore.state.filterOwn).toBe(false);
        expect(cachedStore.state.currentView).toBe('list');
        
        // Negative assertions validating the partialize inclusion matrix boundaries
        expect(cachedStore.state.blocks).toBeUndefined();
        expect(cachedStore.state.isModalOpen).toBeUndefined();
        expect(cachedStore.state.error).toBeUndefined();
    });
});
