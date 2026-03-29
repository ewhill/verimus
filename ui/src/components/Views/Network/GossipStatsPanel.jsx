import React from 'react';

const GossipStatsPanel = ({ telemetry }) => {
    if (!telemetry) return null;
    return (
        <section className="glass-panel stagger-1">
            <div className="section-header">
                <h2>Epidemic Gossip Engine</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                <div className="block-card" style={{ background: 'rgba(192, 132, 252, 0.05)', border: '1px solid rgba(192, 132, 252, 0.2)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '0.75rem', color: '#c084fc', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>LRU Cache Filter</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, margin: '0.5rem 0', color: '#f8fafc' }}>
                        {telemetry.messageCacheSize} <span style={{fontSize: '1rem', color: '#64748b'}}>/ 5000</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 'auto' }}>Seen Messages Dropped</div>
                </div>
                
                <div className="block-card" style={{ background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Discovery Mesh</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, margin: '0.5rem 0', color: '#f8fafc' }}>
                        {telemetry.discoveryBookSize}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 'auto' }}>PEX Address Book Entries</div>
                </div>
                
                <div className="block-card" style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Network Connectivity</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, margin: '0.5rem 0', color: '#f8fafc' }}>
                        {telemetry.maxPeers}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 'auto' }}>Max Socket Threshold</div>
                </div>
            </div>
        </section>
    );
};

export default GossipStatsPanel;
