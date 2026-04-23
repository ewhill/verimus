import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useStore } from '../../../store';

const EpochTelemetryWidget = () => {
    const dispatch = useStore(s => s.dispatch);
    const [metrics, setMetrics] = useState({
        currentIndex: 0,
        epochSize: 1000000,
        peers: 0,
        epoch: 1,
        gasPrice: '0.01',
        databaseFootprintBytes: 0,
        loading: true,
        error: false
    });

    const fetchMetrics = async () => {
        try {
            const [ledgerRes, peersRes] = await Promise.all([
                fetch('/api/ledger/metrics').catch(() => ({ json: () => ({ metrics: {} }) })),
                fetch('/api/peers').catch(() => ({ json: () => ({ peers: [] }) }))
            ]);

            const data = ledgerRes && ledgerRes.status === 200 ? await ledgerRes.json() : { metrics: {} };
            const peersObj = peersRes && peersRes.status === 200 ? await peersRes.json() : { peers: [] };

            if (data.success || !data.error) {
                setMetrics({
                    currentIndex: data.currentIndex || data.metrics?.totalBlocks || 0,
                    epochSize: data.epochSize || 1000000,
                    databaseFootprintBytes: data.databaseFootprintBytes || 0,
                    peers: peersObj.peers?.length || 0,
                    epoch: 1,
                    gasPrice: '0.01',
                    emissionRate: data.emissionRate || 0,
                    loading: false,
                    error: false
                });
            }
        } catch {
            setMetrics(prev => ({ ...prev, loading: false, error: true }));
        }
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchMetrics();
        const interval = setInterval(fetchMetrics, 5000);
        return () => clearInterval(interval);
    }, []);

    const calculateProgress = () => {
        if (metrics.epochSize === 0) return 0;
        const progress = (metrics.currentIndex % metrics.epochSize) / metrics.epochSize * 100;
        return Math.min(Math.max(progress, 0), 100).toFixed(4); // Display high precision
    };

    if (metrics.loading && metrics.currentIndex === 0) return null;

    return (
        <div className="stagger-1" style={{ padding: '0 0 2rem 0' }}>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                {/* Stats Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span style={{ color: '#3b82f6', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em' }}>VERIMUS EPOCH</span>
                        <span style={{ fontSize: '1.15rem', fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-main)' }}>{metrics.epoch}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em' }}>BLOCK HEIGHT</span>
                        <span style={{ fontSize: '1.15rem', fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-main)' }}>{metrics.currentIndex.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span style={{ color: '#8b5cf6', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em' }}>ACTIVE PEERS</span>
                        <span style={{ fontSize: '1.15rem', fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-main)' }}>{metrics.peers}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span style={{ color: '#eab308', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em' }}>$VERI GAS</span>
                        <span style={{ fontSize: '1.15rem', fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-main)' }}>{metrics.gasPrice}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span style={{ color: '#38bdf8', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em' }}>$VERI EMISSION</span>
                        <span style={{ fontSize: '1.15rem', fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-main)' }}>
                            {metrics.emissionRate ? parseFloat(ethers.formatUnits(metrics.emissionRate.toString(), 18)).toFixed(6) : '0.000000'}
                        </span>
                    </div>
                </div>

                {/* Trajectory */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', alignItems: 'center' }}>
                    <span style={{ color: '#e2e8f0', fontSize: '0.95rem', fontWeight: 500 }}>Epoch Trajectory</span>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, color: '#8b5cf6', fontSize: '0.95rem' }}>{calculateProgress()}%</span>
                    </div>
                </div>

                <div style={{ width: '100%', height: '10px', background: 'rgba(139, 92, 246, 0.15)', borderRadius: '5px', overflow: 'hidden', position: 'relative' }}>
                    <div style={{
                        position: 'absolute',
                        left: 0, top: 0, bottom: 0,
                        width: `${calculateProgress()}%`,
                        background: 'linear-gradient(90deg, #8b5cf6, #3b82f6)',
                        transition: 'width 0.5s ease-out'
                    }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem', fontSize: '0.8rem', color: '#64748b' }}>
                    <span>Block: {metrics.currentIndex.toLocaleString()}</span>
                    <span>Target: {(metrics.currentIndex + (metrics.epochSize - (metrics.currentIndex % metrics.epochSize))).toLocaleString()}</span>
                </div>
            </div>
        </div>
    );
};

export default EpochTelemetryWidget;
