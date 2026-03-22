import '@testing-library/jest-dom';
/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../src/store';

describe('Frontend: Zustand Store State Management', () => {

    beforeEach(() => {
        // Reset full state
        useStore.setState({
            pagination: { page: 1, limit: 16 }
        });
    });

    it('Correctly mutates store state properties exclusively through predefined action reducers', () => {
        const dispatch = useStore.getState().dispatch;

        dispatch({ type: 'SET_ROUTE', payload: 'upload' });
        expect(useStore.getState().currentRoute).toBe('upload');

        dispatch({ type: 'SET_FILES_MAP', payload: ['file'] });
        expect(useStore.getState().filesMap).toEqual(['file']);

        dispatch({ type: 'SET_FILES_FILTER', payload: 'locA' });
        expect(useStore.getState().filesLocationFilter).toBe('locA');

        dispatch({ type: 'SET_FILES_PATH', payload: ['pathA'] });
        expect(useStore.getState().filesSelectedPath).toEqual(['pathA']);

        dispatch({ type: 'SET_FILES_SEARCH', payload: 'q2' });
        expect(useStore.getState().filesSearchQuery).toBe('q2');

        dispatch({ type: 'SET_SEARCH', payload: 'q1' });
        expect(useStore.getState().searchQuery).toBe('q1');

        dispatch({ type: 'SET_FILTER_OWN', payload: false });
        expect(useStore.getState().filterOwn).toBe(false);
        expect(useStore.getState().pagination.page).toBe(1);

        dispatch({ type: 'SET_CURRENT_VIEW', payload: 'list' });
        expect(useStore.getState().currentView).toBe('list');

        dispatch({ type: 'SET_SELECTED_INDEX', payload: 2 });
        expect(useStore.getState().selectedIndex).toBe(2);

        dispatch({ type: 'SET_PAGINATION', payload: { page: 3 } });
        expect(useStore.getState().pagination.page).toBe(3);

        dispatch({ type: 'SET_SORT_MODE', payload: 'asc' });
        expect(useStore.getState().ledgerSortMode).toBe('asc');
        expect(useStore.getState().pagination.page).toBe(1); // resets page!

        dispatch({ type: 'SET_ERROR', payload: 'crash' });
        expect(useStore.getState().error).toBe('crash');

        // default fallback
        dispatch({ type: 'UNKNOWN', payload: 'xyz' });
    });
});
