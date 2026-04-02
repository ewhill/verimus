/* eslint-disable react-hooks/set-state-in-effect */
import { useStore } from '../../store';
import { ApiService } from '../../services/api';
import { decryptAndUnzip } from '../../utils/bundler';
import { decryptAESCore } from '../../utils/web3';
import * as fflate from 'fflate';

const PropertyValue = ({ value, className = '', copyable = true, style = {} }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = (e) => {
        e.preventDefault();
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div style={{ position: 'relative', width: '100%', boxSizing: 'border-box' }}>
            <pre className={`property-value ${className}`} style={{ ...style, ...(copyable ? { paddingRight: '2.5rem' } : {}) }}>
                {value}
            </pre>
            {copyable && (
                <button
                    onClick={handleCopy}
                    title="Copy to clipboard"
                    style={{
                        position: 'absolute', top: '0.35rem', right: '0.35rem',
                        background: copied ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                        border: 'none', color: copied ? 'var(--success)' : 'var(--text-muted)',
                        cursor: 'pointer', padding: '0.3rem', borderRadius: '4px',
                        display: 'flex', alignItems: 'center', transition: 'color 0.2s',
                        zIndex: 2
                    }}
                >
                    {copied ? (
                        <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: '16px', height: '16px' }}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                    ) : (
                        <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: '16px', height: '16px' }}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" /></svg>
                    )}
                </button>
            )}
        </div>
    );
};

