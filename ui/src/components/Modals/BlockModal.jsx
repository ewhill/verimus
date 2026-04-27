
import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store';
import { ApiService } from '../../services/api';
import { decryptAndUnzip } from '../../utils/bundler';
import { decryptAESCore } from '../../utils/web3';
import * as fflate from 'fflate';
import PropertyValue from './Payloads/PropertyValue';
import StorageContractPayload from './Payloads/StorageContractPayload';
import { TransactionPayload, CheckpointPayload, StakingContractPayload, SlashingTransactionPayload, ValidatorRegistrationPayload } from './Payloads/GenericPayloads';
import GenericBlockHeader from './Payloads/GenericBlockHeader';

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
    const [activeBlockMemo, setActiveBlockMemo] = useState(null);
    const [activeModalTab, setActiveModalTab] = useState('overview'); // ['overview', 'raw', 'signatures']
    const fetchedHashRef = useRef(null);

    useEffect(() => {
        if (isModalOpen && selectedBlockHash) {
            const found = blocks.find(b => b.hash === selectedBlockHash);
            
            const handleBlockFound = (pkg) => {
                setActiveBlockMemo(pkg);
                const isOwner = nodeConfig && nodeConfig.walletAddress === pkg?.signerAddress;

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
            };

            if (found) {
                handleBlockFound(found);
            } else if (activeBlockMemo && activeBlockMemo.hash === selectedBlockHash) {
                handleBlockFound(activeBlockMemo);
            } else {
                ApiService.fetchSingleBlock(selectedBlockHash).then(pkg => {
                    if (pkg) handleBlockFound(pkg);
                });
            }
        }
    }, [isModalOpen, selectedBlockHash, blocks, nodeConfig, activeBlockMemo]);

    const closeModal = () => {
        dispatch({ type: 'SET_MODAL_OPEN', payload: { isOpen: false, hash: null } });
        setPayloadData(null);
        setPayloadError(false);
        fetchedHashRef.current = null;
        setActiveBlockMemo(null);
        setActiveModalTab('overview');
    };

    if (!isModalOpen || !selectedBlockHash) {
        return <div id="blockModal" className="modal hidden" style={{ display: 'none' }}></div>;
    }

    const pkg = blocks.find(b => b.hash === selectedBlockHash) || activeBlockMemo;
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
    const isOwner = nodeConfig && nodeConfig.walletAddress === pkg.signerAddress;

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
                document.body.appendChild(a); a.click(); setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
            } else {
                const keys = Object.keys(unzipped);
                if (keys.length === 1) {
                    const singleName = keys[0];
                    const blob = new Blob([unzipped[singleName]], { type: 'application/octet-stream' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = singleName.split('/').pop();
                    document.body.appendChild(a); a.click(); setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
                } else {
                    // Buffer the entire array implicitly back into a logical Zip without encryption locally
                    const rawZip = fflate.zipSync(unzipped);
                    const blob = new Blob([rawZip], { type: 'application/zip' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url;

                    const rootName = keys.length > 0 ? keys[0].split('/').pop() : 'data';
                    a.download = `verimus_package_${rootName}.zip`;

                    document.body.appendChild(a); a.click(); setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
                }
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
        <div className="modal" style={{ display: 'flex', position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto' }} onClick={closeModal}>
            <div className="modal-content glass-panel" style={{ width: 'calc(100% - 200px)', margin: '100px', padding: '0', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100% - 200px)', position: 'fixed' }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', margin: '0', padding: '1.5rem 2rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>Block Inspection</h3>
                        <button onClick={closeModal} style={{ position: 'absolute', top: '1.25rem', right: '1.5rem', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer', transition: 'color 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.25rem', borderRadius: '4px', zIndex: 10 }} className="hover-text-main">&times;</button>
                    </div>

                    <div style={{ display: 'flex', gap: '1.5rem', borderBottom: '1px solid transparent' }}>
                        <button
                            className={`modal-tab-btn ${activeModalTab === 'overview' ? 'active' : ''}`}
                            onClick={() => setActiveModalTab('overview')}
                            style={{ background: 'transparent', border: 'none', borderBottom: activeModalTab === 'overview' ? '2px solid #818cf8' : '2px solid transparent', color: activeModalTab === 'overview' ? '#818cf8' : 'var(--text-muted)', padding: '0.5rem 0', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.9rem' }}
                        >Overview</button>
                        <button
                            className={`modal-tab-btn ${activeModalTab === 'raw' ? 'active' : ''}`}
                            onClick={() => setActiveModalTab('raw')}
                            style={{ background: 'transparent', border: 'none', borderBottom: activeModalTab === 'raw' ? '2px solid #818cf8' : '2px solid transparent', color: activeModalTab === 'raw' ? '#818cf8' : 'var(--text-muted)', padding: '0.5rem 0', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.9rem' }}
                        >Raw Details</button>
                        <button
                            className={`modal-tab-btn ${activeModalTab === 'signatures' ? 'active' : ''}`}
                            onClick={() => setActiveModalTab('signatures')}
                            style={{ background: 'transparent', border: 'none', borderBottom: activeModalTab === 'signatures' ? '2px solid #818cf8' : '2px solid transparent', color: activeModalTab === 'signatures' ? '#818cf8' : 'var(--text-muted)', padding: '0.5rem 0', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.9rem' }}
                        >Signatures</button>
                    </div>
                </div>

                <div className="modal-body" style={{ padding: '2rem', overflowY: 'auto', flex: 1 }}>
                    {activeModalTab === 'overview' && (
                        <>
                            {pkg.type === 'STORAGE_CONTRACT' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                    <div style={{ width: '100%', boxSizing: 'border-box' }}>
                                        <StorageContractPayload block={pkg} payloadData={payloadData} payloadError={payloadError} handleSingleFileDownload={handleSingleFileDownload} web3Account={web3Account} />

                                        {isOwner && isFetchingPayload && (
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '2rem', textAlign: 'center', border: '1px dashed var(--border-soft)', borderRadius: 'var(--radius-sm)', width: '100%', boxSizing: 'border-box', marginTop: '1rem' }}>
                                                Decrypting network bundle... <div className="spinner" style={{ display: 'inline-block', width: '12px', height: '12px', borderWidth: '2px', marginLeft: '0.5rem' }}></div>
                                            </div>
                                        )}
                                        {!isOwner && (
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '2rem', background: 'rgba(0,0,0,0.2)', border: '1px dashed var(--border-soft)', borderRadius: 'var(--radius-sm)', textAlign: 'center', width: '100%', boxSizing: 'border-box', marginTop: '1rem' }}>
                                                Private Payload strictly mandates active wallet decryption keys securely maintained by the authorized originator directly.
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ height: '1px', width: '100%', background: 'linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.4), transparent)', margin: '2rem 0 1.5rem 0' }}></div>
                                    <GenericBlockHeader block={pkg} date={date} hideSignatures={true} />
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                    <GenericBlockHeader block={pkg} date={date} hideSignatures={true} />
                                    <div style={{ height: '1px', width: '100%', background: 'linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.4), transparent)', margin: '2rem 0 1.5rem 0' }}></div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                                        <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: '18px', height: '18px', color: 'var(--text-muted)' }}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                                        </svg>
                                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 500, color: 'var(--text-main)' }}>Public Payload Data</h4>
                                    </div>
                                    <div style={{ width: '100%', boxSizing: 'border-box' }}>
                                        {pkg.type === 'TRANSACTION' && <TransactionPayload block={pkg} />}
                                        {pkg.type === 'CHECKPOINT' && <CheckpointPayload block={pkg} />}
                                        {pkg.type === 'STAKING_CONTRACT' && <StakingContractPayload block={pkg} />}
                                        {pkg.type === 'VALIDATOR_REGISTRATION' && <ValidatorRegistrationPayload block={pkg} />}
                                        {pkg.type === 'SLASHING_TRANSACTION' && <SlashingTransactionPayload block={pkg} />}
                                        {!['STORAGE_CONTRACT', 'TRANSACTION', 'CHECKPOINT', 'STAKING_CONTRACT', 'SLASHING_TRANSACTION', 'VALIDATOR_REGISTRATION'].includes(pkg.type) && <div style={{ color: 'var(--text-muted)' }}>Unrecognized payload type mappings.</div>}
                                    </div>
                                </div>
                            )}

                            {isOwner && pkg.type === 'STORAGE_CONTRACT' && !isFetchingPayload && payloadData && !payloadError && (
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
                                    <form onSubmit={handleDownloadSubmit} style={{ maxWidth: '220px', width: '100%' }}>
                                        <button type="submit" className="primary-btn" style={{ borderRadius: 'var(--radius-lg)', fontWeight: 600 }}>Decrypt & Download</button>
                                    </form>
                                </div>
                            )}
                        </>
                    )}

                    {activeModalTab === 'raw' && (
                        <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                            <pre style={{ margin: 0, color: '#38bdf8', fontSize: '0.8rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                {JSON.stringify(pkg, null, 2)}
                            </pre>
                        </div>
                    )}

                    {activeModalTab === 'signatures' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.05em' }}>EIP-712 Network Signatures</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, max-content) 1fr', gap: '1rem', fontSize: '0.85rem' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Signer Address:</span>
                                    <PropertyValue value={pkg.signerAddress} />

                                    <span style={{ color: 'var(--text-muted)' }}>Signature:</span>
                                    <PropertyValue value={pkg.signature || 'N/A'} style={{ wordBreak: 'break-all' }} />

                                    {pkg.payload?.evidenceSignature && (
                                        <>
                                            <span style={{ color: 'var(--text-muted)' }}>Evidence Sign:</span>
                                            <PropertyValue value={pkg.payload.evidenceSignature} style={{ wordBreak: 'break-all', color: '#ef4444' }} />
                                        </>
                                    )}

                                    {pkg.payload?.senderSignature && (
                                        <>
                                            <span style={{ color: 'var(--text-muted)' }}>Sender Sign:</span>
                                            <PropertyValue value={pkg.payload.senderSignature} style={{ wordBreak: 'break-all' }} />
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BlockModal;
