import React, { useState, useEffect } from 'react';

const EpochTelemetryWidget = () => {
    const [metrics, setMetrics] = useState({
        currentIndex: 0,
        epochSize: 1000000,
        databaseFootprintBytes: 0,
        loading: true,
        error: false
    });

    const fetchMetrics = async () => {
        try {
            const res = await fetch('/api/ledger/metrics');
            const data = await res.json();
            if (data.success) {
                setMetrics({
                    currentIndex: data.currentIndex || 0,
                    epochSize: data.epochSize || 1000000,
                    databaseFootprintBytes: data.databaseFootprintBytes || 0,
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

    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const calculateProgress = () => {
        if (metrics.epochSize === 0) return 0;
        const progress = (metrics.currentIndex % metrics.epochSize) / metrics.epochSize * 100;
        return Math.min(Math.max(progress, 0), 100).toFixed(4); // Display high precision
    };

    if (metrics.loading && metrics.currentIndex === 0) return null;

    return (
        <div className="glass-panel stagger-1" style={{ padding: '1.5rem 2rem', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderLeft: '4px solid #8b5cf6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h3 style={{ margin: 0, color: '#e2e8f0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg style={{ width: '18px', height: '18px', color: '#8b5cf6' }} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z" />
                        </svg>
                        Continuous State Memory Pruning
                    </h3>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>Tracking physical MongoDB O(1) evaporation boundaries.</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f8fafc', letterSpacing: '1px' }}>
                        {formatBytes(metrics.databaseFootprintBytes)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Active Disk Footprint</div>
                </div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                    <span style={{ color: '#cbd5e1' }}>Epoch Trajectory</span>
                    <span style={{ fontWeight: 600, color: '#8b5cf6' }}>{calculateProgress()}%</span>
                </div>
                
                <div style={{ width: '100%', height: '8px', background: 'rgba(139, 92, 246, 0.15)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                    <div style={{ 
                        position: 'absolute', 
                        left: 0, top: 0, bottom: 0, 
                        width: `${calculateProgress()}%`, 
                        background: 'linear-gradient(90deg, #8b5cf6, #3b82f6)',
                        transition: 'width 0.5s ease-out'
                    }} />
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
                    <span>Block: {metrics.currentIndex.toLocaleString()}</span>
                    <span>Target: {(metrics.currentIndex + (metrics.epochSize - (metrics.currentIndex % metrics.epochSize))).toLocaleString()}</span>
                </div>
            </div>
        </div>
    );
};

export default EpochTelemetryWidget;
