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
        <div className="section-header glass-panel" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 2rem', borderRadius: 'var(--radius-lg)', margin: '0 0 2rem 0', gap: '1.5rem', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.3)' }}>
            <div className="header-actions-left" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Blockchain Ledger</h2>
            </div>

            <div className="header-actions-right" style={{ display: 'flex', gap: '1rem', alignItems: 'center', width: '100%', maxWidth: '350px' }}>
                <div className="search-container" style={{ margin: 0, width: '100%', position: 'relative' }}>
                    <svg className="search-icon" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: 'var(--text-muted)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                    </svg>
                    <input 
                        type="text" 
                        placeholder="Search block hashes or addresses..." 
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        style={{ width: '100%', padding: '0.65rem 1rem 0.65rem 2.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', outline: 'none' }}
                    />
                    {inputValue && (
                        <button className="clear-icon" onClick={handleClearSearch} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: '16px', height: '16px' }}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LedgerToolbar;
