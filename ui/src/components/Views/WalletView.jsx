import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import FilesView from './FilesView/FilesView';

const WalletView = () => {
    const activeTab = useStore(s => s.activeWalletTab);
    const [walletData, setWalletData] = useState({ balance: 0, emissionRate: 0, transactions: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Bounding 5 second continuous intervals ensuring O(1) float updates
    useEffect(() => {
        let isMounted = true;
        const fetchWalletStats = async () => {
            try {
                const res = await fetch('/api/wallet');
                const data = await res.json();
                if (data.success && isMounted) {
                    setWalletData({
                        balance: data.balance || 0,
                        emissionRate: data.emissionRate || 0,
                        transactions: data.transactions || []
                    });
                    setError(null);
                } else if (!data.success && isMounted) {
                    setError(data.message);
                }
            } catch (err) {
                if (isMounted) setError(err.message);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchWalletStats();
        const intervalId = setInterval(fetchWalletStats, 5000);

        return () => {
             isMounted = false;
             clearInterval(intervalId);
        };
    }, []);

    // Format helpers mapping raw blockchain precision
    const formatVeri = (num) => parseFloat(num).toFixed(6) + ' $VERI';
    const formatDate = (ts) => new Date(ts).toLocaleString();

    return (
        <div style={{ padding: '0', maxWidth: '1400px', margin: '0 auto', color: '#f8fafc', height: '100%', display: 'flex', flexDirection: 'column', width: '100%' }}>

            {activeTab === 'files' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <FilesView />
                </div>
            )}

            {activeTab === 'dashboard' && (
                <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <h1 style={{ fontSize: '2rem', color: '#c084fc', textShadow: '0 0 20px rgba(192, 132, 252, 0.3)' }}>Decentralized Wallet</h1>
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#8b9bb4' }}>Syncing Global Ledger Arrays...</div>
                    ) : error ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#f87171' }}>{error}</div>
                    ) : (
                        <>
                            {/* Top Row: Analytical Float Arrays */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                                <div className="glass-panel" style={{ padding: '2rem', borderRadius: '16px' }}>
                                    <h3 style={{ color: '#818cf8', fontSize: '1rem', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '1rem' }}>Active Node Balance</h3>
                                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fff', textShadow: '0 0 15px rgba(255,255,255,0.2)' }}>
                                        {formatVeri(walletData.balance)}
                                    </div>
                                    <div style={{ marginTop: '1rem', color: '#94a3b8', fontSize: '0.875rem' }}>
                                        Continuous Float Array Constraints
                                    </div>
                                </div>

                                <div className="glass-panel" style={{ padding: '2rem', borderRadius: '16px' }}>
                                    <h3 style={{ color: '#38bdf8', fontSize: '1rem', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '1rem' }}>Global Emission Physics</h3>
                                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fff', textShadow: '0 0 15px rgba(56,189,248,0.2)' }}>
                                        {formatVeri(walletData.emissionRate)}
                                    </div>
                                    <div style={{ marginTop: '1rem', color: '#94a3b8', fontSize: '0.875rem' }}>
                                        Kryder's Law Block Mint Target Limit
                                    </div>
                                </div>
                            </div>

                            {/* Bottom Row: Transaction Ledger Integration */}
                            <div className="glass-panel" style={{ padding: '2rem', borderRadius: '16px' }}>
                                <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: '#c084fc' }}>Node Transaction Ledger</h2>
                                
                                {walletData.transactions.length === 0 ? (
                                    <div style={{ color: '#64748b', fontStyle: 'italic', textAlign: 'center', padding: '2rem 0' }}>No active transactions detected inside bounding arrays.</div>
                                ) : (
                                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#818cf8' }}>
                                                <th style={{ padding: '1rem 0', fontWeight: 'normal' }}>Timestamp</th>
                                                <th style={{ padding: '1rem 0', fontWeight: 'normal' }}>Transaction Array Identity</th>
                                                <th style={{ padding: '1rem 0', fontWeight: 'normal' }}>Volume Limit</th>
                                                <th style={{ padding: '1rem 0', fontWeight: 'normal', textAlign: 'right' }}>Type</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {walletData.transactions.map((tx, idx) => {
                                                const isMint = tx.senderId === 'SYSTEM';
                                                return (
                                                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#cbd5e1' }}>
                                                        <td style={{ padding: '1rem 0' }}>{formatDate(tx.timestamp)}</td>
                                                        <td style={{ padding: '1rem 0', fontFamily: 'monospace', fontSize: '0.85em', color: '#94a3b8' }}>{tx.hash}</td>
                                                        <td style={{ padding: '1rem 0', color: isMint ? '#4ade80' : '#f8fafc', fontWeight: isMint ? 'bold' : 'normal' }}>
                                                            {isMint ? '+' : ''}{formatVeri(tx.amount)}
                                                        </td>
                                                        <td style={{ padding: '1rem 0', textAlign: 'right' }}>
                                                            <span style={{ 
                                                                background: isMint ? 'rgba(74, 222, 128, 0.1)' : 'rgba(56, 189, 248, 0.1)', 
                                                                color: isMint ? '#4ade80' : '#38bdf8',
                                                                padding: '4px 12px',
                                                                borderRadius: '20px',
                                                                fontSize: '0.75rem',
                                                                letterSpacing: '0.05em',
                                                                textTransform: 'uppercase'
                                                            }}>
                                                                {isMint ? 'System Emission' : 'Standard Pipeline'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default WalletView;
