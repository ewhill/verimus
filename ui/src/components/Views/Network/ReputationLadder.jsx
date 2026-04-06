import React from 'react';

const ReputationLadder = ({ peers, error, otherPeers, connectedPeers }) => {
    // Sort peers consistently charting the highest reputation natively
    const sortedPeers = [...peers].sort((a, b) => {
        if (a.status === 'self') return -1;
        if (b.status === 'self') return 1;
        const scoreA = a.score !== undefined ? a.score : 0;
        const scoreB = b.score !== undefined ? b.score : 0;
        return scoreB - scoreA;
    });

    return (
        <section className="glass-panel stagger-2">
            <div className="section-header">
                <h2>Global Reputation Ladder</h2>
            </div>
            
            <div className="peer-list-container">
                {error && <p style={{ color: '#ef4444' }}>Failed to load peer network data.</p>}
                
                {!error && peers.length === 0 && <div style={{ color: '#64748b' }}>Loading peers...</div>}
                
                {!error && peers.length > 0 && otherPeers.length === 0 && (
                    <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', gridColumn: '1 / -1' }}>
                        <strong>No discovery attempted.</strong> Make sure other nodes are configured for discovery.
                    </div>
                )}
                
                {!error && otherPeers.length > 0 && connectedPeers.length === 0 && (
                    <div style={{ padding: '1rem', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', borderRadius: '8px', gridColumn: '1 / -1' }}>
                        <strong>No peers currently connected.</strong> Waiting for other nodes to join the network...
                    </div>
                )}
                
                {!error && sortedPeers.map((peer, i) => {
                    let isBanned = peer.isBanned || peer.score === 0;
                    let bg = peer.status === 'self' ? 'rgba(99, 102, 241, 0.05)' : isBanned ? 'rgba(239, 68, 68, 0.05)' : '';
                    let border = peer.status === 'self' ? 'var(--primary)' : isBanned ? '#ef4444' : '';
                    let badgeBg = isBanned ? 'rgba(239, 68, 68, 0.2)' : peer.status === 'connected' ? 'rgba(16, 185, 129, 0.1)' : peer.status === 'disconnected' ? 'rgba(239, 68, 68, 0.1)' : '';
                    
                    return (
                        <div key={i} className="block-card peer-info redesigned" style={{ background: bg, borderColor: border }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <span style={{ 
                                    background: badgeBg, 
                                    color: isBanned ? '#ef4444' : peer.status === 'connected' ? '#10b981' : peer.status === 'disconnected' ? '#ef4444' : '#a5b4fc',
                                    padding: '0.2rem 0.6rem', 
                                    borderRadius: '100px', 
                                    fontSize: '0.75rem',
                                    fontWeight: 600
                                }}>
                                    {isBanned ? 'SLASHED' : peer.status.toUpperCase()}
                                </span>
                                {peer.score !== undefined && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                         <div style={{ width: '60px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                                              <div style={{ width: `${Math.max(0, peer.score)}%`, height: '100%', background: peer.score > 50 ? '#10b981' : peer.score > 0 ? '#f59e0b' : '#ef4444' }} />
                                         </div>
                                         <span style={{ fontSize: '0.8rem', fontWeight: 600, color: peer.score > 50 ? '#10b981' : peer.score > 0 ? '#f59e0b' : '#ef4444' }}>
                                             {peer.score}/100
                                         </span>
                                    </div>
                                )}
                            </div>
                            <h4>{peer.address} {peer.status === 'self' ? '(You)' : ''}</h4>
                            <div style={{ marginTop: 'auto', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                    Wallet: {peer.walletAddress ? `${peer.walletAddress.substring(0, 10)}...${peer.walletAddress.substring(34)}` : 'N/A'}
                                </span>
                                {peer.strikeCount > 0 && (
                                    <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 600 }}>
                                        Strikes: {peer.strikeCount}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
};

export default ReputationLadder;
