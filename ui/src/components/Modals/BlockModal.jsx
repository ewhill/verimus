 
import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store';
import { ApiService } from '../../services/api';
import { decryptAndUnzip } from '../../utils/bundler';
import { decryptAESCore } from '../../utils/web3';
import * as fflate from 'fflate';
import PropertyValue from './Payloads/PropertyValue';
import StorageContractPayload from './Payloads/StorageContractPayload';
import { TransactionPayload, CheckpointPayload, StakingContractPayload, SlashingTransactionPayload } from './Payloads/GenericPayloads';

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

                        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', alignSelf: 'center' }}>Signer Address:</span>
                        <PropertyValue value={pkg.signerAddress} />

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
                                    ) : <StorageContractPayload payloadData={payloadData} payloadError={payloadError} handleSingleFileDownload={handleSingleFileDownload} />
                                ) : (
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '2rem', background: 'rgba(0,0,0,0.2)', border: '1px dashed var(--border-soft)', borderRadius: 'var(--radius-sm)', textAlign: 'center', width: '100%', boxSizing: 'border-box' }}>
                                        Payload strictly mandates active wallet decryption keys securely maintained by the authorized originator directly.
                                    </div>
                                )
                            ) : (
                                <>
                                    {pkg.type === 'TRANSACTION' && <TransactionPayload block={pkg} />}
                                    {pkg.type === 'CHECKPOINT' && <CheckpointPayload block={pkg} />}
                                    {pkg.type === 'STAKING_CONTRACT' && <StakingContractPayload block={pkg} />}
                                    {pkg.type === 'SLASHING_TRANSACTION' && <SlashingTransactionPayload block={pkg} />}
                                    {!['STORAGE_CONTRACT', 'TRANSACTION', 'CHECKPOINT', 'STAKING_CONTRACT', 'SLASHING_TRANSACTION'].includes(pkg.type) && <div style={{ color: 'var(--text-muted)' }}>Unrecognized payload type mappings.</div>}
                                </>
                            )}
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
