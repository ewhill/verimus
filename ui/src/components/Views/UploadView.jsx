import React, { useState } from 'react';
import { useStore } from '../../store';

const UploadView = () => {
    const dispatch = useStore(s => s.dispatch);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const [redundancy, setRedundancy] = useState(1);
    const [maxCost, setMaxCost] = useState(0.05);

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

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedFiles.length) return;

        setIsUploading(true);
        const formData = new FormData();
        selectedFiles.forEach(f => {
            formData.append('files', f);
            formData.append('paths', f.webkitRelativePath || f.name);
        });

        // Triage Mapping Constraints natively bound organically
        formData.append('redundancy', String(redundancy));
        formData.append('maxCost', String(maxCost));

        try {
            const res = await fetch('/api/upload', {
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
                window.history.pushState({}, '', '/ledger?upload=success');
                dispatch({ type: 'SET_ROUTE', payload: 'ledger' });
            }
        } catch (err) {
            console.error('Marketplace Bounds Exception:', err.message);
            alert(`Market Order Issue: ${err.message}`);
        } finally {
            setIsUploading(false);
            setSelectedFiles([]);
        }
    };

    return (
        <section className="upload-section glass-panel stagger-1">
            <h2 className="stagger-1">Secure File Upload</h2>
            <p className="subtitle stagger-1">Bundle, encrypt, and commit files directly via V3 React Subsystems natively.</p>
            
            <form onSubmit={handleSubmit} className="stagger-2">
                <div 
                    className={`file-drop-area enhanced ${isDragOver ? 'dragover' : ''}`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => document.getElementById('fileInput').click()}
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
                        border: '1px solid rgba(255,255,255,0.1)'
                    }} 
                    className="stagger-3"
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
                
                <button type="submit" className="primary-btn" disabled={isUploading || selectedFiles.length === 0}>
                    <span>{isUploading ? 'Processing...' : 'Bundle & Commit'}</span>
                    {isUploading && <div className="spinner" style={{ display: 'inline-block', width: '16px', height: '16px', borderWidth: '2px', marginLeft: '0.5rem' }}></div>}
                </button>
            </form>
        </section>
    );
};

export default UploadView;
