import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { ApiService } from '../../services/api';

const LedgerToolbar = () => {
    const dispatch = useStore(s => s.dispatch);
    const searchQuery = useStore(s => s.searchQuery);
    
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

    return (
        <div style={{ marginBottom: '2rem', width: '100%' }}>
            <div className="search-container" style={{ margin: 0, width: '100%', position: 'relative' }}>
                <svg className="search-icon" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', width: '20px', height: '20px', color: 'var(--text-muted)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
                <input 
                    type="text" 
                    placeholder="Search block hashes or addresses..." 
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    style={{ 
                        width: '100%', 
                        padding: '1rem 1rem 1rem 3rem', 
                        borderRadius: '0.75rem', 
                        border: '1px solid rgba(255,255,255,0.05)', 
                        background: 'rgba(0,0,0,0.2)', 
                        color: 'var(--text-primary)', 
                        outline: 'none',
                        fontSize: '1rem',
                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)' 
                    }}
                />
                {inputValue && (
                    <button className="clear-icon" onClick={handleClearSearch} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.25rem' }}>
                        <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: '18px', height: '18px' }}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                    </button>
                )}
            </div>
        </div>
    );
};

export default LedgerToolbar;
