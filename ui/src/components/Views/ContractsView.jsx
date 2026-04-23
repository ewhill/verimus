import React, { useEffect, useState, useRef } from 'react';
import { useStore } from '../../store';
import RenewContractModal from './RenewContractModal';

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
    const headBlockIndex = useStore(s => s.blocks[0]?.metadata?.index || 0);
    const [contracts, setContracts] = useState({ data: [], total: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [renewModalContract, setRenewModalContract] = useState(null);
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
        fetchContracts(page, '');
        const interval = setInterval(() => fetchContracts(page, ''), 5000);
        return () => clearInterval(interval);
    }, [page]);

    const handleContractClick = (contract) => {
        const syntheticBlock = {
            hash: contract.contractId,
            type: 'STORAGE_CONTRACT',
            signerAddress: contract.originator,
            status: 'confirmed',
            signature: 'Restricted matrix payload',
            timestamp: contract.timestamp || new Date().toISOString(),
            payload: contract.payload,
            metadata: {
                index: contract.index || -1,
                timestamp: contract.timestamp || new Date().toISOString()
            }
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
            <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1.5rem' }}>
                    <span style={{ color: '#38bdf8', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em' }}>ACTIVE CONTRACTS</span>
                    <span style={{ fontSize: '2rem', fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-main)' }}>{contracts.total}</span>
                </div>

                <div className="list-view" style={{ width: '100%' }}>
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
                        <div className="data-list-header stagger-1" style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 1fr) 2fr 1.5fr minmax(130px, auto) minmax(120px, auto)', padding: '0 1.5rem', marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            <div>Lifecycle</div>
                            <div>Contract Hash</div>
                            <div>Originator</div>
                            <div>Storage Metrics</div>
                            <div>Action</div>
                        </div>
                        <div className="data-list-body">
                            {contracts.data.map((contract, i) => {
                                // Dynamically infer contract lifecycle state
                                let statusText = 'ACTIVE';
                                let statusColor = '#10b981';
                                let statusBg = 'rgba(16, 185, 129, 0.15)';
                                
                                if (contract.faultCount > 0) {
                                    statusText = 'SLA BREACH';
                                    statusColor = '#ef4444';
                                    statusBg = 'rgba(239, 68, 68, 0.15)';
                                } else if (contract.expirationBlockHeight && headBlockIndex >= contract.expirationBlockHeight) {
                                    statusText = 'EXPIRED';
                                    statusColor = '#f59e0b';
                                    statusBg = 'rgba(245, 158, 11, 0.15)';
                                }

                                // Audit Health Indicator heartbeat
                                const isAuditedRecently = contract.lastAuditHeight ? (headBlockIndex - contract.lastAuditHeight < 100) : true;
                                const heartbeatColor = isAuditedRecently ? '#10b981' : '#f59e0b';
                                const heartbeatAnimation = isAuditedRecently ? 'pulse-slow 2s infinite' : 'none';

                                return (
                                    <div 
                                        key={contract.contractId} 
                                        className="data-row status-confirmed" 
                                        style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 1fr) 2fr 1.5fr minmax(130px, auto) minmax(120px, auto)', alignItems: 'center', padding: '1rem 1.5rem', cursor: 'pointer', animation: `staggerFadeUp 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) ${i * 0.05}s both` }} 
                                        onClick={() => handleContractClick(contract)}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <span className="badge" style={{ background: statusBg, color: statusColor, display: 'inline-flex', alignItems: 'center', padding: '0.2rem 0.6rem', fontSize: '0.7rem', fontWeight: 700, borderRadius: '4px' }}>
                                                {statusText}
                                            </span>
                                            {/* Proof of Spacetime Heartbeat Icon */}
                                            <div title={isAuditedRecently ? "Healthy Audit Heartbeat" : "Missing Recent Audits"} style={{ color: heartbeatColor, animation: heartbeatAnimation, display: 'flex', alignItems: 'center' }}>
                                                <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" /></svg>
                                            </div>
                                        </div>
                                        <div style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }} title={contract.contractId}>{formatAddress(contract.contractId)}</div>
                                        <div style={{ fontFamily: 'monospace', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {formatAddress(contract.originator)}
                                            {contract.isLocalHost && <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', background: 'var(--bg-dark)', color: '#93c5fd', borderRadius: '4px', fontWeight: 600, border: '1px solid rgba(96, 165, 250, 0.2)' }}>HOST</span>}
                                        </div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                {contract.payload?.fragmentMap?.length || 0} Shards <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)' }}>•</span> {formatBytes(contract.payload?.erasureParams?.originalSize || 0)}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setRenewModalContract(contract); }}
                                                style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'all 0.2s', zIndex: 2 }}
                                            >Top-Up</button>
                                            <span className="action-link" style={{ fontSize: '0.85rem', fontWeight: 600 }}>View Details</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
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

            {renewModalContract && (
                <RenewContractModal 
                    contract={renewModalContract} 
                    onClose={() => setRenewModalContract(null)} 
                    onRenewSuccess={(data) => {
                        setRenewModalContract(null);
                        // Refresh data intelligently avoiding page reloads globally
                        fetchContracts(page, '');
                    }} 
                />
            )}
        </div>
    );
};

export default ContractsView;
