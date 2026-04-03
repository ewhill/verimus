import React, { useState } from 'react';
import { useStore } from '../../../store';
import { ApiService } from '../../../services/api';
import ShardGraph from './ShardGraph';
import { decryptAndUnzip } from '../../../utils/bundler';
import { decryptAESCore, generateDownloadAuthHeaders } from '../../../utils/web3';

const FileGrid = ({ displayItems }) => {
    const dispatch = useStore(s => s.dispatch);
    const web3Account = useStore(s => s.web3Account);
    const [openDropdown, setOpenDropdown] = useState(null);

    const handleFolderClick = (path) => {
        dispatch({ type: 'SET_FILES_PATH', payload: path });
    };

    const handleDownload = async (hash, filename, e) => {
        if (e) e.stopPropagation();
        
        try {
            if (!web3Account) throw new Error("Web3 EVM Constraints uninitialized. Connect your Wallet contextually.");
            const nativeHeaders = await generateDownloadAuthHeaders(hash, web3Account);

            const privateRes = await ApiService.fetchPrivatePayload(hash, nativeHeaders);
            if (!privateRes.success) throw new Error("Unauthorized: Cannot fetch private cryptographic metadata limits.");
            
            const payloadMeta = privateRes.privatePayload || privateRes.payload;
            if (!payloadMeta || !payloadMeta.iv) throw new Error("Malformed Payload: Encryption IV physically missing.");

            if (!payloadMeta.encryptedAesKey) throw new Error("Payload missing asymmetric encrypted bounds.");

            const keyRaw = await decryptAESCore(payloadMeta.encryptedAesKey, web3Account);

            const req = await fetch(`/api/download/${hash}`, { headers: nativeHeaders });
            if (!req.ok) throw new Error("Backend retrieval bounded dynamically natively.");
            const encryptedBuffer = await req.arrayBuffer();

            const unzipped = await decryptAndUnzip(encryptedBuffer, keyRaw, payloadMeta.iv);
            
            const normalizedFilename = filename.replace(/^\/+/, '');
            const targetBuffer = unzipped[filename] || unzipped[normalizedFilename];

            if (!targetBuffer) throw new Error("Target file matrix omitted systematically from extracted zip boundaries.");

            const blob = new Blob([targetBuffer], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = filename.split('/').pop() || 'download';
            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);

        } catch (err) {
            console.error(err);
            alert(`Decryption Boundary Exception: ${err.message}`);
        }
    };

    const toggleDropdown = (i, e) => {
        e.stopPropagation();
        setOpenDropdown(openDropdown === i ? null : i);
    };

    // Close dropdowns globally on grid click
    const handleGridClick = () => setOpenDropdown(null);

    if (displayItems.length === 0) {
        return (
            <div className="empty-state">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5">
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                    <polyline points="13 2 13 9 20 9"></polyline>
                </svg>
                <p>No files or folders matched your criteria.</p>
            </div>
        );
    }

    return (
        <div className="files-grid-wrap" onClick={handleGridClick}>
            <div className="files-grid">
                {displayItems.map((item, i) => {
                    if (item.type === 'folder') {
                        return (
                            <div key={`folder-${i}`} className="file-card folder-card redesigned" onClick={() => handleFolderClick(item.path)}>
                                <div className="file-icon-wrap" style={{ color: 'var(--primary)', filter: 'drop-shadow(0 0 8px rgba(99, 102, 241, 0.5))' }}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                                    </svg>
                                </div>
                                <div className="file-name" title={item.name}>{item.name}</div>
                            </div>
                        );
                    }

                    // File Item
                    const f = item.file;
                    const ext = f.path.split('.').pop().toLowerCase();
                    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
                    const isVideo = ['mp4', 'mov', 'avi'].includes(ext);
                    const isAudio = ['mp3', 'wav', 'ogg'].includes(ext);
                    
                    let iconHtml;
                    if (isImage) iconHtml = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>;
                    else if (isVideo) iconHtml = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>;
                    else if (isAudio) iconHtml = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>;
                    else iconHtml = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>;

                    const latestBlock = f.versions[0];
                    const isDropdownOpen = openDropdown === i;
                    
                    return (
                        <div key={`file-${f.path}-${i}`} className={`file-card redesigned has-versions`} style={{ zIndex: isDropdownOpen ? 10 : 1 }}>
                            <div 
                                className="file-icon-wrap click-to-download" 
                                onClick={(e) => toggleDropdown(i, e)}
                            >
                                {iconHtml}
                            </div>
                            
                            <div className="versions-badge toggle-versions" onClick={(e) => toggleDropdown(i, e)} title="Inspect Fragmentation Maps" style={{ background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                            </div>
                            
                            <div className="file-name toggle-versions" onClick={(e) => toggleDropdown(i, e)} title={item.displayName}>
                                {item.displayName}
                            </div>
                            
                            {isDropdownOpen && (
                                <div className="versions-panel show" style={{ width: '400px', right: '0', pointerEvents: 'auto', background: '#0f172a', padding: '1.25rem', border: '1px solid rgba(255,255,255,0.1)' }} onClick={(e) => e.stopPropagation()}>
                                    <div className="versions-panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <span style={{ color: '#f8fafc', fontSize: '0.85rem' }}>Cryptographic Inspection</span>
                                        <button className="btn-download" onClick={(e) => handleDownload(latestBlock.blockHash, f.path, e)} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>Decrypt File</button>
                                    </div>
                                    
                                    {latestBlock.fragmentMap && latestBlock.fragmentMap.length > 0 ? (
                                        <ShardGraph fragmentMap={latestBlock.fragmentMap} />
                                    ) : (
                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '0.5rem', marginTop: '1rem' }}>Local Escrow Boundary (No Shard Matrix Data)</div>
                                    )}

                                    {f.versions.length > 1 && (
                                        <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                            <div className="versions-panel-title" style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginBottom: '0.5rem' }}>Previous Revisions</div>
                                            {f.versions.map((v, vidx) => (
                                                vidx > 0 && (
                                                    <div className="version-row" key={`v-${vidx}`}>
                                                        <span className="version-meta" style={{ fontSize: '0.7rem' }}>{new Date(v.timestamp).toLocaleString()} (Blk {v.index})</span>
                                                        <button className="btn-download" style={{ fontSize: '0.7rem' }} onClick={(e) => handleDownload(v.blockHash, f.path, e)}>Get</button>
                                                    </div>
                                                )
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default FileGrid;
