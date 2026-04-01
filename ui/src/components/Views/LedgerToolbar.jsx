import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { ApiService } from '../../services/api';

const LedgerToolbar = () => {
    const dispatch = useStore(s => s.dispatch);
    const filterOwn = useStore(s => s.filterOwn);
    const filterCheckpoints = useStore(s => s.filterCheckpoints);
    const currentView = useStore(s => s.currentView);
    const searchQuery = useStore(s => s.searchQuery);
    const ledgerSortMode = useStore(s => s.ledgerSortMode);
    
    // Local state for debounced input
    const [inputValue, setInputValue] = useState(searchQuery || '');

    useEffect(() => {
        const timeout = setTimeout(() => {
            if (inputValue !== searchQuery) {
                dispatch({ type: 'SET_ROUTE', payload: 'ledger' });
                dispatch({ type: 'SET_SEARCH', payload: inputValue });
                setTimeout(() => ApiService.fetchBlocks(useStore.getState(), dispatch), 0);
            }
        }, 300);
        return () => clearTimeout(timeout);
    }, [inputValue, dispatch, searchQuery]);

    const handleClearSearch = () => {
        setInputValue('');
        dispatch({ type: 'SET_SEARCH', payload: '' });
        setTimeout(() => ApiService.fetchBlocks({ ...useStore.getState(), searchQuery: '' }, dispatch), 0);
    };

    const toggleFilterOwn = () => {
        dispatch({ type: 'SET_FILTER_OWN', payload: !filterOwn });
        setTimeout(() => ApiService.fetchBlocks({ ...useStore.getState(), filterOwn: !filterOwn }, dispatch), 0);
    };

    const toggleFilterCheckpoints = () => {
        dispatch({ type: 'SET_FILTER_CHECKPOINTS', payload: !filterCheckpoints });
        setTimeout(() => ApiService.fetchBlocks({ ...useStore.getState(), filterCheckpoints: !filterCheckpoints }, dispatch), 0);
    };

    const toggleView = (view) => {
        dispatch({ type: 'SET_CURRENT_VIEW', payload: view });
    };

    const refreshLedger = () => {
        ApiService.fetchBlocks(useStore.getState(), dispatch);
    };

    return (
        <div className="section-header glass-panel" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 2rem', borderRadius: 'var(--radius-lg)', margin: '0 0 2rem 0', gap: '1.5rem', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.3)' }}>
            <div className="header-actions-left" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Blockchain Ledger</h2>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '1px solid var(--border-soft)', paddingLeft: '1.5rem' }}>
                    {filterOwn && (
                        <div className="search-container" style={{ margin: 0 }}>
                            <svg className="search-icon" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                            </svg>
                            <input 
                                type="text" 
                                placeholder="Search files..." 
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                            />
                            {inputValue && (
                                <button className="clear-icon" style={{ display: 'flex' }} onClick={handleClearSearch}>
                                    <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                                </button>
                            )}
                        </div>
                    )}
                    
                    <div 
                        className="switch-container" 
                        title={inputValue ? "Clear search query to toggle My Blocks" : ""}
                        style={{ margin: 0 }}
                    >
                        <span className="switch-label" style={{ opacity: inputValue ? 0.5 : 1 }}>My Blocks</span>
                        <button 
                            className={`switch-toggle ${filterOwn ? 'active' : ''}`} 
                            onClick={toggleFilterOwn}
                            disabled={!!inputValue}
                            style={{ cursor: inputValue ? 'not-allowed' : 'pointer', opacity: inputValue ? 0.5 : 1 }}
                        >
                            <span className="switch-thumb">
                                {filterOwn && <svg className="check-icon" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" /></svg>}
                            </span>
                        </button>
                    </div>

                    <div 
                        className="switch-container" 
                        title="Display Memory Checkpoints Only"
                        style={{ margin: 0 }}
                    >
                        <span className="switch-label" style={{ color: filterCheckpoints ? 'var(--primary)' : 'inherit' }}>Checkpoints</span>
                        <button 
                            className={`switch-toggle ${filterCheckpoints ? 'active' : ''}`} 
                            onClick={toggleFilterCheckpoints}
                            style={{ cursor: 'pointer' }}
                        >
                            <span className="switch-thumb">
                                {filterCheckpoints && <svg className="check-icon" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" /></svg>}
                            </span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="header-actions-right" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div className="segmented-control">
                    <button className={`segmented-btn ${currentView === 'list' ? 'active' : ''}`} onClick={() => toggleView('list')}>
                        <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>≡</span>
                    </button>
                    <button className={`segmented-btn ${currentView === 'grid' ? 'active' : ''}`} onClick={() => toggleView('grid')}>
                        <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>⊞</span>
                    </button>
                </div>
                
                <div className="sort-container">
                    <select 
                        className="m3-select" 
                        value={ledgerSortMode || 'desc'} 
                        onChange={(e) => {
                            dispatch({ type: 'SET_SORT_MODE', payload: e.target.value });
                            setTimeout(() => ApiService.fetchBlocks({ ...useStore.getState(), ledgerSortMode: e.target.value }, dispatch), 0);
                        }}
                        style={{ height: '40px', paddingRight: '2.5rem' }}
                    >
                        <option value="desc">Newest First</option>
                        <option value="asc">Oldest First</option>
                    </select>
                </div>
                
                <button className="icon-btn icon-spin" onClick={refreshLedger} title="Refresh Ledger" style={{ background: 'var(--primary-light)', border: '1px solid rgba(99,102,241,0.2)' }}>
                    <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default LedgerToolbar;
