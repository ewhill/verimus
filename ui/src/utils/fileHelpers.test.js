import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { buildFileTree } from './fileHelpers';

describe('fileHelpers: buildFileTree function', () => {

    it('Evaluates an empty array returning an empty map', () => {
        const result = buildFileTree([]);
        expect(result.locationsMap.size).toBe(0);
        expect(result.treeNodes.size).toBe(0);
        expect(result.hasUnknownFiles).toBe(false);
        expect(result.locations).toHaveLength(0);
    });

    it('Groups files under known locations', () => {
        const filesMap = [
            { path: 'file1.txt', location: { id: 'loc1', type: 'local', label: 'Local Store 1' } },
            { path: 'file2.txt', location: { type: 'unknown' } },
            { path: 'file3.txt', location: { id: 'loc2', type: 's3', label: 'S3 Store' } },
        ];
        
        const { locationsMap, treeNodes, hasUnknownFiles, locations } = buildFileTree(filesMap);
        
        expect(hasUnknownFiles).toBe(true);
        expect(locationsMap.size).toBe(2);
        expect(locations.length).toBe(2);
        
        // Check nodes
        expect(treeNodes.size).toBe(3); // loc1, unknown, loc2
        
        const node1 = treeNodes.get('loc1');
        expect(node1.files[0].displayName).toBe('file1.txt');
        expect(node1.name).toBe('Local Store 1');
        
        const unknownNode = treeNodes.get('unknown');
        expect(unknownNode.files[0].displayName).toBe('file2.txt');
        expect(unknownNode.name).toBe('Unknown Sources');
    });

    it('Parses deeply nested file paths', () => {
        const filesMap = [
            { path: '/my_folder/sub_folder/deep/file.pdf', location: { id: 'loc1', type: 'local', label: 'L1' } },
        ];
        
        const { treeNodes } = buildFileTree(filesMap);
        const locNode = treeNodes.get('loc1');
        
        expect(locNode.files).toHaveLength(0); // Root has no files
        expect(locNode.folders.has('my_folder')).toBe(true);
        
        const f1 = locNode.folders.get('my_folder');
        expect(f1.files).toHaveLength(0);
        expect(f1.folders.has('sub_folder')).toBe(true);
        
        const f2 = f1.folders.get('sub_folder');
        expect(f2.folders.has('deep')).toBe(true);
        
        const f3 = f2.folders.get('deep');
        expect(f3.files).toHaveLength(1);
        expect(f3.files[0].displayName).toBe('file.pdf');
    });

    it('Handles trailing slashes in paths', () => {
        const filesMap = [
            { path: 'folder_trailing/', location: { id: 'loc1', type: 'local', label: 'L1' } },
        ];
        
        const { treeNodes } = buildFileTree(filesMap);
        const root = treeNodes.get('loc1');
        
        // 'folder_trailing/' becomes parts ['folder_trailing']
        // The filename is popped off making it 'folder_trailing'.
        expect(root.files).toHaveLength(1);
        expect(root.files[0].displayName).toBe('folder_trailing');
        expect(root.folders.size).toBe(0);
    });

    it('Handles multiple slashes in paths', () => {
        const filesMap = [
            { path: '//some//weird////path//name.exe', location: { id: 'loc1', type: 'local', label: 'L1' } },
        ];
        // Split by '/' and filtering '' leaves ['some', 'weird', 'path', 'name.exe']
        const { treeNodes } = buildFileTree(filesMap);
        const root = treeNodes.get('loc1');
        
        expect(root.folders.has('some')).toBe(true);
        const n1 = root.folders.get('some');
        expect(n1.folders.has('weird')).toBe(true);
        const n2 = n1.folders.get('weird');
        expect(n2.folders.has('path')).toBe(true);
        const n3 = n2.folders.get('path');
        expect(n3.files).toHaveLength(1);
        expect(n3.files[0].displayName).toBe('name.exe');
    });

});
