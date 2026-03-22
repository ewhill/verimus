import React, { useState } from 'react';
import { useStore } from '../../../store';
import { ApiService } from '../../../services/api';

const FileGrid = ({ displayItems }) => {
    const dispatch = useStore(s => s.dispatch);
    const [openDropdown, setOpenDropdown] = useState(null);

    const handleFolderClick = (path) => {
        dispatch({ type: 'SET_FILES_PATH', payload: path });
    };

    const handleDownload = async (hash, filename, e) => {
        if (e) e.stopPropagation();
        await ApiService.downloadFile(`/api/download/${hash}/file/${encodeURIComponent(filename)}`, filename.split('/').pop() || 'download');
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

                    const hasVersions = f.versions.length > 1;
                    const latestBlock = f.versions[0];
                    const isDropdownOpen = openDropdown === i;
                    
                    return (
                        <div key={`file-${f.path}-${i}`} className={`file-card redesigned ${hasVersions ? 'has-versions' : ''}`} style={{ zIndex: isDropdownOpen ? 10 : 1 }}>
                            <div 
                                className="file-icon-wrap click-to-download" 
                                onClick={(e) => hasVersions ? toggleDropdown(i, e) : handleDownload(latestBlock.blockHash, f.path, e)}
                            >
                                {iconHtml}
                            </div>
                            
                            {hasVersions && (
                                <div className="versions-badge toggle-versions" onClick={(e) => toggleDropdown(i, e)}>
                                    {f.versions.length}
                                </div>
                            )}
                            
                            <div className="file-name toggle-versions" onClick={(e) => hasVersions ? toggleDropdown(i, e) : null} title={item.displayName}>
                                {item.displayName}
                            </div>
                            
                            {hasVersions && isDropdownOpen && (
                                <div className="versions-panel show" onClick={(e) => e.stopPropagation()}>
                                    <div className="versions-panel-title">Previous Versions</div>
                                    {f.versions.map((v, vidx) => (
                                        <div className="version-row" key={`v-${vidx}`}>
                                            <span className="version-meta">{new Date(v.timestamp).toLocaleString()} (Blk {v.index})</span>
                                            <button className="btn-download" onClick={() => handleDownload(v.blockHash, f.path)}>Get</button>
                                        </div>
                                    ))}
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
