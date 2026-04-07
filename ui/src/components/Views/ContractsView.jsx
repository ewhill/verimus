import React, { useEffect, useState, useRef } from 'react';
import { useStore } from '../../store';

const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatAddress = (str) => {
    if (!str) return 'Unknown';
    if (str.length <= 16) return str;
    return `${str.substring(0, 8)}...${str.substring(str.length - 8)}`;
};

const ContractsView = () => {
    const dispatch = useStore(s => s.dispatch);
    const [contracts, setContracts] = useState({ data: [], total: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const typingTimeout = useRef(null);
    const PAGE_LIMIT = 16;  // Matching standard ledger bounds

    const fetchContracts = async (currentPage, currentSearch) => {
        try {
            const url = `/api/contracts?page=${currentPage}&limit=${PAGE_LIMIT}&q=${encodeURIComponent(currentSearch)}`;
            const res = await fetch(url);
            if (res.status === 401) return;
            const data = await res.json();
            
            if (!data.success) throw new Error(data.message || 'Contracts API restricted.');
            
            setContracts(data.contracts);
            setError(null);
        } catch (err) {
            console.error('[Contracts Monitor] Failed:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContracts(page, search);
        const interval = setInterval(() => fetchContracts(page, search), 5000);
        return () => clearInterval(interval);
    }, [page, search]);

    const handleSearch = (e) => {
        const val = e.target.value;
        if (typingTimeout.current) clearTimeout(typingTimeout.current);
        
        typingTimeout.current = setTimeout(() => {
            setSearch(val);
            setPage(1);
        }, 300);
    };

    const handleContractClick = (contract) => {
        const syntheticBlock = {
            hash: contract.contractId,
            type: 'STORAGE_CONTRACT',
            signerAddress: contract.originator,
            status: 'confirmed',
            signature: 'Restricted matrix payload',
            timestamp: new Date().toISOString(),
            payload: contract.payload
        };

        const currentBlocks = useStore.getState().blocks;
        if (!currentBlocks.find(b => b.hash === contract.contractId)) {
            dispatch({ type: 'SET_BLOCKS', payload: { blocks: [syntheticBlock, ...currentBlocks], pagination: useStore.getState().pagination }});
        }

        dispatch({ type: 'SET_MODAL_OPEN', payload: { isOpen: true, hash: contract.contractId } });
    };

    if (loading) {
        return (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#8b9bb4' }}>
                <p>Loading Active Contracts...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#ef4444' }}>
                <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Active Contracts Unavailable</h1>
                <p>{error}</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeIn 0.3s ease-out' }}>
            
            <div style={{ marginBottom: '0.5rem', width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
                <input 
                    type="text" 
                    placeholder="Search contract hash or originator bounds..." 
                    onChange={handleSearch}
                    className="search-input"
                    style={{ width: '100%', padding: '1rem 1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-soft)', background: 'rgba(15, 23, 42, 0.4)', color: 'var(--text-main)', fontSize: '1rem', transition: 'all 0.2s', outline: 'none' }}
                />
            </div>

            <div className="list-view" style={{ width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
                {contracts.data.length === 0 ? (
                    <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-soft)' }}>
                        <svg className="empty-state-svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                        </svg>
                        <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>No active contracts detected</h3>
                        <p style={{ color: 'var(--text-muted)' }}>No contracts explicitly mapped or resolving organically.</p>
                    </div>
                ) : (
                    <div className="data-list-container">
                        <div className="data-list-header stagger-1" style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 0.7fr) 2fr 2fr minmax(110px, 1fr) minmax(100px, auto)', padding: '0 1.5rem', marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            <div>Type</div>
                            <div>Contract Hash</div>
                            <div>Originator</div>
                            <div>Bound State</div>
                            <div>Action</div>
                        </div>
                        <div className="data-list-body">
                            {contracts.data.map((contract, i) => (
                                <div 
                                    key={contract.contractId} 
                                    className="data-row status-confirmed" 
                                    style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 0.7fr) 2fr 2fr minmax(110px, 1fr) minmax(100px, auto)', alignItems: 'center', padding: '1rem 1.5rem', cursor: 'pointer', animation: `staggerFadeUp 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) ${i * 0.05}s both` }} 
                                    onClick={() => handleContractClick(contract)}
                                >
                                    <div>
                                        <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                            <span style={{ width: '12px', height: '12px', display: 'flex' }}>
                                                <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0v3.75C20.25 19.853 16.556 21.75 12 21.75s-8.25-1.847-8.25-4.125v-3.75" /></svg>
                                            </span>
                                            Storage
                                        </span>
                                    </div>
                                    <div style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }} title={contract.contractId}>{formatAddress(contract.contractId)}</div>
                                    <div style={{ fontFamily: 'monospace', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {formatAddress(contract.originator)}
                                        {contract.isLocalHost && <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', background: 'var(--bg-dark)', color: '#93c5fd', borderRadius: '4px', fontWeight: 600, border: '1px solid rgba(96, 165, 250, 0.2)' }}>HOST</span>}
                                    </div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{contract.payload?.fragmentMap?.length || 0} Shards - {formatBytes(contract.payload?.erasureParams?.originalSize || 0)}</div>
                                    <div><span className="action-link" style={{ fontSize: '0.85rem', fontWeight: 600 }}>View Block</span></div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            
            {contracts.total > PAGE_LIMIT && (
                <div className="pagination-wrapper stagger-4" style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem', width: '100%' }}>
                    <div className="glass-pagination">
                        <button className="icon-btn" style={{ color: page <= 1 ? 'var(--text-muted)' : 'var(--text-main)', cursor: page <= 1 ? 'not-allowed' : 'pointer' }} disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                            <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                        </button>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Page {page} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>of {Math.ceil(contracts.total / PAGE_LIMIT)}</span></span>
                        <button className="icon-btn" style={{ color: page >= Math.ceil(contracts.total / PAGE_LIMIT) ? 'var(--text-muted)' : 'var(--text-main)', cursor: page >= Math.ceil(contracts.total / PAGE_LIMIT) ? 'not-allowed' : 'pointer' }} disabled={page >= Math.ceil(contracts.total / PAGE_LIMIT)} onClick={() => setPage(p => Math.min(Math.ceil(contracts.total / PAGE_LIMIT), p + 1))}>
                            <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ContractsView;
