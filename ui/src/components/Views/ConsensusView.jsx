import React, { useEffect, useState } from 'react';

const formatAddress = (str) => {
    if (!str) return 'Unknown';
    if (str.length <= 16) return str;
    return `${str.substring(0, 8)}...${str.substring(str.length - 8)}`;
};

const ConsensusView = () => {
    const [mempool, setMempool] = useState({ pendingBlocks: { data: [], total: 0 }, eligibleForks: { data: [], total: 0 }, settledForks: { data: [], total: 0 } });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [forksPage, setForksPage] = useState(1);
    const [settledPage, setSettledPage] = useState(1);
    const PAGE_LIMIT = 5;

    const fetchMempool = async () => {
        try {
            const res = await fetch(`/api/consensus?forksPage=${forksPage}&settledPage=${settledPage}&limit=${PAGE_LIMIT}`);
            if (res.status === 401) return; // Wait for auth boundary
            const data = await res.json();

            if (!data.success) throw new Error(data.message || 'Consensus metrics API restricted.');

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
    }, [forksPage, settledPage]);

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


            <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span style={{ color: '#3b82f6', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em' }}>PENDING BLOCKS</span>
                        <span style={{ fontSize: '2rem', fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-main)' }}>{mempool.pendingBlocks.total}</span>
                    </div>
                </div>
                {mempool.pendingBlocks.data.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)' }}>There are no pending blocks.</p>
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
                                {mempool.pendingBlocks.data.map((b, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                        <td style={{ padding: '1rem 0.75rem', fontFamily: 'monospace', color: '#94a3b8' }}>{formatAddress(b.hash)}</td>
                                        <td style={{ padding: '1rem 0.75rem' }}>
                                            <span style={{ padding: '0.2rem 0.6rem', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', fontSize: '0.8rem', fontWeight: 600 }}>
                                                {b.type}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem 0.75rem', color: '#e2e8f0' }}>{formatAddress(b.signerAddress)}</td>
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1.5rem' }}>
                        <span style={{ color: '#8b5cf6', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em' }}>ELIGIBLE FORKS</span>
                        <span style={{ fontSize: '2rem', fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-main)' }}>{mempool.eligibleForks.total}</span>
                    </div>
                    {mempool.eligibleForks.data.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)' }}>There are no eligible forks.</p>
                    ) : (
                        <>
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {mempool.eligibleForks.data.map((f, i) => (
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
                            {mempool.eligibleForks.total > PAGE_LIMIT && (
                                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem', gap: '1rem' }}>
                                    <button onClick={() => setForksPage(p => Math.max(1, p - 1))} disabled={forksPage === 1} style={{ background: 'none', border: '1px solid var(--border-light)', color: '#f8fafc', padding: '0.4rem 1rem', borderRadius: '6px', cursor: forksPage === 1 ? 'not-allowed' : 'pointer', opacity: forksPage === 1 ? 0.3 : 0.8, fontSize: '0.85rem' }}>Previous</button>
                                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', fontSize: '0.85rem' }}>Page {forksPage} of {Math.ceil(mempool.eligibleForks.total / PAGE_LIMIT)}</span>
                                    <button onClick={() => setForksPage(p => Math.min(Math.ceil(mempool.eligibleForks.total / PAGE_LIMIT), p + 1))} disabled={forksPage === Math.ceil(mempool.eligibleForks.total / PAGE_LIMIT)} style={{ background: 'none', border: '1px solid var(--border-light)', color: '#f8fafc', padding: '0.4rem 1rem', borderRadius: '6px', cursor: forksPage === Math.ceil(mempool.eligibleForks.total / PAGE_LIMIT) ? 'not-allowed' : 'pointer', opacity: forksPage === Math.ceil(mempool.eligibleForks.total / PAGE_LIMIT) ? 0.3 : 0.8, fontSize: '0.85rem' }}>Next</button>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1.5rem' }}>
                        <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em' }}>SETTLED FORKS</span>
                        <span style={{ fontSize: '2rem', fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-main)' }}>{mempool.settledForks.total}</span>
                    </div>
                    {mempool.settledForks.data.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)' }}>No forks have been settled.</p>
                    ) : (
                        <>
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {mempool.settledForks.data.map((f, i) => (
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
                            {mempool.settledForks.total > PAGE_LIMIT && (
                                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem', gap: '1rem' }}>
                                    <button onClick={() => setSettledPage(p => Math.max(1, p - 1))} disabled={settledPage === 1} style={{ background: 'none', border: '1px solid var(--border-light)', color: '#f8fafc', padding: '0.4rem 1rem', borderRadius: '6px', cursor: settledPage === 1 ? 'not-allowed' : 'pointer', opacity: settledPage === 1 ? 0.3 : 0.8, fontSize: '0.85rem' }}>Previous</button>
                                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', fontSize: '0.85rem' }}>Page {settledPage} of {Math.ceil(mempool.settledForks.total / PAGE_LIMIT)}</span>
                                    <button onClick={() => setSettledPage(p => Math.min(Math.ceil(mempool.settledForks.total / PAGE_LIMIT), p + 1))} disabled={settledPage === Math.ceil(mempool.settledForks.total / PAGE_LIMIT)} style={{ background: 'none', border: '1px solid var(--border-light)', color: '#f8fafc', padding: '0.4rem 1rem', borderRadius: '6px', cursor: settledPage === Math.ceil(mempool.settledForks.total / PAGE_LIMIT) ? 'not-allowed' : 'pointer', opacity: settledPage === Math.ceil(mempool.settledForks.total / PAGE_LIMIT) ? 0.3 : 0.8, fontSize: '0.85rem' }}>Next</button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ConsensusView;
