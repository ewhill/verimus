export const buildFileTree = (filesMap) => {
    const locationsMap = new Map();
    let hasUnknownFiles = false;
    const treeNodes = new Map();

    filesMap.forEach(f => {
        const isUnknown = f.location && f.location.type === 'unknown';
        if (isUnknown) hasUnknownFiles = true;

        const locId = f.location && f.location.id ? f.location.id : 'unknown';
        
        if (f.location && f.location.id && !locationsMap.has(f.location.id)) {
            locationsMap.set(f.location.id, f.location);
        }

        if (!treeNodes.has(locId)) {
            treeNodes.set(locId, {
                name: locId === 'unknown' ? 'Unknown Sources' : (f.location ? f.location.label : 'Unknown Sources'),
                type: f.location ? f.location.type : 'unknown',
                locationId: locId,
                path: [],
                folders: new Map(),
                files: []
            });
        }

        const locNode = treeNodes.get(locId);
        
        let cleanName = f.path;
        if (cleanName.startsWith('/')) cleanName = cleanName.substring(1);
        
        const parts = cleanName.split('/').filter(p => p !== '');
        const filename = parts.length > 0 ? parts.pop() : cleanName;

        let currentNode = locNode;
        let currentPath = [];
        
        for (const part of parts) {
            currentPath.push(part);
            if (!currentNode.folders.has(part)) {
                currentNode.folders.set(part, {
                    name: part,
                    path: [...currentPath],
                    locationId: locId,
                    folders: new Map(),
                    files: []
                });
            }
            currentNode = currentNode.folders.get(part);
        }
        currentNode.files.push({ ...f, displayName: filename });
    });

    return { locationsMap, treeNodes, hasUnknownFiles, locations: Array.from(locationsMap.values()) };
};
