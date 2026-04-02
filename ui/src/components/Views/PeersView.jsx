import React, { useEffect, useState, useRef } from 'react';
import GossipStatsPanel from './Network/GossipStatsPanel';
import ReputationLadder from './Network/ReputationLadder';
import AuditTerminal from './Network/AuditTerminal';
import ConsensusView from './ConsensusView';
import ContractsView from './ContractsView';
import { useStore } from '../../store';

const PeersView = () => {
    const [peers, setPeers] = useState([]);
    const [gossipTelemetry, setGossipTelemetry] = useState(null);
    const [error, setError] = useState(false);
    const canvasRef = useRef(null);
    const particlesRef = useRef([]);

    const [activeTab, setActiveTab] = useState('mesh');
    const nodeConfig = useStore(s => s.nodeConfig);

    const fetchPeers = async () => {
        try {
            const response = await fetch('/api/peers');
            const data = await response.json();
            if (data.success) {
                setPeers(data.peers);
                if (data.gossipTelemetry) setGossipTelemetry(data.gossipTelemetry);
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

                    // Generate dynamic particles epidemically simulating NetworkHealthSyncMessages natively
                    if (Math.random() < 0.05) {
                         particlesRef.current.push({
                              x: selfPeer.x, y: selfPeer.y,
                              tx: peer.x, ty: peer.y,
                              progress: 0,
                              speed: 0.02 + Math.random() * 0.03
                         });
                    }
                }
            });
        }

        // Animate propagating particles
        ctx.fillStyle = '#38bdf8';
        for (let i = particlesRef.current.length - 1; i >= 0; i--) {
            const p = particlesRef.current[i];
            p.progress += p.speed;
            if (p.progress >= 1) {
                particlesRef.current.splice(i, 1);
                continue;
            }
            const cx = p.x + (p.tx - p.x) * p.progress;
            const cy = p.y + (p.ty - p.y) * p.progress;
            
            ctx.beginPath();
            ctx.arc(cx, cy, 3, 0, Math.PI * 2);
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#38bdf8';
            ctx.fill();
            ctx.shadowBlur = 0;
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

    // Re-draw effectively mapping particles recursively 60fps natively
    useEffect(() => {
        let animationFrameId;
        
        const renderLoop = () => {
            if (activeTab === 'mesh') {
                drawNetwork();
            }
            animationFrameId = window.requestAnimationFrame(renderLoop);
        };
        renderLoop();

        return () => window.cancelAnimationFrame(animationFrameId);
    }, [peers, activeTab]);

    const otherPeers = peers.filter(p => p.status !== 'self');
    const connectedPeers = otherPeers.filter(p => p.status === 'connected');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
            {/* Segmented Tab Control */}
            <div className="section-header glass-panel" style={{ display: 'flex', justifyContent: 'center', padding: '1.25rem 2rem', borderRadius: 'var(--radius-lg)', margin: '0 0 1rem 0', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.3)' }}>
                <div className="segmented-control" style={{ display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: 'var(--radius-md)' }}>
                    <button 
                        className={`segmented-btn ${activeTab === 'mesh' ? 'active' : ''}`} 
                        onClick={() => setActiveTab('mesh')}
                        style={{ padding: '0.75rem 1.5rem', fontWeight: 600, fontSize: '0.9rem', width: 'auto' }}
                    >
                        Network Mesh
                    </button>
                    <button 
                        className={`segmented-btn ${activeTab === 'reputation' ? 'active' : ''}`} 
                        onClick={() => setActiveTab('reputation')}
                        style={{ padding: '0.75rem 1.5rem', fontWeight: 600, fontSize: '0.9rem', width: 'auto' }}
                    >
                        Global Reputation
                    </button>
                    <button 
                        className={`segmented-btn ${activeTab === 'audit' ? 'active' : ''}`} 
                        onClick={() => setActiveTab('audit')}
                        style={{ padding: '0.75rem 1.5rem', fontWeight: 600, fontSize: '0.9rem', width: 'auto' }}
                    >
                        Sortition Audits
                    </button>
                    {nodeConfig?.roles?.includes('VALIDATOR') && (
                        <button 
                            className={`segmented-btn ${activeTab === 'consensus' ? 'active' : ''}`} 
                            onClick={() => setActiveTab('consensus')}
                            style={{ padding: '0.75rem 1.5rem', fontWeight: 600, fontSize: '0.9rem', width: 'auto' }}
                        >
                            Mempool Monitor
                        </button>
                    )}
                    {nodeConfig?.roles?.includes('STORAGE') && (
                        <button 
                            className={`segmented-btn ${activeTab === 'contracts' ? 'active' : ''}`} 
                            onClick={() => setActiveTab('contracts')}
                            style={{ padding: '0.75rem 1.5rem', fontWeight: 600, fontSize: '0.9rem', width: 'auto' }}
                        >
                            Active Contracts
                        </button>
                    )}
                </div>
            </div>

            {activeTab === 'mesh' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
                    <GossipStatsPanel telemetry={gossipTelemetry} />
                    <section className="glass-panel stagger-1">
                        <div className="section-header">
                            <h2>Network Diagnostics</h2>
                        </div>
                        <div id="canvas-container" className="canvas-grid-bg" style={{ width: '100%', height: '400px', position: 'relative', overflow: 'hidden' }}>
                            <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }}></canvas>
                        </div>
                    </section>
                </div>
            )}

            {activeTab === 'reputation' && (
                <div style={{ width: '100%' }} className="stagger-1">
                    <ReputationLadder peers={peers} error={error} otherPeers={otherPeers} connectedPeers={connectedPeers} />
                </div>
            )}

            {activeTab === 'audit' && (
                <div style={{ width: '100%' }} className="stagger-1">
                    <AuditTerminal />
                </div>
            )}

            {activeTab === 'consensus' && nodeConfig?.roles?.includes('VALIDATOR') && (
                <div style={{ width: '100%' }} className="stagger-1">
                    <ConsensusView />
                </div>
            )}

            {activeTab === 'contracts' && nodeConfig?.roles?.includes('STORAGE') && (
                <div style={{ width: '100%' }} className="stagger-1">
                    <ContractsView />
                </div>
            )}
        </div>
    );
};

export default PeersView;
