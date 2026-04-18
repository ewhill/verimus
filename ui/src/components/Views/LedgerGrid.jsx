import React from 'react';
import { useStore } from '../../store';
import { ApiService } from '../../services/api';

const getBlockTypeConfig = (type) => {
    switch (type) {
        case 'STORAGE_CONTRACT':
            return { icon: <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0v3.75C20.25 19.853 16.556 21.75 12 21.75s-8.25-1.847-8.25-4.125v-3.75" /></svg>, color: '#60a5fa', bg: 'rgba(59, 130, 246, 0.15)', name: 'Contract' };
        case 'CHECKPOINT':
            return { icon: <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>, color: '#a78bfa', bg: 'rgba(139, 92, 246, 0.15)', name: 'Checkpoint' };
        case 'TRANSACTION':
            return { icon: <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>, color: '#34d399', bg: 'rgba(16, 185, 129, 0.15)', name: 'Transfer' };
        case 'STAKING_CONTRACT':
            return { icon: <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" /></svg>, color: '#fb923c', bg: 'rgba(249, 115, 22, 0.15)', name: 'Stake' };
        case 'SLASHING_TRANSACTION':
            return { icon: <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', name: 'Slashing' };
        default:
            return { icon: <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>, color: '#9ca3af', bg: 'rgba(156, 163, 175, 0.15)', name: type };
    }
};

const LedgerGrid = () => {
    const dispatch = useStore(s => s.dispatch);
    const blocks = useStore(s => s.blocks);
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
            <div className="data-list-header stagger-1" style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 0.7fr) minmax(110px, 0.8fr) 2fr 1.5fr minmax(100px, auto)', padding: '0 1.5rem', marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <div>Block</div>
                <div>Type</div>
                <div>Hash</div>
                <div>Timestamp</div>
                <div>Action</div>
            </div>
            <div className="data-list-body">
                {blocks.map((pkg, i) => {
                    const date = new Date(pkg.metadata?.timestamp || pkg.timestamp).toLocaleString();
                    const isPending = pkg.status === 'pending' || pkg.metadata?.index === -1;
                    const isSelected = selectedIndex === i;
                    const typeConfig = getBlockTypeConfig(pkg.type);
                    
                    return (
                        <div 
                            key={pkg.hash} 
                            className={`data-row ${isPending ? 'status-pending' : 'status-confirmed'} ${isSelected ? 'selected' : ''}`} 
                            style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 0.7fr) minmax(110px, 0.8fr) 2fr 1.5fr minmax(100px, auto)', alignItems: 'center', padding: '1rem 1.5rem', cursor: isPending ? 'default' : 'pointer', animation: `staggerFadeUp 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) ${i * 0.05}s both` }} 
                            onClick={() => !isPending && handleBlockClick(pkg.hash, i)}
                        >
                            <div>{isPending ? <span className="badge pending">Pending</span> : <span className="badge" style={{ background: 'rgba(99,102,241,0.15)', color: '#c7d2fe' }}>#{pkg.metadata?.index ?? pkg.index}</span>}</div>
                            <div>
                                <span className="badge" style={{ background: typeConfig.bg, color: typeConfig.color, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <span style={{ width: '12px', height: '12px', display: 'flex' }}>{typeConfig.icon}</span>
                                    {typeConfig.name}
                                </span>
                            </div>
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

    return (
        <>
            <div id="ledgerContainer" className="list-view">
                {renderList()}
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
