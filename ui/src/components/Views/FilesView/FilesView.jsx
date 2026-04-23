import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../../store';
import { ApiService } from '../../../services/api';
import { buildFileTree } from '../../../utils/fileHelpers';
import SidebarLocations from './SidebarLocations';
import FileGrid from './FileGrid';
import '../../../styles/files.css';

const FilesView = () => {
    const dispatch = useStore(s => s.dispatch);
    const filesMap = useStore(s => s.filesMap);
    const filesSearchQuery = useStore(s => s.filesSearchQuery);
    const filesLocationFilter = useStore(s => s.filesLocationFilter);
    const filesSelectedPath = useStore(s => s.filesSelectedPath);
    const web3Account = useStore(s => s.web3Account);
    const isWalletConnecting = useStore(s => s.isWalletConnecting);

    useEffect(() => {
        ApiService.fetchFiles(dispatch);
    }, [dispatch]);

    // Compute tree structure purely (memoized)
    const treeData = useMemo(() => buildFileTree(filesMap || []), [filesMap]);

    // Calculate display items
    let displayItems = [];
    let currentLocationName = 'All Files';
    let showBackButton = false;

    if (filesSearchQuery) {
        displayItems = (filesMap || []).filter(f => {
            const isUnknown = f.location && f.location.type === 'unknown';
            if (filesLocationFilter === 'unknown' && !isUnknown) return false;
            else if (filesLocationFilter !== 'all' && filesLocationFilter !== 'unknown' && f.location?.id !== filesLocationFilter) return false;

            if (!f.path.toLowerCase().includes(filesSearchQuery)) return false;
            return true;
        }).map(f => ({ type: 'file', file: f, displayName: f.path }));

        displayItems.sort((a, b) => a.displayName.localeCompare(b.displayName));

        if (filesLocationFilter === 'unknown') {
            currentLocationName = 'Unknown Sources';
        } else if (filesLocationFilter !== 'all') {
            const activeLoc = treeData.locationsMap.get(filesLocationFilter);
            currentLocationName = activeLoc ? activeLoc.label : 'Unknown Sources';
        }
    } else {
        if (filesLocationFilter === 'all') {
            displayItems = (filesMap || []).map(f => ({ type: 'file', file: f, displayName: f.path }));
            displayItems.sort((a, b) => a.displayName.localeCompare(b.displayName));
            currentLocationName = 'All Files';
        } else {
            const locId = filesLocationFilter;
            const rootNode = treeData.treeNodes.get(locId) || { name: 'Unknown Sources', folders: new Map(), files: [] };

            let currentNode = rootNode;
            for (const p of filesSelectedPath) {
                if (currentNode.folders.has(p)) {
                    currentNode = currentNode.folders.get(p);
                } else {
                    break;
                }
            }

            Array.from(currentNode.folders.values()).forEach(folder => {
                displayItems.push({ type: 'folder', name: folder.name, path: folder.path });
            });
            displayItems.sort((a, b) => a.name.localeCompare(b.name));

            const fileItems = currentNode.files.map(f => ({ type: 'file', file: f.file || f, displayName: f.displayName }));
            fileItems.sort((a, b) => a.displayName.localeCompare(b.displayName));

            displayItems = [...displayItems, ...fileItems];

            currentLocationName = currentNode.name === 'Unknown Sources' && locId !== 'unknown'
                ? (treeData.locationsMap.get(locId) ? treeData.locationsMap.get(locId).label : 'Unknown')
                : currentNode.name;

            showBackButton = filesSelectedPath.length > 0;
        }
    }

    const handleBackClick = () => {
        if (filesSelectedPath.length > 0) {
            dispatch({ type: 'SET_FILES_PATH', payload: filesSelectedPath.slice(0, -1) });
        }
    };

    return (
        <div style={{ padding: '0', maxWidth: '1400px', margin: '0 auto', color: '#f8fafc', height: '100%', display: 'flex', flexDirection: 'column', width: '100%' }}>
            <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem', marginBottom: '2.5rem' }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.01em', color: '#fff', lineHeight: 1 }}>Data Storage</h1>
                    </div>
                </div>
            </div>

            <div className="files-wrapper glass-panel stagger-1" style={{ width: '100%', padding: '2rem', borderRadius: '16px' }}>
                <SidebarLocations treeData={treeData} />

                <div className="files-main stagger-2">
                    <div className="files-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
                        <div className="files-header-left">
                            {showBackButton && (
                                <button className="back-btn" title="Go up one level" onClick={handleBackClick}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
                                </button>
                        )}
                        <div>
                            <h2 style={{ marginBottom: '0.25rem' }}>{currentLocationName}</h2>
                            <div className="subtitle" style={{ marginBottom: '0' }}>{displayItems.length} item(s)</div>
                        </div>
                    </div>
                </div>

                <FileGrid displayItems={displayItems} />
                </div>
            </div>
        </div>
    );
};

export default FilesView;
