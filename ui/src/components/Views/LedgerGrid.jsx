import React from 'react';
import { useStore } from '../../store';
import { ApiService } from '../../services/api';

const LedgerGrid = () => {
    const dispatch = useStore(s => s.dispatch);
    const blocks = useStore(s => s.blocks);
    const currentView = useStore(s => s.currentView);
    const selectedIndex = useStore(s => s.selectedIndex);
    const pagination = useStore(s => s.pagination);
    
    const page = pagination?.page || 1;
    const pages = pagination?.pages || 1;

    const paginate = (dir) => {
        if (!pagination) return;
        const p = page + dir;
        if (p > 0 && p <= pages) {
            const simulatedState = { ...useStore.getState(), pagination: { ...pagination, page: p } };
            ApiService.fetchBlocks(simulatedState, dispatch);
        }
    };

    const handleBlockClick = (hash, idx) => {
        const block = blocks.find(b => b.hash === hash);
        if (block && block.status !== 'pending' && (!block.metadata || block.metadata.index !== -1)) {
            dispatch({ type: 'SET_MODAL_OPEN', payload: { isOpen: true, hash } });
            dispatch({ type: 'SET_SELECTED_INDEX', payload: idx });
        }
    };

    if (!blocks || !blocks.length) {
        return (
            <div id="ledgerContainer" className="grid-view stagger-2">
                <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-soft)' }}>
                    <svg className="empty-state-svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                    </svg>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>No blocks found</h3>
                    <p style={{ color: 'var(--text-muted)' }}>No blocks matched your search terms or ownership filter.</p>
                </div>
            </div>
        );
    }

    const renderList = () => (
        <div className="data-list-container">
            <div className="data-list-header stagger-1" style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 2fr 1.5fr minmax(120px, auto)', padding: '0 1.5rem', marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <div>Block</div>
                <div>Hash</div>
                <div>Timestamp</div>
                <div>Action</div>
            </div>
            <div className="data-list-body">
                {blocks.map((pkg, i) => {
                    const date = new Date(pkg.metadata?.timestamp || pkg.timestamp).toLocaleString();
                    const isPending = pkg.status === 'pending' || pkg.metadata?.index === -1;
                    const isSelected = selectedIndex === i;
                    
                    return (
                        <div 
                            key={pkg.hash} 
                            className={`data-row ${isPending ? 'status-pending' : 'status-confirmed'} ${isSelected ? 'selected' : ''}`} 
                            style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 2fr 1.5fr minmax(120px, auto)', alignItems: 'center', padding: '1rem 1.5rem', cursor: isPending ? 'default' : 'pointer', animation: `staggerFadeUp 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) ${i * 0.05}s both` }} 
                            onClick={() => !isPending && handleBlockClick(pkg.hash, i)}
                        >
                            <div>{isPending ? <span className="badge pending">Pending</span> : <span className="badge" style={{ background: 'rgba(99,102,241,0.15)', color: '#c7d2fe' }}>#{pkg.metadata?.index ?? pkg.index}</span>}</div>
                            <div style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }} title={pkg.hash}>{pkg.hash.substring(0, 16)}...</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{date}</div>
                            <div>
                                {!isPending && <span className="action-link" style={{ fontSize: '0.85rem', fontWeight: 600 }}>View Details</span>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const renderGrid = () => (
        <div className="grid-container">
            {blocks.map((pkg, i) => {
                const date = new Date(pkg.metadata?.timestamp || pkg.timestamp).toLocaleString();
                const isPending = pkg.status === 'pending' || pkg.metadata?.index === -1;
                const isSelected = selectedIndex === i;
                
                return (
                    <div 
                        key={pkg.hash}
                        className={`block-card redesigned ${isPending ? 'pending' : ''} ${isSelected ? 'selected' : ''}`}
                        style={{ padding: 0, display: 'flex', flexDirection: 'column', cursor: isPending ? 'default' : 'pointer', animation: `staggerFadeUp 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) ${i * 0.05}s both` }}
                        onClick={() => !isPending && handleBlockClick(pkg.hash, i)}
                    >
                        <div className="block-card-header" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                            <div className="card-header" style={{ marginBottom: '1rem' }}>
                                {isPending ? <span className="badge pending" style={{ background: 'rgba(245,158,11,0.15)', color: '#fcd34d' }}>Pending Consensus</span> : <span className="badge" style={{ background: 'rgba(99,102,241,0.15)', color: '#c7d2fe' }}>#{pkg.metadata?.index ?? pkg.index}</span>}
                            </div>
                            <div className="card-id" style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }} title={pkg.hash}>
                                {pkg.hash.substring(0, 16)}...
                            </div>
                            <div className="card-footer" style={{ marginTop: 'auto', paddingTop: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {date}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );

    return (
        <>
            <div id="ledgerContainer" className={`${currentView}-view`}>
                {currentView === 'list' ? renderList() : renderGrid()}
            </div>
            
            <div className="pagination-wrapper stagger-4" style={{ display: 'flex', justifyContent: 'center', marginTop: '2.5rem' }}>
                <div className="glass-pagination">
                    <button className="icon-btn" style={{ color: page <= 1 ? 'var(--text-muted)' : 'var(--text-main)', cursor: page <= 1 ? 'not-allowed' : 'pointer' }} disabled={page <= 1} onClick={() => paginate(-1)}>
                        <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                    </button>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Page {page} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>of {pages}</span></span>
                    <button className="icon-btn" style={{ color: page >= pages ? 'var(--text-muted)' : 'var(--text-main)', cursor: page >= pages ? 'not-allowed' : 'pointer' }} disabled={page >= pages} onClick={() => paginate(1)}>
                        <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                    </button>
                </div>
            </div>
        </>
    );
};

export default LedgerGrid;
