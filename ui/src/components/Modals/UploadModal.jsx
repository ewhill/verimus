import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store';
import { bundleAndEncryptFiles } from '../../utils/bundler';
import { getEncryptionPublicKey, encryptAESKeyBoundaries, signOriginatorProxyMessage } from '../../utils/web3';

const UploadModal = () => {
    const dispatch = useStore(s => s.dispatch);
    const isUploadModalOpen = useStore(s => s.isUploadModalOpen);
    const web3Account = useStore(s => s.web3Account);
    const nodeConfig = useStore(s => s.nodeConfig);

    const [selectedFiles, setSelectedFiles] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const [redundancy, setRedundancy] = useState(1);
    const [maxCost, setMaxCost] = useState(0.05);
    const [marketLogs, setMarketLogs] = useState([]);
    const [cryptoLogs, setCryptoLogs] = useState([]);
    const [pubKeyInfo, setPubKeyInfo] = useState(null);

    const marketEndRef = useRef(null);
    const cryptoEndRef = useRef(null);

    useEffect(() => {
        if (marketEndRef.current) marketEndRef.current.scrollIntoView({ behavior: "smooth" });
    }, [marketLogs]);

    useEffect(() => {
        if (cryptoEndRef.current) cryptoEndRef.current.scrollIntoView({ behavior: "smooth" });
    }, [cryptoLogs]);

    const handleFileChange = (e) => {
        if (e.target.files) {
            setSelectedFiles(Array.from(e.target.files));
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files) {
            setSelectedFiles(Array.from(e.dataTransfer.files));
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const closeModal = () => {
        if (isUploading) return; // Prevent closing while processing!
        dispatch({ type: 'SET_UPLOAD_MODAL_OPEN', payload: false });
        setSelectedFiles([]);
        setMarketLogs([]);
        setCryptoLogs([]);
        setRedundancy(1);
        setMaxCost(0.05);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedFiles.length) return;

        setIsUploading(true);
        setMarketLogs([]);
        setCryptoLogs([]);

        let eventSource = null;
        try {
            eventSource = new EventSource('/api/upload/events');
            eventSource.onmessage = (e) => {
                try {
                    const data = JSON.parse(e.data);
                    const isCrypto = ['HASH_ABSORPTION', 'HASH_RESOLVED', 'AES_ENCRYPTION'].includes(data.status);

                    if (isCrypto) {
                        setCryptoLogs(prev => {
                            if (prev.length > 0 && prev[prev.length - 1].status === data.status && prev[prev.length - 1].message === data.message) return prev;
                            const newLogs = [...prev, data];
                            if (newLogs.length > 100) return newLogs.slice(newLogs.length - 100);
                            return newLogs;
                        });
                    } else {
                        setMarketLogs(prev => {
                            if (prev.length > 0 && prev[prev.length - 1].status === data.status && prev[prev.length - 1].message === data.message) return prev;
                            return [...prev, data];
                        });
                    }
                } catch (err) { }
            };
        } catch (e) {
            console.warn("EventSource tracking dynamically suppressed:", e);
        }

        const formData = new FormData();

        try {
            if (!web3Account) {
                throw new Error("Web3 EVM Constraints are uninitialized. Connect your Metamask Wallet to execute asymmetric AES proxying locally.");
            }

            // CRITICAL FIX: Deterministic State-Driven Execution! Require an explicitly distinct user-gesture
            // to separate the two native MetaMask popups, completely mitigating the Keyring lock race condition natively.
            if (!pubKeyInfo) {
                setCryptoLogs([{ status: 'PROXY_AUTH', message: 'Generating Originator Limits requesting active verification bounds natively...' }]);
                const key = await getEncryptionPublicKey(web3Account);
                setPubKeyInfo(key);
                setCryptoLogs(prev => [...prev, { status: 'PROXY_AUTH_COMPLETE', message: 'Encryption constraints granted. Please proceed to Phase 2.' }]);
                setIsUploading(false);
                return;
            }

            const executionTime = Date.now();
            const signature = await signOriginatorProxyMessage(executionTime, 'batch', web3Account);

            // Intercept standard streams extracting Native Web Crypto boundaries structurally
            setCryptoLogs(prev => [...prev, { status: 'DECOUPLED_ENCRYPTION', message: 'Executing zero-knowledge client-side AES-256-GCM symmetric block cipher natively...' }]);
            
            const cryptoResult = await bundleAndEncryptFiles(selectedFiles);
            const { encryptedBlob, aesKeyBase64, aesIvBase64, authTagHex, fileMetadata } = cryptoResult;

            setCryptoLogs(prev => [...prev, { status: 'ENCRYPTION_COMPLETE', message: 'Symmetric Block Locked. Isolating Key Array organically...' }]);

            const encKeyPayload = encryptAESKeyBoundaries(aesKeyBase64, pubKeyInfo);

            // Mount mathematically opaque structures into standard boundary forms
            formData.append('files', encryptedBlob, 'encrypted_payload.bin');
            formData.append('ownerAddress', web3Account);
            formData.append('ownerSignature', signature);
            formData.append('timestamp', String(executionTime));
            formData.append('encryptedAesKey', encKeyPayload);
            formData.append('aesIv', aesIvBase64);
            formData.append('authTag', authTagHex);
            formData.append('fileMetadata', JSON.stringify(fileMetadata));
            
            // Triage Mapping Constraints natively bound organically
            formData.append('redundancy', String(redundancy));
            formData.append('maxCost', String(maxCost));

            const { ApiService } = await import('../../services/api');
            const res = await fetch(`${ApiService.activeProxyUrl}/api/upload`, {
                method: 'POST',
                body: formData
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || 'Network boundary timeout mapping P2P limits organically.');
            }

            const data = await res.json();

            if (data.success) {
                // Navigate to Ledger natively
                closeModal();
                window.history.pushState({}, '', '/ledger?upload=success');
                dispatch({ type: 'SET_ROUTE', payload: 'ledger' });
            }
        } catch (err) {
            console.error('Marketplace Bounds Exception:', err.message);
            alert(`Market Order Issue: ${err.message}`);
        } finally {
            if (eventSource) eventSource.close();
            setIsUploading(false);
        }
    };

    if (!isUploadModalOpen) return null;

    return (
        <div className="modal" style={{ display: 'flex', position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', alignItems: 'center', justifyContent: 'center' }} onClick={closeModal}>
            <div className="modal-content glass-panel" style={{ width: '100%', maxWidth: '800px', margin: '0 1rem', padding: '0', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
                
                <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0', padding: '1.5rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>Secure Data Upload</h3>
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Bundle, encrypt, and commit files to decentralized bounds natively.</p>
                    </div>
                    <button onClick={closeModal} disabled={isUploading} style={{ background: 'none', border: 'none', color: isUploading ? 'rgba(255,255,255,0.2)' : 'var(--text-muted)', fontSize: '1.5rem', cursor: isUploading ? 'not-allowed' : 'pointer', transition: 'color 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.25rem', borderRadius: '4px' }} className="hover-text-main">&times;</button>
                </div>

                <div className="modal-body upload-section" style={{ padding: '2rem', overflowY: 'auto' }}>
                    <form onSubmit={handleSubmit} style={{ margin: 0 }}>
                        <div
                            className={`file-drop-area enhanced ${isDragOver ? 'dragover' : ''}`}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onClick={() => document.getElementById('fileInput').click()}
                            style={isUploading ? { opacity: 0.5, pointerEvents: 'none' } : {}}
                        >
                            <span className="drop-icon empty-state-svg" style={{ margin: '0 auto 1.5rem auto' }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                                </svg>
                            </span>
                            <span className="drop-msg">
                                {selectedFiles.length === 1 && `Selected: ${selectedFiles[0].name}`}
                                {selectedFiles.length > 1 && `Selected: ${selectedFiles.length} files`}
                                {selectedFiles.length === 0 && `Drag & drop files here or click to browse`}
                            </span>
                            <input
                                type="file"
                                id="fileInput"
                                name="files"
                                multiple
                                required
                                onChange={handleFileChange}
                                style={{ display: 'none' }}
                            />
                        </div>

                        <div
                            style={{
                                display: 'flex',
                                gap: '1rem',
                                marginBottom: '1.5rem',
                                background: 'rgba(255,255,255,0.03)',
                                padding: '1rem',
                                borderRadius: '0.5rem',
                                border: '1px solid rgba(255,255,255,0.1)',
                                ...(isUploading ? { opacity: 0.5, pointerEvents: 'none' } : {})
                            }}
                        >
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>Replication Hosts (N)</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="5"
                                    value={redundancy}
                                    onChange={(e) => setRedundancy(e.target.value)}
                                    style={{
                                        background: 'transparent',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                        color: 'white',
                                        padding: '0.5rem',
                                        borderRadius: '4px'
                                    }}
                                />
                            </div>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>Max Cost (Per GB)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    value={maxCost}
                                    onChange={(e) => setMaxCost(e.target.value)}
                                    style={{
                                        background: 'transparent',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                        color: 'white',
                                        padding: '0.5rem',
                                        borderRadius: '4px'
                                    }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.8rem', marginTop: '-0.5rem', marginBottom: '1.5rem', padding: '0.5rem 1rem', background: 'rgba(6, 182, 212, 0.05)', borderRadius: '0.25rem', border: '1px solid rgba(6, 182, 212, 0.1)' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80' }}></span>
                                <span>Active Originator Node Topology Validated</span>
                            </span>
                            <span style={{ color: '#06b6d4', fontWeight: 600 }}>Dynamic Proxy Fee Ceiling: {nodeConfig?.proxyBrokerFee !== undefined ? (nodeConfig.proxyBrokerFee * 100).toFixed(1) + '%' : '1.0%'}</span>
                        </div>

                        <button type="button" id="devInjectBtn" onClick={() => {
                            const bufferSize = 10 * 1024 * 1024; // 10MB test payload
                            const largeBuffer = new ArrayBuffer(bufferSize);
                            const view = new Uint8Array(largeBuffer);
                            for (let i = 0; i < bufferSize; i++) view[i] = Math.random() * 256;
                            const blob = new Blob([view], { type: 'application/octet-stream' });
                            const file = new File([blob], "10mb_synthetic_entropy_test_vector.bin", { type: 'application/octet-stream' });
                            setSelectedFiles([file]);
                            document.getElementById('fileInput').removeAttribute('required');
                        }} style={{ opacity: 0.01, position: 'absolute', width: '10px', height: '10px' }}>Inject Vector</button>

                        <button type="submit" id="submitBtnExt" className="primary-btn" disabled={isUploading || selectedFiles.length === 0}>
                            <span>
                                {isUploading 
                                    ? 'Processing Order...' 
                                    : (!pubKeyInfo ? 'Step 1: Exchange Encryption Limits' : 'Step 2: Bundle & Commit Data')}
                            </span>
                            {isUploading && <div className="spinner" style={{ display: 'inline-block', width: '16px', height: '16px', borderWidth: '2px', marginLeft: '0.5rem' }}></div>}
                        </button>

                        {isUploading && (marketLogs.length > 0 || cryptoLogs.length > 0) && (
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', alignItems: 'stretch' }} className="fade-in">
                                {/* Market Terminal */}
                                <div className="telemetry-terminal" style={{ flex: 1, background: '#000000', padding: '1rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'monospace', fontSize: '0.85rem', color: '#4ade80', height: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '0.75rem', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '1px', flexShrink: 0, position: 'sticky', top: 0, background: '#000000', zIndex: 10, paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Native Contract Negotiations</div>
                                    <div style={{ flex: 1 }}>
                                        {marketLogs.length === 0 && <div style={{ color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>Awaiting Limits...</div>}
                                        {marketLogs.map((log, idx) => (
                                            <div key={idx} style={{ marginBottom: '0.5rem', borderBottom: idx === marketLogs.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                                                <span style={{ color: '#818cf8', fontWeight: 600 }}>[{log.status}]</span> <span style={{ color: '#f8fafc' }}>{log.message}</span>
                                                {log.activeHosts && (
                                                    <div style={{ marginTop: '0.25rem', color: '#94a3b8', fontSize: '0.75rem' }}>
                                                        ↳ Bound Hosts: {log.activeHosts.map(h => h.slice(0, 8)).join(', ')}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        <div ref={marketEndRef} />
                                    </div>
                                </div>

                                {/* Cryptographic Terminal */}
                                <div className="crypto-terminal" style={{ flex: 1, background: '#0a0a0a', padding: '1rem', borderRadius: '0.5rem', border: '1px solid rgba(0, 255, 255, 0.2)', fontFamily: 'monospace', fontSize: '0.85rem', color: '#e2e8f0', height: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ color: 'rgba(0, 255, 255, 0.7)', marginBottom: '0.75rem', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '1px', flexShrink: 0, position: 'sticky', top: 0, background: '#0a0a0a', zIndex: 10, paddingBottom: '0.5rem', borderBottom: '1px solid rgba(0, 255, 255, 0.2)' }}>Cryptographic Pipeline</div>
                                    <div style={{ flex: 1 }}>
                                        {cryptoLogs.length === 0 && <div style={{ color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>Awaiting Data Execution...</div>}
                                        {cryptoLogs.map((log, idx) => {
                                            const isHash = log.status.includes('HASH');
                                            const color = isHash ? '#06b6d4' : '#f97316'; // Cyan vs Orange
                                            return (
                                                <div key={idx} style={{ marginBottom: '0.25rem' }}>
                                                    <span style={{ color, fontWeight: 600 }}>[{log.status}]</span> <span style={{ opacity: 0.9 }}>{log.message}</span>
                                                </div>
                                            );
                                        })}
                                        <div ref={cryptoEndRef} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </form>
                </div>
            </div>
        </div>
    );
};

export default UploadModal;
