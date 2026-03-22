import React, { useEffect, useState, useRef } from 'react';

const PeersView = () => {
    const [peers, setPeers] = useState([]);
    const [error, setError] = useState(false);
    const canvasRef = useRef(null);

    const fetchPeers = async () => {
        try {
            const response = await fetch('/api/peers');
            const data = await response.json();
            if (data.success) {
                setPeers(data.peers);
                setError(false);
            }
        } catch (error) {
            console.error('Failed to fetch peers:', error);
            setError(true);
        }
    };

    useEffect(() => {
        fetchPeers();
        const poll = setInterval(fetchPeers, 5000);
        return () => clearInterval(poll);
    }, []);

    const drawNetwork = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        // Sync canvas internal resolution with CSS
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) * 0.7;

        const renderedPeers = peers.map((peer, index) => {
            const angle = (index / peers.length) * 2 * Math.PI;
            return {
                ...peer,
                x: centerX + radius * Math.cos(angle),
                y: centerY + radius * Math.sin(angle)
            };
        });

        const selfPeer = renderedPeers.find(p => p.status === 'self');
        
        // Draw lines
        if (selfPeer) {
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
            ctx.lineWidth = 1;
            renderedPeers.forEach(peer => {
                if (peer !== selfPeer && peer.status === 'connected') {
                    ctx.beginPath();
                    ctx.moveTo(selfPeer.x, selfPeer.y);
                    ctx.lineTo(peer.x, peer.y);
                    ctx.stroke();
                }
            });
        }

        // Draw nodes
        renderedPeers.forEach(peer => {
            ctx.beginPath();
            ctx.arc(peer.x, peer.y, 8, 0, 2 * Math.PI);
            
            if (peer.status === 'self') {
                ctx.fillStyle = '#6366f1';
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#6366f1';
            } else if (peer.isBanned || peer.score === 0) {
                ctx.fillStyle = '#b91c1c';
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#b91c1c';
            } else if (peer.status === 'connected') {
                ctx.fillStyle = '#10b981';
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#10b981';
            } else {
                ctx.fillStyle = '#ef4444';
                ctx.shadowBlur = 0;
            }
            
            ctx.fill();
            ctx.shadowBlur = 0; 
            ctx.fillStyle = '#cbd5e1';
            ctx.font = '500 11px Inter, system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(peer.address, peer.x, peer.y + 25);
        });
    };

    // Re-draw essentially on resize or peers update
    useEffect(() => {
        drawNetwork();
        
        const handleResize = () => drawNetwork();
        window.addEventListener('resize', handleResize);
        // double-trigger to capture dynamic flex bounds instantly
        const t = setTimeout(drawNetwork, 50);
        return () => {
            window.removeEventListener('resize', handleResize);
            clearTimeout(t);
        };
    }, [peers]);

    const otherPeers = peers.filter(p => p.status !== 'self');
    const connectedPeers = otherPeers.filter(p => p.status === 'connected');

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
            <section className="glass-panel stagger-1">
                <div className="section-header">
                    <h2>Network</h2>
                </div>
                <div id="canvas-container" className="canvas-grid-bg" style={{ width: '100%', height: '350px', position: 'relative', overflow: 'hidden' }}>
                    <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }}></canvas>
                </div>
            </section>
            
            <section className="glass-panel stagger-2">
                <div className="section-header">
                    <h2>Peer Connections</h2>
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
                    
                    {!error && peers.map((peer, i) => {
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
                                        {isBanned ? 'BANNED' : peer.status.toUpperCase()}
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
                                        Signature: {peer.signature ? `${peer.signature.substring(0, 32)}...` : 'N/A'}
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
        </div>
    );
};

export default PeersView;
