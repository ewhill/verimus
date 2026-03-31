import React from 'react';

const ShardGraph = ({ fragmentMap }) => {
    if (!fragmentMap || fragmentMap.length === 0) return null;

    return (
        <div className="shard-graph-container" style={{ marginTop: '1.5rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h4 style={{ marginBottom: '1rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                Geographic Erasure Matrix ($K / $N)
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
                {fragmentMap.map((frag, idx) => (
                    <div key={idx} style={{ 
                        background: 'rgba(15, 23, 42, 0.6)', 
                        padding: '0.75rem', 
                        borderRadius: '0.35rem', 
                        border: '1px solid rgba(74, 222, 128, 0.3)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem',
                        position: 'relative',
                        overflow: 'hidden'
                    }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#4ade80' }}></div>
                        <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600, paddingLeft: '0.25rem' }}>SHARD #{frag.shardIndex + 1}</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#f8fafc', paddingLeft: '0.25rem' }}>Host: 0x{frag.nodeId?.slice(0, 8)}</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.25rem', paddingLeft: '0.25rem' }}>
                            Hash: {frag.shardHash?.slice(0, 16)}...
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ShardGraph;
