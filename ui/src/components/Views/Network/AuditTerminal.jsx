import React, { useState, useEffect, useRef } from 'react';

const AuditTerminal = () => {
    const [auditLogs, setAuditLogs] = useState([]);
    const terminalEndRef = useRef(null);

    useEffect(() => {
        if (terminalEndRef.current) terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }, [auditLogs]);

    useEffect(() => {
        let eventSource = null;
        try {
            eventSource = new EventSource('/api/audit/events');
            eventSource.onmessage = (e) => {
                try {
                    const data = JSON.parse(e.data);
                    setAuditLogs(prev => {
                        // Prevent identical back-to-back bounds organically
                        if (prev.length > 0 && prev[prev.length - 1].status === data.status && prev[prev.length - 1].message === data.message) return prev;
                        const newLogs = [...prev, data];
                        if (newLogs.length > 100) return newLogs.slice(newLogs.length - 100);
                        return newLogs;
                    });
                } catch (_unusedErr) { 
                    // Suppress JSON parse failures natively
                }
            };
        } catch (e) {
            console.warn("EventSource tracking dynamically suppressed:", e);
        }

        return () => {
            if (eventSource) eventSource.close();
        };
    }, []);

    return (
        <section className="glass-panel stagger-3">
            <div className="section-header">
                <h2>Proof of Spacetime Audit Terminal</h2>
            </div>
            <div className="crypto-terminal" style={{ background: '#0a0a0a', padding: '1rem', borderRadius: '0.5rem', border: '1px solid rgba(0, 255, 255, 0.2)', fontFamily: 'monospace', fontSize: '0.85rem', color: '#e2e8f0', height: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                <div style={{ color: 'rgba(0, 255, 255, 0.7)', marginBottom: '0.75rem', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '1px', flexShrink: 0, position: 'sticky', top: 0, background: '#0a0a0a', zIndex: 10, paddingBottom: '0.5rem', borderBottom: '1px solid rgba(0, 255, 255, 0.2)' }}>Sortition Telemetry Feed</div>
                <div style={{ flex: 1 }}>
                    {auditLogs.length === 0 && <div style={{ color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>Awaiting initial global sortition period mapped mathematically...</div>}
                    {auditLogs.map((log, idx) => {
                        let color = '#cbd5e1';
                        if (log.status === 'ELECTION_INITIATED') color = '#a855f7';
                        else if (log.status === 'CHALLENGE_DISPATCHED') color = '#3b82f6';
                        else if (log.status === 'AUDIT_SUCCESS') color = '#10b981';
                        else if (log.status === 'SLASHING_EXECUTED') color = '#ef4444';
                        
                        return (
                            <div key={idx} style={{ marginBottom: '0.5rem', display: 'flex', flexDirection: 'column' }}>
                                <div>
                                    <span style={{ color, fontWeight: 600 }}>[{log.status}]</span> <span style={{ opacity: 0.9 }}>{log.message}</span>
                                </div>
                                {log.targetPeer && (
                                    <div style={{ paddingLeft: '1rem', color: '#64748b', fontSize: '0.75rem', marginTop: '0.1rem' }}>
                                        ↳ Target Node: {log.targetPeer}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    <div ref={terminalEndRef} />
                </div>
            </div>
        </section>
    );
};

export default AuditTerminal;
