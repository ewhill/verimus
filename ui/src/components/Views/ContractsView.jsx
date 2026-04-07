import React, { useEffect, useState } from 'react';

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
    const [contracts, setContracts] = useState({ data: [], total: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const PAGE_LIMIT = 8;

    const fetchContracts = async () => {
        try {
            const url = `/api/contracts?page=${page}&limit=${PAGE_LIMIT}`;
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
        fetchContracts();
        const interval = setInterval(fetchContracts, 5000);
        return () => clearInterval(interval);
    }, [page]);

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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
                {contracts.data.length === 0 ? (
                    <div style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(15, 23, 42, 0.4)', borderRadius: 'var(--radius-lg)' }}>
                        <p>No active storage contracts detected on the global network.</p>
                    </div>
                ) : (
                    <>
                        {contracts.data.map((contract, i) => (
                        <div key={i} className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: contract.isLocalHost ? '3px solid #60a5fa' : '1px solid var(--border-light)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.1rem', wordBreak: 'break-all', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {formatAddress(contract.contractId)}
                                        {contract.isLocalHost && (
                                            <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', background: 'rgba(96, 165, 250, 0.2)', color: '#93c5fd', borderRadius: '100px', fontWeight: 600 }}>HOST</span>
                                        )}
                                    </h3>
                                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Originator: {formatAddress(contract.originator)}</p>
                                </div>
                                <div style={{ background: 'var(--bg-dark)', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-SM)', fontSize: '0.8rem', color: '#94a3b8', border: '1px solid var(--border-light)' }}>
                                    {contract.payload?.fragmentMap?.length || 0} Shards
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid var(--border-light)', paddingTop: '1rem', marginTop: 'auto' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Aggregate Bounds</span>
                                    <span style={{ color: '#cbd5e1' }}>{formatBytes(contract.payload?.erasureParams?.originalSize || 0)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Active Merkle Root</span>
                                    <span style={{ color: '#cbd5e1', fontFamily: 'monospace' }}>
                                        {contract.payload?.merkleRoots?.length ? formatAddress(contract.payload.merkleRoots[0]) : 'Unknown'}
                                    </span>
                                </div>
                            </div>
                            </div>
                        ))}
                    </>
                )}
            </div>
            
            {contracts.total > PAGE_LIMIT && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem', gap: '1rem' }}>
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ background: 'var(--bg-dark)', border: '1px solid var(--border-light)', color: '#f8fafc', padding: '0.5rem 1.5rem', borderRadius: '8px', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1, transition: 'all 0.2s' }}>Previous</button>
                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>Page {page} of {Math.ceil(contracts.total / PAGE_LIMIT)}</span>
                    <button onClick={() => setPage(p => Math.min(Math.ceil(contracts.total / PAGE_LIMIT), p + 1))} disabled={page === Math.ceil(contracts.total / PAGE_LIMIT)} style={{ background: 'var(--bg-dark)', border: '1px solid var(--border-light)', color: '#f8fafc', padding: '0.5rem 1.5rem', borderRadius: '8px', cursor: page === Math.ceil(contracts.total / PAGE_LIMIT) ? 'not-allowed' : 'pointer', opacity: page === Math.ceil(contracts.total / PAGE_LIMIT) ? 0.4 : 1, transition: 'all 0.2s' }}>Next</button>
                </div>
            )}
        </div>
    );
};

export default ContractsView;
