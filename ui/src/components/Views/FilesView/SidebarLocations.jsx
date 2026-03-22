import React from 'react';
import { useStore } from '../../../store';

const SidebarLocations = ({ treeData }) => {
    const dispatch = useStore(s => s.dispatch);
    const filesLocationFilter = useStore(s => s.filesLocationFilter);
    const filesSelectedPath = useStore(s => s.filesSelectedPath);
    const filesSearchQuery = useStore(s => s.filesSearchQuery);
    const { locations, treeNodes, hasUnknownFiles } = treeData;

    const handleSearchInput = (e) => {
        dispatch({ type: 'SET_FILES_SEARCH', payload: e.target.value.toLowerCase() });
    };

    const handleClearSearch = () => {
        dispatch({ type: 'SET_FILES_SEARCH', payload: '' });
    };

    const setLocation = (locId, path = []) => {
        dispatch({ type: 'SET_FILES_FILTER', payload: locId });
        dispatch({ type: 'SET_FILES_PATH', payload: path });
    };

    const renderTree = (node, depth) => {
        const isSelectedLocation = filesLocationFilter === node.locationId;
        const isExactMatch = isSelectedLocation && JSON.stringify(filesSelectedPath) === JSON.stringify(node.path);
        
        let isExpanded = false;
        if (isSelectedLocation) {
            isExpanded = node.path.every((val, i) => val === filesSelectedPath[i]);
        }
        
        let iconHtml = <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>;
        if (depth === 0) {
            if (node.type === 'samba') iconHtml = <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><path d="M6 18h.01"></path><path d="M12 14v-4"></path><path d="M8 10h8"></path><rect x="10" y="2" width="4" height="4"></rect></svg>;
            else if (node.type === 'remote-fs') iconHtml = <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>;
            else if (node.type === 's3' || node.type === 'glacier') iconHtml = <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path></svg>;
            else if (node.type === 'local') iconHtml = <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="12" x2="2" y2="12"></line><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>;
            else if (node.type === 'unknown') iconHtml = <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>;
        }

        return (
            <React.Fragment key={`${node.locationId}-${node.path.join('/')}`}>
                <div 
                    className={`sidebar-item mac-sidebar-item ${isExactMatch ? 'active' : ''} ${depth > 0 ? 'nested-item' : ''}`}
                    style={{ paddingLeft: `${1 + depth * 1.25}rem` }}
                    title={node.name}
                    onClick={() => setLocation(node.locationId, node.path)}
                >
                    {iconHtml}
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '170px' }}>
                        {node.name}
                    </span>
                </div>
                {isExpanded && node.folders.size > 0 && (
                    Array.from(node.folders.values())
                        .sort((a,b) => a.name.localeCompare(b.name))
                        .map(child => renderTree(child, depth + 1))
                )}
            </React.Fragment>
        );
    };

    return (
        <div className="files-sidebar">
            <div className="search-container" style={{ margin: '0 0 1.5rem 0', width: '100%', maxWidth: '100%' }}>
                <svg className="search-icon" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
                <input 
                    type="text" 
                    placeholder="Search files..." 
                    value={filesSearchQuery || ''}
                    onChange={handleSearchInput}
                    style={{ width: '100%' }}
                />
                {filesSearchQuery && (
                    <button className="clear-icon" style={{ display: 'flex' }} onClick={handleClearSearch}>
                        <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                    </button>
                )}
            </div>

            <div className="sidebar-title">Locations</div>
            
            <div 
                className={`sidebar-item mac-sidebar-item ${filesLocationFilter === 'all' ? 'active' : ''}`} 
                onClick={() => setLocation('all')}
            >
                <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                    <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
                <span>All</span>
            </div>
            
            {locations.map(loc => {
                const rootNode = treeNodes.get(loc.id);
                if (rootNode) return renderTree(rootNode, 0);
                return null;
            })}
            
            {(hasUnknownFiles || filesLocationFilter === 'unknown') && treeNodes.has('unknown') && 
                renderTree(treeNodes.get('unknown'), 0)
            }
        </div>
    );
};

export default SidebarLocations;
