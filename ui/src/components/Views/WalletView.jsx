import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { useStore } from '../../store';
import FilesView from './FilesView/FilesView';
import TransferModal from '../Modals/TransferModal';

// Inline Native SVG Area Chart mapping cumulative wallet physics
const PortfolioChart = ({ transactions, balance }) => {
    if (!transactions || transactions.length === 0) {
        return <div style={{ height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontStyle: 'italic', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>Insufficient historical data for charting.</div>;
    }

    const currentBal = parseFloat(ethers.formatUnits(balance ? balance.toString() : "0", 18));
    let runningBal = currentBal;
    
    // Form historical data points by projecting backwards
    // We reverse the logic: txns are newest first. So as we go back in time, we revert the txn effects.
    const history = [{ val: currentBal }];
    for (const tx of transactions) {
        const amt = parseFloat(ethers.formatUnits(tx.amount ? tx.amount.toString() : "0", 18));
        // If it was a received mint/transfer, the previous balance was lower
        // If we sent it, the previous balance was higher (assuming we can detect send/receive, for now assume all are receives in mock or standard)
        const isMint = tx.senderAddress === ethers.ZeroAddress;
        if (isMint) {
            runningBal -= amt;
        } else {
            // Generalize: if not mint, assume generic
            runningBal -= amt;
        }
        history.push({ val: Math.max(0, runningBal) });
    }
    
    history.reverse(); // Now oldest -> newest
    const maxVal = Math.max(...history.map(h => h.val), 0.1);
    
    const width = 1000;
    const height = 150;
    
    const points = history.map((pt, i) => {
        const x = (i / Math.max(1, history.length - 1)) * width;
        const y = height - ((pt.val / maxVal) * height * 0.8) - 10; // 10px padding
        return `${x},${y}`;
    }).join(' ');
    
    return (
        <div style={{ width: '100%', height: '150px', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '12px', border: '1px solid var(--border-soft)', overflow: 'hidden', position: 'relative' }}>
             <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
                 <defs>
                     <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="0%" stopColor="rgba(192, 132, 252, 0.4)" />
                         <stop offset="100%" stopColor="rgba(192, 132, 252, 0)" />
                     </linearGradient>
                 </defs>
                 <polyline points={`0,${height} ${points} ${width},${height}`} fill="url(#chartGradient)" />
                 <polyline points={points} fill="none" stroke="#c084fc" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
             </svg>
        </div>
    );
};


const WalletView = () => {
    const activeTab = useStore(s => s.activeWalletTab);
    const web3Account = useStore(s => s.web3Account);
    const [walletData, setWalletData] = useState({ balance: 0, emissionRate: 0, transactions: [], totalPages: 1 });
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

    // Bounding 5 second continuous intervals ensuring O(1) float updates
    useEffect(() => {
        let isMounted = true;
        const fetchWalletStats = async () => {
            if (!web3Account) return;
            try {
                const res = await fetch(`/api/wallet?address=${web3Account}&page=${currentPage}&limit=25`);
                const data = await res.json();
                if (data.success && isMounted) {
                    setWalletData({
                        balance: data.balance || 0,
                        emissionRate: data.emissionRate || 0,
                        transactions: data.transactions || [],
                        totalPages: data.totalPages || 1
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
    }, [web3Account, currentPage]);

    // Format helpers mapping raw blockchain precision from BigInt strings natively
    const formatVeri = (num) => parseFloat(ethers.formatUnits(num ? num.toString() : "0", 18)).toFixed(6) + ' $VERI';
    const formatDate = (ts) => new Date(ts).toLocaleString();

    return (
        <div style={{ padding: '0', maxWidth: '1400px', margin: '0 auto', color: '#f8fafc', height: '100%', display: 'flex', flexDirection: 'column', width: '100%' }}>

            <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <h1 style={{ fontSize: '2rem', color: '#c084fc', textShadow: '0 0 20px rgba(192, 132, 252, 0.3)' }}>Decentralized Wallet</h1>
                        <button onClick={() => setIsTransferModalOpen(true)} style={{
                            padding: '0.8rem 1.5rem', background: '#38bdf8', color: '#fff', border: 'none',
                            borderRadius: '100px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s',
                            boxShadow: '0 0 15px rgba(56,189,248,0.4)', display: 'flex', alignItems: 'center', gap: '0.5rem'
                        }} onMouseOver={(e) => e.currentTarget.style.boxShadow = '0 0 25px rgba(56,189,248,0.6)'} onMouseOut={(e) => e.currentTarget.style.boxShadow = '0 0 15px rgba(56,189,248,0.4)'}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                            Transfer Protocol
                        </button>
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
                                    <h3 style={{ color: '#818cf8', fontSize: '1rem', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '1rem' }}>Web3 Wallet Balance</h3>
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
                            <div className="glass-panel" style={{ padding: '2.5rem', borderRadius: '16px' }}>
                                <div style={{ marginBottom: '2rem' }}>
                                    <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--text-main)' }}>Portfolio Trajectory</h2>
                                    <PortfolioChart transactions={walletData.transactions} balance={walletData.balance} />
                                </div>
                                
                                <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--text-main)', marginTop: '3rem' }}>Isolated TxHistory</h2>
                                
                                {walletData.transactions.length === 0 ? (
                                    <div style={{ color: '#64748b', fontStyle: 'italic', textAlign: 'center', padding: '2rem 0' }}>No active transactions detected inside bounding arrays.</div>
                                ) : (
                                    <div className="data-list-container" style={{ marginTop: '1rem' }}>
                                        <div className="data-list-header stagger-1" style={{ display: 'grid', gridTemplateColumns: '1.5fr 2fr 1fr 1.5fr', padding: '0 1.5rem', marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            <div>Timestamp</div>
                                            <div>TxHash</div>
                                            <div>Value</div>
                                            <div style={{ textAlign: 'right' }}>Type</div>
                                        </div>
                                        <div className="data-list-body">
                                            {walletData.transactions.map((tx, idx) => {
                                                const isMint = tx.senderAddress === ethers.ZeroAddress;
                                                return (
                                                    <div key={idx} className="data-row status-confirmed" style={{ display: 'grid', gridTemplateColumns: '1.5fr 2fr 1fr 1.5fr', alignItems: 'center', padding: '1rem 1.5rem', cursor: 'default', animation: `staggerFadeUp 0.3s ease-out ${idx * 0.03}s both` }}>
                                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                                            {formatDate(tx.timestamp)}
                                                        </div>
                                                        <div style={{ fontFamily: 'monospace', color: 'var(--text-main)', fontSize: '0.85rem' }}>
                                                            {tx.hash.substring(0, 16)}...
                                                        </div>
                                                        <div style={{ color: isMint ? '#10b981' : 'var(--text-main)', fontWeight: isMint ? 600 : 400, fontFamily: 'monospace' }}>
                                                            {isMint ? '+' : ''}{formatVeri(tx.amount)}
                                                        </div>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <span className="badge" style={{ 
                                                                background: isMint ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.15)', 
                                                                color: isMint ? '#10b981' : '#38bdf8',
                                                                fontSize: '0.75rem'
                                                            }}>
                                                                {isMint ? 'System Emission' : 'Standard Transfer'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                                
                                {walletData.totalPages > 1 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
                                        <button 
                                            disabled={currentPage === 1} 
                                            onClick={() => setCurrentPage(p => p - 1)}
                                            style={{ padding: '0.75rem 1.5rem', background: currentPage === 1 ? 'rgba(255,255,255,0.05)' : 'rgba(192, 132, 252, 0.1)', color: currentPage === 1 ? '#64748b' : '#c084fc', border: 'none', borderRadius: '8px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', transition: 'all 0.2s', fontWeight: 'bold' }}
                                        >
                                            ← Previous Phase
                                        </button>
                                        <span style={{ color: '#94a3b8', fontSize: '0.9rem', letterSpacing: '0.05em' }}>
                                            MATRIX PAGE <span style={{ color: '#f8fafc', fontWeight: 'bold' }}>{currentPage}</span> OF <span style={{ color: '#f8fafc', fontWeight: 'bold' }}>{walletData.totalPages}</span>
                                        </span>
                                        <button 
                                            disabled={currentPage >= walletData.totalPages} 
                                            onClick={() => setCurrentPage(p => p + 1)}
                                            style={{ padding: '0.75rem 1.5rem', background: currentPage >= walletData.totalPages ? 'rgba(255,255,255,0.05)' : 'rgba(192, 132, 252, 0.1)', color: currentPage >= walletData.totalPages ? '#64748b' : '#c084fc', border: 'none', borderRadius: '8px', cursor: currentPage >= walletData.totalPages ? 'not-allowed' : 'pointer', transition: 'all 0.2s', fontWeight: 'bold' }}
                                        >
                                            Next Phase →
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
            </div>
            <TransferModal 
                isOpen={isTransferModalOpen} 
                onClose={() => setIsTransferModalOpen(false)} 
                balance={walletData.balance ? parseFloat(ethers.formatUnits(walletData.balance.toString(), 18)).toFixed(6) : '0'} 
            />
        </div>
    );
};

export default WalletView;
