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
    const [contracts, setContracts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filterOwn, setFilterOwn] = useState(false);

    const fetchContracts = async () => {
        try {
            const url = filterOwn ? '/api/contracts?own=true' : '/api/contracts';
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
    }, [filterOwn]);

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
            <div className="section-header glass-panel" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.75rem', color: '#f8fafc', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                            <polyline points="10 9 9 9 8 9"></polyline>
                        </svg>
                        Storage Contracts
                    </h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Globally synchronized index mapping cryptographic file deployments and erasure shards identically.</p>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--bg-dark)', padding: '0.5rem', borderRadius: 'var(--radius-full)' }}>
                    <button 
                        onClick={() => setFilterOwn(false)}
                        className={`segmented-btn ${!filterOwn ? 'active' : ''}`}
                        style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-full)', border: 'none', background: !filterOwn ? '#3b82f6' : 'transparent', color: !filterOwn ? '#fff' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}
                    >
                        Global Mesh
                    </button>
                    <button 
                        onClick={() => setFilterOwn(true)}
                        className={`segmented-btn ${filterOwn ? 'active' : ''}`}
                        style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-full)', border: 'none', background: filterOwn ? '#3b82f6' : 'transparent', color: filterOwn ? '#fff' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}
                    >
                        Allocated to Me
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
                {contracts.length === 0 ? (
                    <div style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(15, 23, 42, 0.4)', borderRadius: 'var(--radius-lg)' }}>
                        <p>No storage contracts detected matching criteria.</p>
                    </div>
                ) : (
                    contracts.map((contract, i) => (
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
                                    <span style={{ color: '#cbd5e1' }}>{formatBytes(contract.payload?.boundsMap?.totalSize || 0)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Active Merkle Root</span>
                                    <span style={{ color: '#cbd5e1', fontFamily: 'monospace' }}>{formatAddress(contract.payload?.dataMerkleRoot)}</span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ContractsView;
