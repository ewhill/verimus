import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { useStore } from '../../store';
import FilesView from './FilesView/FilesView';
import { VeriIcon } from '../Icons';

// Inline Native SVG Area Chart mapping cumulative wallet physics
const PortfolioChart = ({ transactions, balance, timeFilter, onDeltaCalculated }) => {
    const [hoverPos, setHoverPos] = useState(null);

    if (!transactions || transactions.length === 0) {
        return <div style={{ height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontStyle: 'italic', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>Insufficient historical data for charting.</div>;
    }

    const currentBal = parseFloat(ethers.formatUnits(balance ? balance.toString() : "0", 18));
    let runningBal = currentBal;

    // Form historical data points by projecting backwards
    // We reverse the logic: txns are newest first. So as we go back in time, we revert the txn effects.
    const fullHistory = [{ val: currentBal, timestamp: Date.now() }];
    for (const tx of transactions) {
        const amt = parseFloat(ethers.formatUnits(tx.amount ? tx.amount.toString() : "0", 18));
        const isMint = tx.senderAddress === ethers.ZeroAddress;
        if (isMint) {
            runningBal -= amt;
        } else {
            runningBal -= amt;
        }
        fullHistory.push({ val: Math.max(0, runningBal), timestamp: tx.timestamp });
    }

    fullHistory.reverse(); // Now oldest -> newest

    let cutoff = 0;
    const now = Date.now();
    if (timeFilter === '1H') cutoff = now - 3600 * 1000;
    else if (timeFilter === '1D') cutoff = now - 86400 * 1000;
    else if (timeFilter === '7D') cutoff = now - 7 * 86400 * 1000;
    else if (timeFilter === '30D') cutoff = now - 30 * 86400 * 1000;
    else if (timeFilter === '1Y') cutoff = now - 365 * 86400 * 1000;

    const history = cutoff === 0 ? fullHistory : fullHistory.filter(h => h.timestamp >= cutoff);
    if (history.length === 0 && fullHistory.length > 0) history.push(fullHistory[fullHistory.length - 1]);
    if (history.length === 1) history.unshift({ val: history[0].val, timestamp: cutoff || history[0].timestamp - 1000 });

    useEffect(() => {
        if (history.length > 0) {
            const startVal = history[0].val;
            const endVal = history[history.length - 1].val;
            const absoluteDelta = endVal - startVal;
            const percentDelta = startVal === 0 ? (absoluteDelta > 0 ? 100 : 0) : (absoluteDelta / Math.max(startVal, 0.0000001)) * 100;
            if (onDeltaCalculated) onDeltaCalculated({ absolute: absoluteDelta, percent: percentDelta });
        }
    }, [balance, transactions, timeFilter]);

    const maxVal = Math.max(...history.map(h => h.val), 0.1);

    const width = 1000;
    const height = 150;

    const points = history.map((pt, i) => {
        const x = (i / Math.max(1, history.length - 1)) * width;
        const y = height - ((pt.val / maxVal) * height * 0.8) - 10; // 10px padding
        return `${x},${y}`;
    }).join(' ');

    const getHoverData = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        let percentX = (e.clientX - rect.left) / rect.width;
        percentX = Math.max(0, Math.min(1, percentX));

        const floatIndex = percentX * (history.length - 1);
        const index = Math.round(floatIndex);

        const pt = history[index];
        const svgX = (index / Math.max(1, history.length - 1)) * width;
        const svgY = height - ((pt.val / maxVal) * height * 0.8) - 10;

        setHoverPos({
            x: percentX * 100,
            val: pt.val,
            timestamp: pt.timestamp,
            svgX,
            svgY
        });
    };

    return (
        <div
            style={{ width: '100%', height: '150px', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '12px', border: '1px solid var(--border-soft)', overflow: 'hidden', position: 'relative', cursor: 'crosshair', marginTop: '1.5rem' }}
            onMouseMove={getHoverData}
            onMouseLeave={() => setHoverPos(null)}
        >
            <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
                <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(192, 132, 252, 0.4)" />
                        <stop offset="100%" stopColor="rgba(192, 132, 252, 0)" />
                    </linearGradient>
                </defs>
                <polyline points={`0,${height} ${points} ${width},${height}`} fill="url(#chartGradient)" />
                <polyline points={points} fill="none" stroke="#c084fc" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                {hoverPos && (
                    <>
                        <line x1={hoverPos.svgX} y1="0" x2={hoverPos.svgX} y2={height} stroke="rgba(255,255,255,0.25)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeDasharray="4 4" />
                        <circle cx={hoverPos.svgX} cy={hoverPos.svgY} r="6" fill="#0f172a" stroke="#c084fc" strokeWidth="3" vectorEffect="non-scaling-stroke" />
                    </>
                )}
            </svg>

            {hoverPos && (
                <div style={{
                    position: 'absolute',
                    left: `${hoverPos.x}%`,
                    top: '10px',
                    transform: `translateX(${hoverPos.x > 80 ? '-110%' : '10%'})`,
                    background: 'rgba(15, 23, 42, 0.9)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(192, 132, 252, 0.5)',
                    padding: '0.4rem 0.8rem',
                    borderRadius: '8px',
                    color: '#fff',
                    fontWeight: 'bold',
                    fontSize: '0.85rem',
                    pointerEvents: 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    zIndex: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        {parseFloat(hoverPos.val).toFixed(6)} <VeriIcon size={12} />
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 'normal' }}>
                        {new Date(hoverPos.timestamp).toLocaleString()}
                    </div>
                </div>
            )}
        </div>
    );
};


const WalletView = () => {
    const activeTab = useStore(s => s.activeWalletTab);
    const web3Account = useStore(s => s.web3Account);
    const [walletData, setWalletData] = useState({ balance: 0, emissionRate: 0, transactions: [], stakes: [], totalPages: 1 });
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [timeFilter, setTimeFilter] = useState('All');
    const [deltaObj, setDeltaObj] = useState({ absolute: 0, percent: 0 });
    const dispatch = useStore(s => s.dispatch);

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
                        stakes: data.stakes || [],
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
    const formatVeri = (num, iconSize = 32, prefix = '') => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            {prefix}{parseFloat(ethers.formatUnits(num ? num.toString() : "0", 18)).toFixed(6)} <VeriIcon size={iconSize} />
        </span>
    );
    const formatDate = (ts) => new Date(ts).toLocaleString();

    return (
        <div style={{ padding: '0', maxWidth: '1400px', margin: '0 auto', color: '#f8fafc', height: '100%', display: 'flex', flexDirection: 'column', width: '100%' }}>
            <div style={{ width: '100%', maxWidth: '1400px', margin: '0 auto' }}>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#8b9bb4' }}>Syncing Global Ledger Arrays...</div>
                ) : error ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#f87171' }}>{error}</div>
                ) : (
                    <>
                        <div style={{ display: 'flex', gap: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '2rem', padding: '0 1rem' }}>
                            <button 
                                onClick={() => dispatch({ type: 'SET_WALLET_TAB', payload: 'dashboard' })}
                                style={{ background: 'transparent', border: 'none', borderBottom: (activeTab === 'dashboard' || activeTab === 'overview') ? '2px solid #818cf8' : '2px solid transparent', color: (activeTab === 'dashboard' || activeTab === 'overview') ? '#818cf8' : 'var(--text-muted)', padding: '1rem 0', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontSize: '1rem' }}
                            >Portfolio Overview</button>
                            <button 
                                onClick={() => dispatch({ type: 'SET_WALLET_TAB', payload: 'staking' })}
                                style={{ background: 'transparent', border: 'none', borderBottom: activeTab === 'staking' ? '2px solid #818cf8' : '2px solid transparent', color: activeTab === 'staking' ? '#818cf8' : 'var(--text-muted)', padding: '1rem 0', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontSize: '1rem' }}
                            >Staking & Nodes</button>
                        </div>

                        {(activeTab === 'dashboard' || activeTab === 'overview') && (
                            <div className="wallet-dashboard-content">
                                {/* Top Row: Analytical Float Arrays */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                            <div className="glass-panel" style={{ padding: '2rem', borderRadius: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <h3 style={{ color: '#818cf8', fontSize: '1rem', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '1rem' }}>Balance</h3>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fff', textShadow: '0 0 15px rgba(255,255,255,0.2)' }}>
                                                {formatVeri(walletData.balance)}
                                            </div>
                                            {deltaObj.absolute !== 0 && (
                                                <div style={{
                                                    background: deltaObj.absolute > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                                    color: deltaObj.absolute > 0 ? '#10b981' : '#ef4444',
                                                    padding: '0.5rem 1rem',
                                                    borderRadius: '100px',
                                                    fontWeight: 'bold',
                                                    fontSize: '1rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.4rem',
                                                    boxShadow: deltaObj.absolute > 0 ? '0 0 15px rgba(16, 185, 129, 0.1)' : '0 0 15px rgba(239, 68, 68, 0.1)'
                                                }}>
                                                    {deltaObj.absolute > 0 ? '▲' : '▼'} {Math.abs(deltaObj.percent).toFixed(2)}%
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Temporal Bounding Matrix */}
                                    <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.03)', padding: '0.25rem', borderRadius: '100px' }}>
                                        {['1H', '1D', '7D', '30D', '1Y', 'All'].map(filter => (
                                            <button
                                                key={filter}
                                                onClick={() => setTimeFilter(filter)}
                                                style={{
                                                    padding: '0.4rem 1rem',
                                                    background: timeFilter === filter ? 'rgba(192, 132, 252, 0.2)' : 'transparent',
                                                    color: timeFilter === filter ? '#c084fc' : '#64748b',
                                                    border: 'none',
                                                    borderRadius: '100px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 'bold',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                {filter}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <PortfolioChart
                                    transactions={walletData.transactions}
                                    balance={walletData.balance}
                                    timeFilter={timeFilter}
                                    onDeltaCalculated={setDeltaObj}
                                />
                            </div>
                        </div>

                        {/* Bottom Row: Transaction Ledger Integration */}
                        <div className="glass-panel" style={{ padding: '2.5rem', borderRadius: '16px' }}>
                            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--text-main)' }}>Isolated TxHistory</h2>

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
                                                <div key={idx} className="data-row status-confirmed" onClick={() => {
                                                    dispatch({ type: 'SET_MODAL_OPEN', payload: { isOpen: true, hash: tx.hash } });
                                                }} style={{ display: 'grid', gridTemplateColumns: '1.5fr 2fr 1fr 1.5fr', alignItems: 'center', padding: '1rem 1.5rem', cursor: 'pointer', animation: `staggerFadeUp 0.3s ease-out ${idx * 0.03}s both` }}>
                                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                                        {formatDate(tx.timestamp)}
                                                    </div>
                                                    <div style={{ fontFamily: 'monospace', color: 'var(--text-main)', fontSize: '0.85rem' }}>
                                                        {tx.hash.substring(0, 16)}...
                                                    </div>
                                                    <div style={{ color: isMint ? '#10b981' : 'var(--text-main)', fontWeight: isMint ? 600 : 400, fontFamily: 'monospace', display: 'flex', alignItems: 'center' }}>
                                                        {formatVeri(tx.amount, 14, isMint ? '+' : '')}
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
                        </div>
                        )}

                        {activeTab === 'staking' && (
                            <div className="wallet-staking-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div className="glass-panel" style={{ padding: '2.5rem', borderRadius: '16px', textAlign: 'center' }}>
                                    <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--text-main)' }}>Staking Portal</h2>
                                    <p style={{ color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto 2rem', lineHeight: '1.6' }}>
                                        Lock your VERI tokens to participate in network consensus or operate a decentralized storage node. Staked tokens are frozen to ensure network reliability and deter malicious behavior.
                                    </p>
                                    
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginTop: '2rem', textAlign: 'left' }}>
                                        {(() => {
                                            const hasStorageStake = walletData.stakes.some(s => s.type === 'STAKING_CONTRACT');
                                            const hasValidatorStake = walletData.stakes.some(s => s.type === 'VALIDATOR_REGISTRATION');
                                            return (
                                                <>
                                                    <div style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--border-soft)', padding: '1.5rem', borderRadius: '12px' }}>
                                            <h3 style={{ color: '#c084fc', marginBottom: '0.5rem', fontSize: '1.1rem' }}>Storage Node</h3>
                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Bid on storage contracts and earn 90% of system rewards by hosting physical data chunks.</p>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Required Stake</span>
                                                <span style={{ color: '#fff', fontWeight: 'bold' }}>100 VERI</span>
                                            </div>
                                            {hasStorageStake ? (
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '8px', fontWeight: 'bold' }}>
                                                    ✓ Already Registered
                                                </div>
                                            ) : (
                                                <button className="primary-btn" style={{ width: '100%', borderRadius: '8px' }}>Register Storage Node</button>
                                            )}
                                        </div>
                                        
                                        <div style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--border-soft)', padding: '1.5rem', borderRadius: '12px' }}>
                                            <h3 style={{ color: '#38bdf8', marginBottom: '0.5rem', fontSize: '1.1rem' }}>Validator Auditor</h3>
                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Run a lightweight watchdog node to verify mathematical proofs and earn 10% of system rewards.</p>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Required Stake</span>
                                                <span style={{ color: '#fff', fontWeight: 'bold' }}>100 VERI</span>
                                            </div>
                                            {hasValidatorStake ? (
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', borderRadius: '8px', fontWeight: 'bold' }}>
                                                    ✓ Already Registered
                                                </div>
                                            ) : (
                                                <button className="secondary-btn" style={{ width: '100%', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.5)', color: '#38bdf8', background: 'transparent' }}>Register Validator</button>
                                            )}
                                        </div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                                
                                <div className="glass-panel" style={{ padding: '2.5rem', borderRadius: '16px' }}>
                                    <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--text-main)' }}>Active Stakes</h3>
                                    
                                    {walletData.stakes.length === 0 ? (
                                        <div style={{ color: '#64748b', fontStyle: 'italic', textAlign: 'center', padding: '2rem 0' }}>No active node stakes detected for this wallet.</div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            {walletData.stakes.map((stake, idx) => (
                                                <div key={idx} onClick={() => {
                                                    dispatch({ type: 'SET_MODAL_OPEN', payload: { isOpen: true, hash: stake.hash } });
                                                }} className="data-row status-confirmed" style={{ display: 'grid', gridTemplateColumns: '1.5fr 2fr 1fr', alignItems: 'center', padding: '1rem 1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border-soft)', cursor: 'pointer' }}>
                                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                                        {formatDate(stake.timestamp)}
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <span style={{ 
                                                            padding: '0.25rem 0.75rem', 
                                                            borderRadius: '100px', 
                                                            fontSize: '0.75rem', 
                                                            fontWeight: 'bold',
                                                            background: stake.type === 'STAKING_CONTRACT' ? 'rgba(249, 115, 22, 0.15)' : 'rgba(156, 163, 175, 0.15)',
                                                            color: stake.type === 'STAKING_CONTRACT' ? '#fb923c' : '#9ca3af'
                                                        }}>
                                                            {stake.type === 'STAKING_CONTRACT' ? 'Stake' : 'Validator'}
                                                        </span>
                                                    </div>
                                                    <div style={{ textAlign: 'right', fontWeight: 'bold', color: '#fff', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                                                        {formatVeri(stake.amount, 14, '🔒 ')}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default WalletView;
