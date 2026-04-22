import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';

const GlobalStatsBanner = () => {
    const [stats, setStats] = useState({ height: 0, peers: 0, epoch: 0, gasPrice: '0.00' });

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [metricsRes, peersRes] = await Promise.all([
                    fetch('/api/ledger/metrics').catch(() => ({ json: () => ({ metrics: {} }) })),
                    fetch('/api/peers').catch(() => ({ json: () => ({ nodes: [] }) }))
                ]);
                const metricsObj = metricsRes && metricsRes.status === 200 ? await metricsRes.json() : { metrics: {} };
                const peersObj = peersRes && peersRes.status === 200 ? await peersRes.json() : { nodes: [] };

                setStats({
                    height: metricsObj.metrics?.totalBlocks || 0,
                    peers: peersObj.nodes?.length || 0,
                    epoch: 1, // Static protocol version for now
                    gasPrice: '0.01' // Simulated VERI gas fee
                });
            } catch (err) {
                // Squelch background errors gracefully
            }
        };

        fetchStats();
        const interval = setInterval(fetchStats, 8000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div style={{ background: 'var(--bg-darkest)', borderBottom: '1px solid var(--border-soft)', padding: '0.4rem 2rem', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'center', gap: '2rem', whiteSpace: 'nowrap', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#3b82f6', fontWeight: 600 }}>EPOCH</span> <span style={{ fontFamily: 'monospace', color: 'var(--text-main)' }}>{stats.epoch}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#10b981', fontWeight: 600 }}>BLOCK HEIGHT</span> <span style={{ fontFamily: 'monospace', color: 'var(--text-main)' }}>{stats.height}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#8b5cf6', fontWeight: 600 }}>ACTIVE PEERS</span> <span style={{ fontFamily: 'monospace', color: 'var(--text-main)' }}>{stats.peers}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#eab308', fontWeight: 600 }}>$VERI GAS</span> <span style={{ fontFamily: 'monospace', color: 'var(--text-main)' }}>{stats.gasPrice}</span>
            </div>
        </div>
    );
};

export default GlobalStatsBanner;
