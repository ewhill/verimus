import React, { useState, useEffect } from 'react';
import PropertyValue from './PropertyValue';

const StorageContractPayload = ({ block, payloadData, payloadError, handleSingleFileDownload, web3Account }) => {
    const publicPayload = block.payload || {};
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        const fetchMetrics = async () => {
            try {
                const res = await fetch('/api/ledger/metrics');
                if (res.ok) {
                    const data = await res.json();
                    setCurrentIndex(data.currentIndex || 0);
                }
            } catch (error) {
                console.error("Failed to fetch ledger metrics", error);
            }
        };
        fetchMetrics();
    }, []);

    const isOwnerContext = web3Account && (
        web3Account.toLowerCase() === (publicPayload.ownerAddress || '').toLowerCase() ||
        web3Account.toLowerCase() === (block.signerAddress || '').toLowerCase()
    );

    const ownerLabel = isOwnerContext ? 'You' : (publicPayload.ownerAddress || block.signerAddress);

    const safeBigInt = (val) => {
        if (val == null) return 0n;
        if (typeof val === 'object' && 'high' in val && 'low' in val) {
            const hi = BigInt(val.high);
            const lo = BigInt(val.low >>> 0); // Ensure unsigned 32-bit integer bits
            return (hi << 32n) | lo;
        }
        try {
            return BigInt(val);
        } catch (e) {
            return 0n;
        }
    };

    // Fallbacks and safe mathematical mappings for Escrow / Disbursements
    const allocatedRaw = safeBigInt(publicPayload.allocatedEgressEscrow);
    const remainingRaw = safeBigInt(publicPayload.remainingEgressEscrow);
    const disbursedRaw = allocatedRaw - remainingRaw > 0n ? allocatedRaw - remainingRaw : 0n;

    // Active Storage Nodes
    let storageNodes = [];
    if (publicPayload.activeHosts && publicPayload.activeHosts.length > 0) {
        storageNodes = publicPayload.activeHosts;
    } else if (publicPayload.fragmentMap && publicPayload.fragmentMap.length > 0) {
        storageNodes = [...new Set(publicPayload.fragmentMap.map(f => f.nodeId))];
    }

    const expirationHeight = safeBigInt(publicPayload.expirationBlockHeight);
    let blocksRemaining = 0n;
    if (expirationHeight > 0n && BigInt(currentIndex) > 0n) {
        blocksRemaining = expirationHeight - BigInt(currentIndex);
    }

    const parseTimeRemaining = (remainingBlocks) => {
        if (remainingBlocks <= 0n) return "Status: EXPIRED";
        const totalMs = Number(remainingBlocks) * 5000;
        const days = Math.floor(totalMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((totalMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        return `~${days} Days, ${hours} Hours`;
    };

    const durationDisplay = expirationHeight > 0n ? parseTimeRemaining(blocksRemaining) : "Perpetual";

    const renderPublicPrimaryData = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
            {expirationHeight > 0n && blocksRemaining > 0n && blocksRemaining < 17280n && (
                <div style={{ padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.5)', color: '#ef4444', fontSize: '0.85rem' }}>
                    <strong style={{ fontWeight: 600 }}>Warning:</strong> Your chronological escrow completes within 24 hours. Data is scheduled for verifiable physical deletion.
                </div>
            )}
            <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.1), rgba(15, 23, 42, 0.5))', border: '1px solid rgba(6, 182, 212, 0.2)' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#06b6d4', display: 'block', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Contract Bounds & Escrow</span>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, max-content) 1fr', gap: '0.75rem 1rem', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Originator / Owner:</span>
                    <PropertyValue className="highlight" value={ownerLabel} copyable={!isOwnerContext} />

                    <span style={{ color: 'var(--text-muted)' }}>Contract Duration:</span>
                    <PropertyValue value={durationDisplay} copyable={false} />

                    <span style={{ color: 'var(--text-muted)' }}>Initial Escrow:</span>
                    <PropertyValue className="success" value={`${allocatedRaw.toString()} WEI`} copyable={false} />

                    <span style={{ color: 'var(--text-muted)' }}>Total Disbursed:</span>
                    <PropertyValue value={`${disbursedRaw.toString()} WEI`} copyable={false} style={{ color: disbursedRaw > 0n ? '#ef4444' : 'var(--text-muted)' }} />

                    <span style={{ color: 'var(--text-muted)' }}>Storage Hosts:</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {storageNodes.length === 0 ? <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Pending Allocation</span> :
                            storageNodes.map((n, i) => <PropertyValue key={i} value={n} />)
                        }
                    </div>

                    <span style={{ color: 'var(--text-muted)' }}>Reward Wallets:</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {storageNodes.length === 0 ? <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Pending Allocation</span> :
                            storageNodes.map((n, i) => <span key={i} style={{ color: 'var(--text-secondary)' }}>Mapped dynamically via Host Reputations</span>)
                        }
                    </div>
                </div>
            </div>
        </div>
    );

    if (payloadError) {
        return (
            <>
                {renderPublicPrimaryData()}
                <div style={{ padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px dashed #ef4444', color: '#ef4444', fontSize: '0.85rem', textAlign: 'center' }}>Decryption failed: Node is not an authorized recipient.</div>
            </>
        );
    }

    if (!payloadData) return renderPublicPrimaryData();

    const p = payloadData;

    let storageType = 'local';
    let storagePath = p.location || 'Local Storage';
    if (typeof p.location === 'object') {
        storageType = p.location.type || 'Unknown';
        storagePath = p.location.storageDir || p.location.bucket || p.location.vaultName || p.location.share || p.location.host || p.location.remoteDir || 'Default';
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {renderPublicPrimaryData()}

            <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', background: 'rgba(15, 23, 42, 0.4)', border: '1px dashed rgba(255,255,255,0.1)' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '0.75rem' }}>Private AES-256-GCM Properties</span>
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
