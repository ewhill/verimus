import React from 'react';
import PropertyValue from './PropertyValue';

const StorageContractPayload = ({ payloadData, payloadError, handleSingleFileDownload }) => {
    if (payloadError) {
        return <div style={{ padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px dashed #ef4444', color: '#ef4444', fontSize: '0.85rem', textAlign: 'center' }}>Decryption failed: Node is not an authorized recipient.</div>;
    }

    if (!payloadData) return null;

    const p = payloadData;

    let storageType = 'local';
    let storagePath = p.location || 'Local Storage';
    if (typeof p.location === 'object') {
        storageType = p.location.type || 'Unknown';
        storagePath = p.location.storageDir || p.location.bucket || p.location.vaultName || p.location.share || p.location.host || p.location.remoteDir || 'Default';
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '0.75rem' }}>AES-256-GCM Properties</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, max-content) 1fr', gap: '0.5rem 1rem', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Key:</span>
                    <PropertyValue className="success" value={p.key} />

                    <span style={{ color: 'var(--text-muted)' }}>IV:</span>
                    <PropertyValue className="success" value={p.iv || 'Not designated'} />

                    <span style={{ color: 'var(--text-muted)' }}>Auth Tag:</span>
                    <PropertyValue className="success" value={p.authTag || 'N/A'} />

                    <span style={{ color: 'var(--text-muted)' }}>Storage Type:</span>
                    <PropertyValue value={storageType} copyable={false} />

                    <span style={{ color: 'var(--text-muted)' }}>Storage Location:</span>
                    <PropertyValue value={storagePath} />

                    <span style={{ color: 'var(--text-muted)' }}>Storage Physical ID:</span>
                    <PropertyValue value={p.physicalId || 'Generic'} />
                </div>
            </div>

            <div>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '0.75rem' }}>Encrypted Files</span>
                {(!p.files || p.files.length === 0) ? (
                    <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>No individual files tracked in payload</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.5rem', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 'var(--radius-md)' }}>
                        {p.files.map((f, idx) => (
                            <div key={idx} style={{ padding: '0.6rem 1rem', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="file-row-hover">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', overflow: 'hidden' }}>
                                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.path}</span>
                                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.contentHash || 'Unknown'}</span>
                                </div>
                                <button onClick={(e) => handleSingleFileDownload(e, f.path)} className="download-icon-hover" style={{ cursor: 'pointer', padding: '0.3rem', flexShrink: 0, marginLeft: '1rem', background: 'transparent', border: 'none', color: 'inherit' }} title="Decrypt and Download Native Extract">
                                    <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: '16px', height: '16px' }}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StorageContractPayload;
