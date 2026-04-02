import React, { useEffect, useState } from 'react';

const formatAddress = (str) => {
    if (!str) return 'Unknown';
    if (str.length <= 16) return str;
    return `${str.substring(0, 8)}...${str.substring(str.length - 8)}`;
};

const ConsensusView = () => {
    const [mempool, setMempool] = useState({ pendingBlocks: [], eligibleForks: [], settledForks: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchMempool = async () => {
        try {
            const res = await fetch('/api/consensus');
            if (res.status === 401) return; // Wait for auth boundary
            const data = await res.json();
            
            if (!data.success) throw new Error(data.message || 'Mempool metrics API restricted.');
            
            setMempool(data.mempool);
            setError(null);
        } catch (err) {
            console.error('[Consensus Monitor] Failed:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMempool();
        const interval = setInterval(fetchMempool, 3000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#8b9bb4' }}>
                <p>Loading consensus state...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#ef4444' }}>
                <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Consensus Diagnostics Unavailable</h1>
                <p>{error}</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeIn 0.3s ease-out' }}>
            <div className="section-header glass-panel" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)' }}>
                <h1 style={{ fontSize: '1.75rem', color: '#f8fafc', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                    </svg>
                    Mempool Diagnostics
                </h1>
                <p style={{ color: 'var(--text-secondary)' }}>Live trace of the mathematical block adoption pipeline mapping cryptographic forks seamlessly across peer bounds.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                <MetricCard title="Pending Block Transactions" value={mempool.pendingBlocks.length} color="#3b82f6" />
                <MetricCard title="Eligible Competing Forks" value={mempool.eligibleForks.length} color="#8b5cf6" />
                <MetricCard title="Settled Adopted Forks" value={mempool.settledForks.length} color="#10b981" />
            </div>

            <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
                <h2 style={{ fontSize: '1.25rem', color: '#f8fafc', marginBottom: '1.25rem' }}>Pending Block Transactions</h2>
                {mempool.pendingBlocks.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)' }}>Mempool trace clean. No stalled bounds.</p>
                ) : (
                    <div className="table-responsive">
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)' }}>
                                    <th style={{ padding: '0.75rem', fontWeight: 600 }}>Sig Hash</th>
                                    <th style={{ padding: '0.75rem', fontWeight: 600 }}>Type</th>
                                    <th style={{ padding: '0.75rem', fontWeight: 600 }}>Originator</th>
                                    <th style={{ padding: '0.75rem', fontWeight: 600 }}>Verifications</th>
                                    <th style={{ padding: '0.75rem', fontWeight: 600 }}>Eligible</th>
                                </tr>
                            </thead>
                            <tbody>
                                {mempool.pendingBlocks.map((b, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                        <td style={{ padding: '1rem 0.75rem', fontFamily: 'monospace', color: '#94a3b8' }}>{formatAddress(b.hash)}</td>
                                        <td style={{ padding: '1rem 0.75rem' }}>
                                            <span style={{ padding: '0.2rem 0.6rem', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', fontSize: '0.8rem', fontWeight: 600 }}>
                                                {b.type}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem 0.75rem', color: '#e2e8f0' }}>{formatAddress(b.publicKey)}</td>
                                        <td style={{ padding: '1rem 0.75rem', color: b.verificationsCount > 0 ? '#10b981' : 'var(--text-muted)' }}>
                                            {b.verificationsCount}
                                        </td>
                                        <td style={{ padding: '1rem 0.75rem' }}>
                                            {b.eligible ? <strong style={{ color: '#8b5cf6' }}>YES</strong> : <span style={{ color: 'var(--text-muted)' }}>NO</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
                <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
                    <h2 style={{ fontSize: '1.25rem', color: '#f8fafc', marginBottom: '1.25rem' }}>Eligible Network Forks</h2>
                    {mempool.eligibleForks.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)' }}>No localized network segment forks detected.</p>
                    ) : (
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {mempool.eligibleForks.map((f, i) => (
                                <li key={i} style={{ background: 'var(--bg-dark)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <span style={{ color: '#cbd5e1', fontWeight: 600 }}>Fork ID: {formatAddress(f.forkId)}</span>
                                        {f.adopted ? <span style={{ color: '#10b981', fontSize: '0.85rem' }}>ADOPTED</span> : <span style={{ color: '#f59e0b', fontSize: '0.85rem' }}>PROPOSING</span>}
                                    </div>
                                    <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        <span>Blocks: {f.blockCount}</span>
                                        <span>Proposals: {f.proposalsCount}</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
                    <h2 style={{ fontSize: '1.25rem', color: '#f8fafc', marginBottom: '1.25rem' }}>Settled Integrations</h2>
                    {mempool.settledForks.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)' }}>Ledger sync cache strictly bounded.</p>
                    ) : (
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {mempool.settledForks.map((f, i) => (
                                <li key={i} style={{ background: 'var(--bg-dark)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', borderLeft: f.committed ? '3px solid #10b981' : '3px solid #3b82f6' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <span style={{ color: '#cbd5e1', fontWeight: 600 }}>Fork ID: {formatAddress(f.forkId)}</span>
                                        {f.committed ? <span style={{ color: '#10b981', fontSize: '0.85rem' }}>COMMITTED</span> : <span style={{ color: '#3b82f6', fontSize: '0.85rem' }}>PENDING FLUSH</span>}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        Tip Hash: <span style={{ fontFamily: 'monospace' }}>{formatAddress(f.finalTipHash)}</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};

const MetricCard = ({ title, value, color }) => (
    <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: `4px solid ${color}` }}>
        <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>{title}</h3>
        <span style={{ fontSize: '2rem', fontWeight: 700, color: '#f8fafc' }}>{value}</span>
    </div>
);

export default ConsensusView;
