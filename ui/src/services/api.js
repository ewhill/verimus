import { useStore } from '../store';

const getBaseQueryParams = (state) => {
    const { page, limit } = state.pagination || { page: 1, limit: 16 };
    const query = encodeURIComponent(state.searchQuery || '');
    const filterOwn = state.filterOwn ? 'true' : 'false';
    const sort = state.ledgerSortMode || 'desc';
    const filterCheckpoints = state.filterCheckpoints ? '&type=checkpoint' : '';
    return `?page=${page}&limit=${limit}&q=${query}&own=${filterOwn}&sort=${sort}${filterCheckpoints}`;
};

export const ApiService = {
    fetchBlocks: async (state, dispatch) => {
        try {
            const res = await fetch(`/api/blocks${getBaseQueryParams(state)}`);
            if (!res.ok) throw new Error('Network response was not ok');
            const data = await res.json();
            if (data.success) {
                dispatch({ type: 'SET_BLOCKS', payload: { blocks: data.blocks, pagination: data.pagination } });
                dispatch({ type: 'SET_ERROR', payload: null });
            }
        } catch (err) {
            console.error("Failed fetching blocks:", err);
            dispatch({ type: 'SET_ERROR', payload: 'Connection lost' });
        }
    },
    
    fetchFiles: async (dispatch) => {
        try {
            const res = await fetch('/api/files');
            if (!res.ok) throw new Error('Network response was not ok');
            const data = await res.json();
            if (data.success) {
                dispatch({ type: 'SET_FILES_MAP', payload: data.files });
                dispatch({ type: 'SET_ERROR', payload: null });
            }
        } catch (err) {
            console.error("Failed fetching files cache:", err);
            dispatch({ type: 'SET_ERROR', payload: 'Connection lost' });
        }
    },
    
    fetchNodeConfig: async (dispatch) => {
        try {
            const res = await fetch('/api/node/config');
            if (!res.ok) throw new Error('Network response was not ok');
            const data = await res.json();
            if (data.success) {
                dispatch({ type: 'SET_NODE_CONFIG', payload: data });
                dispatch({ type: 'SET_ERROR', payload: null });
            }
        } catch (err) {
            console.error("Failed fetching node config:", err);
            dispatch({ type: 'SET_ERROR', payload: 'Connection lost' });
        }
    },

    fetchPrivatePayload: async (hash) => {
        try {
            const res = await fetch(`/api/blocks/${hash}/private`);
            if (!res.ok) throw new Error('Network response was not ok');
            return await res.json();
        } catch (err) {
            console.error("Failed fetching private payload bounds:", err);
            return { success: false };
        }
    },

    startPollingJob: (url, fallbackFilename, isResume = false) => {
        const STORAGE_KEY = 'verimus_pending_downloads';
        
        if (!isResume) {
            try {
                let pending = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
                if (!pending.some(p => p.url === url)) {
                    pending.push({ url, fallbackFilename, timestamp: Date.now() });
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
                }
            } catch(e) {}
        }

        const statusUrl = url.includes('?') ? url + '&statusOnly=true' : url + '?statusOnly=true';
        const pollInterval = setInterval(async () => {
            try {
                const statusRes = await fetch(statusUrl);
                if (statusRes.status === 200) {
                    clearInterval(pollInterval);
                    
                    try {
                        let pending = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
                        pending = pending.filter(p => p.url !== url);
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
                    } catch(e) {}
                    
                    useStore.getState().dispatch({ 
                        type: 'UPDATE_TOAST', 
                        payload: { id: url, status: 'success', title: 'Download Ready', message: `Your file ${fallbackFilename} is ready! Click download again.` } 
                    });
                    
                    // Auto dismiss success toast after a bit
                    setTimeout(() => {
                        useStore.getState().dispatch({ type: 'REMOVE_TOAST', payload: url });
                    }, 5000);
                    
                } else if (statusRes.status !== 202) {
                    // It failed or is no longer retrievable
                    clearInterval(pollInterval);
                    useStore.getState().dispatch({ type: 'REMOVE_TOAST', payload: url });
                    try {
                        let pending = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
                        pending = pending.filter(p => p.url !== url);
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
                    } catch(e) {}
                }
            } catch (e) {
                 // check failed, ignore to poll again
            }
        }, 10000);
    },

    resumePendingDownloads: () => {
        try {
            const pending = JSON.parse(localStorage.getItem('verimus_pending_downloads') || '[]');
            pending.forEach(job => {
                useStore.getState().dispatch({ 
                    type: 'ADD_TOAST', 
                    payload: { id: job.url, status: 'pending', title: 'Tracking Restored', message: `Resuming background tracking for ${job.fallbackFilename}...` } 
                });
                ApiService.startPollingJob(job.url, job.fallbackFilename, true);
            });
        } catch(e) {}
    },

    downloadFile: async (url, fallbackFilename = 'download') => {
        try {
            const res = await fetch(url);
            if (res.status === 202) {
                const msg = await res.text();
                useStore.getState().dispatch({ 
                    type: 'ADD_TOAST', 
                    payload: { id: url, status: 'pending', title: 'Retrieval Initiated', message: msg } 
                });
                ApiService.startPollingJob(url, fallbackFilename);
                return;
            } else if (!res.ok) {
                const msg = await res.text();
                alert(`Download Error:\n\n${msg}`);
                return;
            }

            const blob = await res.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            
            let filename = fallbackFilename;
            const disposition = res.headers.get('content-disposition');
            if (disposition && disposition.indexOf('attachment') !== -1) {
                var filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                var matches = filenameRegex.exec(disposition);
                if (matches != null && matches[1]) { 
                    filename = matches[1].replace(/['"]/g, '');
                }
            }
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(downloadUrl);
        } catch (err) {
            console.error("Download failed:", err);
            alert("Download failed due to a network error.");
        }
    }
};