const BlockModal = () => {
    const dispatch = useStore(s => s.dispatch);
    const isModalOpen = useStore(s => s.isModalOpen);
    const selectedBlockHash = useStore(s => s.selectedBlockHash);
    const blocks = useStore(s => s.blocks);
    const nodeConfig = useStore(s => s.nodeConfig);
    const web3Account = useStore(s => s.web3Account);

    const [isFetchingPayload, setIsFetchingPayload] = useState(false);
    const [payloadData, setPayloadData] = useState(null);
    const [payloadError, setPayloadError] = useState(false);
    const fetchedHashRef = useRef(null);

    useEffect(() => {
        if (isModalOpen && selectedBlockHash) {
            const pkg = blocks.find(b => b.hash === selectedBlockHash);
            const isOwner = nodeConfig && nodeConfig.publicKey === pkg?.publicKey;

            if (pkg?.type === 'STORAGE_CONTRACT' && isOwner && fetchedHashRef.current !== selectedBlockHash) {
                fetchedHashRef.current = selectedBlockHash;
                setIsFetchingPayload(true);
                setPayloadError(false);
                ApiService.fetchPrivatePayload(selectedBlockHash).then(data => {
                    if (!data.success) {
                        setPayloadError(true);
                    } else {
                        setPayloadData(data.payload ? { ...data.payload, provider: data.provider } : { ...data.privatePayload, provider: data.provider });
                    }
                    setIsFetchingPayload(false);
                }).catch(() => {
                    setPayloadError(true);
                    setIsFetchingPayload(false);
                });
            }
        }
    }, [isModalOpen, selectedBlockHash, blocks, nodeConfig]);

    const closeModal = () => {
        dispatch({ type: 'SET_MODAL_OPEN', payload: { isOpen: false, hash: null } });
        setPayloadData(null);
        setPayloadError(false);
        fetchedHashRef.current = null;
    };

    if (!isModalOpen || !selectedBlockHash) {
        return <div id="blockModal" className="modal hidden" style={{ display: 'none' }}></div>;
    }

    const pkg = blocks.find(b => b.hash === selectedBlockHash);
    if (!pkg) return null;

    const formatDate = (isoString) => {
        const d = new Date(isoString);
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const getOrdinal = (n) => {
            const s = ["th", "st", "nd", "rd"];
            const v = n % 100;
            return n + (s[(v - 20) % 10] || s[v] || s[0]);
        };
        const month = months[d.getMonth()];
        const day = d.getDate();
        const year = d.getFullYear();
        let hours = d.getHours();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        const minutes = d.getMinutes().toString().padStart(2, '0');
        return `${month} ${getOrdinal(day)}, ${year} | ${hours}:${minutes} ${ampm}`;
    };

    const date = formatDate(pkg.metadata?.timestamp || pkg.timestamp);
    const isOwner = nodeConfig && nodeConfig.publicKey === pkg.publicKey;

    const renderPayloadHtml = () => {
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

    const renderGenericPayloadHtml = (block) => {
        if (!block || !block.payload) return <div style={{ color: 'var(--text-muted)' }}>No public payload data available.</div>;
        
        switch (block.type) {
            case 'TRANSACTION':
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, max-content) 1fr', gap: '0.5rem 1rem', fontSize: '0.85rem' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Sender:</span>
                                <PropertyValue value={block.payload.senderId} />
                                <span style={{ color: 'var(--text-muted)' }}>Recipient:</span>
                                <PropertyValue value={block.payload.recipientId} />
                                <span style={{ color: 'var(--text-muted)' }}>Amount:</span>
                                <PropertyValue className="success" value={`${block.payload.amount} VERI`} copyable={false} />
                                <span style={{ color: 'var(--text-muted)' }}>Signature:</span>
                                <PropertyValue value={block.payload.senderSignature} />
                            </div>
                        </div>
                    </div>
                );
            case 'CHECKPOINT':
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, max-content) 1fr', gap: '0.5rem 1rem', fontSize: '0.85rem' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Epoch Bound:</span>
                                <PropertyValue className="highlight" value={`Epoch #${block.payload.epochIndex}`} copyable={false} />
                                <span style={{ color: 'var(--text-muted)' }}>Start Hash:</span>
                                <PropertyValue value={block.payload.startHash} />
                                <span style={{ color: 'var(--text-muted)' }}>End Hash:</span>
                                <PropertyValue value={block.payload.endHash} />
                                <span style={{ color: 'var(--text-muted)' }}>State Root:</span>
                                <PropertyValue value={block.payload.stateMerkleRoot} />
                                <span style={{ color: 'var(--text-muted)' }}>Contracts Root:</span>
                                <PropertyValue value={block.payload.activeContractsMerkleRoot} />
                            </div>
                        </div>
                    </div>
                );
            case 'STAKING_CONTRACT':
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, max-content) 1fr', gap: '0.5rem 1rem', fontSize: '0.85rem' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Collateral:</span>
                                <PropertyValue className="highlight" value={`${block.payload.collateralAmount} VERI`} copyable={false} />
                                <span style={{ color: 'var(--text-muted)' }}>Operator Key:</span>
                                <PropertyValue value={block.payload.operatorPublicKey} />
                                <span style={{ color: 'var(--text-muted)' }}>Timeline Bound:</span>
                                <PropertyValue value={`${block.payload.minEpochTimelineDays} Days`} copyable={false} />
                            </div>
                        </div>
                    </div>
                );
            case 'SLASHING_TRANSACTION':
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, max-content) 1fr', gap: '0.5rem 1rem', fontSize: '0.85rem' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Penalized Entity:</span>
                                <PropertyValue value={block.payload.penalizedPublicKey} />
                                <span style={{ color: 'var(--text-muted)' }}>Burnt Ledger:</span>
                                <PropertyValue value={`-${block.payload.burntAmount} VERI`} copyable={false} style={{ color: '#ef4444' }} />
                                <span style={{ color: 'var(--text-muted)' }}>Evidence Sign:</span>
                                <PropertyValue value={block.payload.evidenceSignature} />
                            </div>
                        </div>
                    </div>
                );
            default:
                return <div style={{ color: 'var(--text-muted)' }}>Unrecognized payload type mappings.</div>;
        }
    };

    const executeDecryption = async (targetFileName = null) => {
        if (!payloadData || !payloadData.iv) return alert("Payload metrics missing. Cannot map decryption matrices.");

        if (!web3Account) {
            alert("No Web3 Identity connected globally. Connect Metamask dynamically.");
            return false;
        }

        if (!payloadData.encryptedAesKey) {
            alert("Missing embedded asymmetric hexadecimal limits natively.");
            return false;
        }

        let keyRaw;
        try {
            keyRaw = await decryptAESCore(payloadData.encryptedAesKey, web3Account);
        } catch (err) {
            alert(`Web3 Boundary Decryption Failed: ${err.message}`);
            return false;
        }

        try {
            const response = await fetch(`/api/download/${selectedBlockHash}`);
            if (!response.ok) throw new Error("Backend block extraction bounded natively.");
            const encryptedBuffer = await response.arrayBuffer();

            const unzipped = await decryptAndUnzip(encryptedBuffer, keyRaw, payloadData.iv);

            if (targetFileName) {
                const normalizedFilename = targetFileName.replace(/^\/+/, '');
                const fileBuf = unzipped[targetFileName] || unzipped[normalizedFilename];
                if (!fileBuf) throw new Error("File omitted systematically from extracted array.");

                const blob = new Blob([fileBuf], { type: 'application/octet-stream' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = targetFileName.split('/').pop();
                document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
            } else {
                // Buffer the entire array implicitly back into a logical Zip without encryption locally
                const rawZip = fflate.zipSync(unzipped);
                const blob = new Blob([rawZip], { type: 'application/zip' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `verimus_block_${selectedBlockHash}.zip`;
                document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
            }
            return true;
        } catch (err) {
            alert(`Decryption Boundary Exception: ${err.message}`);
            return false;
        }
    };

    const handleSingleFileDownload = async (e, path) => {
        e.preventDefault();
        const currentTarget = e.currentTarget;
        const originalHtml = currentTarget.innerHTML;
        currentTarget.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;"></div>';
        currentTarget.disabled = true;

        await executeDecryption(path);

        currentTarget.innerHTML = originalHtml;
        currentTarget.disabled = false;
    };

    const handleDownloadSubmit = async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = 'Decrypting Native AES Array... <div class="spinner" style="display: inline-block; width: 12px; height: 12px; border-width: 2px; margin-left: 0.5rem;"></div>';
        btn.disabled = true;

        await executeDecryption(null);

        btn.innerHTML = originalHTML;
        btn.disabled = false;
    };

    return (
        <div className="modal" style={{ display: 'flex', position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', alignItems: 'center', justifyContent: 'center' }} onClick={closeModal}>
            <div className="modal-content glass-panel" style={{ width: '100%', maxWidth: '650px', margin: '0 1rem', padding: '0', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0', padding: '1.5rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>Block Details</h3>
                    <button onClick={closeModal} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer', transition: 'color 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.25rem', borderRadius: '4px' }} className="hover-text-main">&times;</button>
                </div>

                <div className="modal-body" style={{ padding: '2rem', overflowY: 'auto' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, max-content) 1fr', gap: '0.75rem 1rem', marginBottom: '1.5rem' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Index:</span>
                        <PropertyValue className="highlight" value={pkg.metadata?.index ?? pkg.index} copyable={false} />

                        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Hash:</span>
                        <PropertyValue value={pkg.hash} />

                        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Prev Hash:</span>
                        <PropertyValue value={pkg.previousHash || 'None'} />

                        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Timestamp:</span>
                        <PropertyValue value={date} copyable={false} />

                        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', alignSelf: 'center' }}>Public Key:</span>
                        <button onClick={(e) => {
                            e.preventDefault();
                            const blob = new Blob([pkg.publicKey], { type: 'text/plain' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `public_key_${pkg.hash.substring(0, 8)}.pub`;
                            a.click();
                            URL.revokeObjectURL(url);
                        }} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-main)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', width: 'fit-content', transition: 'background 0.2s' }} onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                            <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: '16px', height: '16px' }}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                            Download public_key.pub
                        </button>

                        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Signature:</span>
                        <div style={{ minWidth: 0, overflow: 'hidden', width: '100%' }}>
                            <PropertyValue value={pkg.signature} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', width: '100%', boxSizing: 'border-box' }} />
                        </div>
                    </div>

                    <div style={{ height: '1px', width: '100%', background: 'linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.4), transparent)', margin: '2rem 0 1.5rem 0' }}></div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                            <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: '18px', height: '18px', color: 'var(--text-muted)' }}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                            </svg>
                            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 500, color: 'var(--text-main)' }}>
                                {pkg.type === 'STORAGE_CONTRACT' ? 'Decrypted Private Payload' : 'Public Payload Data'}
                            </h4>
                        </div>
                        <div style={{ width: '100%', boxSizing: 'border-box' }}>
                            {pkg.type === 'STORAGE_CONTRACT' ? (
                                isOwner ? (
                                    isFetchingPayload ? (
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '2rem', textAlign: 'center', border: '1px dashed var(--border-soft)', borderRadius: 'var(--radius-sm)', width: '100%', boxSizing: 'border-box' }}>
                                            Decrypting network bundle... <div className="spinner" style={{ display: 'inline-block', width: '12px', height: '12px', borderWidth: '2px', marginLeft: '0.5rem' }}></div>
                                        </div>
                                    ) : renderPayloadHtml()
                                ) : (
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '2rem', background: 'rgba(0,0,0,0.2)', border: '1px dashed var(--border-soft)', borderRadius: 'var(--radius-sm)', textAlign: 'center', width: '100%', boxSizing: 'border-box' }}>
                                        Payload strictly mandates active asymmetric RSA decryption keys securely maintained by the authorized originator directly.
                                    </div>
                                )
                            ) : renderGenericPayloadHtml(pkg)}
                        </div>
                    </div>

                    {isOwner && pkg.type === 'STORAGE_CONTRACT' && !isFetchingPayload && payloadData && !payloadError && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
                            <form onSubmit={handleDownloadSubmit} style={{ maxWidth: '220px', width: '100%' }}>
                                <button type="submit" className="primary-btn" style={{ borderRadius: 'var(--radius-lg)', fontWeight: 600 }}>Decrypt & Download</button>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BlockModal;
