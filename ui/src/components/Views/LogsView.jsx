import React, { useEffect, useState, useRef } from 'react';

const LogsView = () => {
    const [logs, setLogs] = useState([]);
    const [isAutoScrolling, setIsAutoScrolling] = useState(true);
    const terminalRef = useRef(null);

    const fetchLogs = async () => {
        try {
            const res = await fetch('/api/logs');
            if (res.ok) {
                const data = await res.json();
                setLogs(data);
            }
        } catch (error) {
            console.error('Failed to fetch logs:', error);
        }
    };

    useEffect(() => {
        fetchLogs();
        const poll = setInterval(fetchLogs, 2500);
        return () => clearInterval(poll);
    }, []);

    useEffect(() => {
        if (isAutoScrolling && terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [logs, isAutoScrolling]);

    const handleScroll = () => {
        if (!terminalRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = terminalRef.current;
        const isAtBottom = scrollHeight - scrollTop <= clientHeight + 10;
        
        if (!isAtBottom && isAutoScrolling) {
            setIsAutoScrolling(false);
        }
    };

    const formatTimestamp = (isoString) => {
        const date = new Date(isoString);
        const pad = (n) => n.toString().padStart(2, '0');
        return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    };

    return (
        <section className="glass-panel stagger-1">
            <div className="section-header stagger-1" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2>Node Diagnostic Logs</h2>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <label className="auto-scroll-toggle" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        <input 
                            type="checkbox" 
                            checked={isAutoScrolling}
                            onChange={(e) => setIsAutoScrolling(e.target.checked)}
                            style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                        />
                        Auto-scroll to bottom
                    </label>
                    <button onClick={fetchLogs} className="icon-btn" title="Refresh">↻</button>
                </div>
            </div>
            
            <p className="subtitle stagger-2" style={{ marginBottom: '1rem' }}>Viewing the last 200 node events securely streamed over Node memory buffers.</p>
            
            <div 
                className="terminal-container stagger-3" 
                ref={terminalRef}
                onScroll={handleScroll}
            >

                <div>
                    {logs.length === 0 ? (
                        <div style={{ color: '#64748b', textAlign: 'center', marginTop: '2rem' }}>Loading logs...</div>
                    ) : (
                        logs.map((log, idx) => {
                            const time = formatTimestamp(log.timestamp);
                            let levelColor = '#10b981';
                            if (log.level === 'INFO') levelColor = '#f8fafc';
                            if (log.level === 'WARN') levelColor = '#f59e0b';
                            if (log.level === 'ERROR') levelColor = '#ef4444';
                            
                            const msgColor = log.level === 'ERROR' ? '#ef4444' : '#e2e8f0';

                            return (
                                <div key={idx} style={{ marginBottom: '0.25rem', wordBreak: 'break-all' }}>
                                    <span style={{ color: '#818cf8', marginRight: '0.5rem' }}>[{time}]</span>
                                    <span style={{ marginRight: '0.5rem', fontWeight: 500, color: levelColor }}>{log.level}</span>
                                    <span style={{ color: msgColor }}>{log.message}</span>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </section>
    );
};

export default LogsView;
