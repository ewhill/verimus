import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { useStore } from '../../store';
import FilesView from './FilesView/FilesView';
import TransferModal from '../Modals/TransferModal';

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

            {activeTab === 'assets' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'visible' }}>
                    <FilesView />
                </div>
            )}

            {activeTab === 'dashboard' && (
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
                                                const isMint = tx.senderAddress === ethers.ZeroAddress;
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
            )}
            
            <TransferModal 
                isOpen={isTransferModalOpen} 
                onClose={() => setIsTransferModalOpen(false)} 
                balance={walletData.balance ? parseFloat(ethers.formatUnits(walletData.balance.toString(), 18)).toFixed(6) : '0'} 
            />
        </div>
    );
};

export default WalletView;
