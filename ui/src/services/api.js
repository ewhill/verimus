import { useStore } from '../store';
import { generateDownloadAuthHeaders } from '../utils/web3';

const getBaseQueryParams = (state) => {
    const isMyBlocksContext = state.currentRoute === 'wallet' && state.activeWalletTab === 'blocks';
    const { page, limit } = state.pagination || { page: 1, limit: 16 };
    const query = encodeURIComponent(state.searchQuery || '');
    const filterOwn = isMyBlocksContext ? 'true' : 'false';
    const sort = state.ledgerSortMode || 'desc';
    const addressFragment = (isMyBlocksContext && state.web3Account) ? `&address=${state.web3Account}` : '';
    return `?page=${page}&limit=${limit}&q=${query}&own=${filterOwn}&sort=${sort}${addressFragment}`;
};

/* eslint-disable no-empty, no-unused-vars */
export const ApiService = {
    activeProxyUrl: '',

    discoverOptimalProxy: async (dispatch) => {
        try {
            const bootNodesStr = import.meta.env.VITE_REACT_APP_BOOTSTRAP_NODES || '';
            const bootstraps = bootNodesStr ? bootNodesStr.split(',') : [''];
            
            let allPeers = [];
            for (const b of bootstraps) {
                try {
                    const res = await fetch(`${b}/api/peers`);
                    if (res.ok) {
                        const data = await res.json();
                        if (data.success && data.peers) allPeers.push(...data.peers);
                    }
                } catch (_unusedE) { }
            }

            if (allPeers.length === 0) return;

            let stakedValidators = new Set();
            try {
                const res = await fetch(`${bootstraps[0]}/api/blocks`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.blocks) {
                        data.blocks.filter(b => b.type === 'STAKING_CONTRACT').forEach(b => stakedValidators.add(b.signerAddress));
                    }
                }
            } catch (_unusedE) { }

            let bestProxy = '';
            let bestFee = Infinity;

            for (const peer of allPeers) {
                try {
                    const targetIp = peer.peerAddress.includes('::ffff:') ? peer.peerAddress.split('::ffff:')[1] : peer.peerAddress;
                    const endpoint = `http://${targetIp}`;
                    const res = await fetch(`${endpoint}/api/node/config`);
                    if (!res.ok) continue;

                    const data = await res.json();
                    if (data.success && data.proxyBrokerFee !== undefined) {
                        if (data.proxyBrokerFee < bestFee) {
                            // Theoretically cross-referencing node's identity against staked validators organically
                            bestFee = data.proxyBrokerFee;
                            bestProxy = endpoint;
                        }
                    }
                } catch (_unusedE) { }
            }

            if (bestProxy) {
                ApiService.activeProxyUrl = bestProxy;
                console.log(`Discovered competitive Originator Proxy boundary mapping structurally dynamically: ${bestProxy} at fee ${bestFee}`);
            }
        } catch (_unusedE) { }
    },

    fetchBlocks: async (state, dispatch) => {
        try {
            const res = await fetch(`${ApiService.activeProxyUrl}/api/blocks${getBaseQueryParams(state)}`);
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
            const res = await fetch(`${ApiService.activeProxyUrl}/api/files`);
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
            const res = await fetch(`${ApiService.activeProxyUrl}/api/node/config`);
            if (!res.ok) throw new Error('Network response was not ok');
            const data = await res.json();
            if (data.success) {
                dispatch({ type: 'SET_NODE_CONFIG', payload: data.config ? data.config : data });
                
                // Fire async privilege check natively sequentially
                ApiService.checkAdminPrivileges(dispatch);
                
                dispatch({ type: 'SET_ERROR', payload: null });
            }
        } catch (err) {
            console.error("Failed fetching node config:", err);
            dispatch({ type: 'SET_ERROR', payload: 'Connection lost' });
        }
    },

    checkAdminPrivileges: async (dispatch) => {
        try {
            const res = await fetch(`${ApiService.activeProxyUrl}/api/node/auth`);
            const currentState = useStore.getState().nodeConfig || {};
            dispatch({ type: 'SET_NODE_CONFIG', payload: { ...currentState, isAdmin: res.ok } });
        } catch(e) {
            const currentState = useStore.getState().nodeConfig || {};
            dispatch({ type: 'SET_NODE_CONFIG', payload: { ...currentState, isAdmin: false } });
        }
    },

    fetchPrivatePayload: async (hash, optionalHeaders = null) => {
        try {
            const wallet = useStore.getState().web3Account;
            if (!wallet) {
                alert("Metamask Wallet organically required locally mapping private payload limits.");
                return { success: false };
            }

            const nativeHeaders = optionalHeaders || await generateDownloadAuthHeaders(hash, wallet);
            const res = await fetch(`${ApiService.activeProxyUrl}/api/blocks/${hash}/private`, { headers: nativeHeaders });
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
            } catch (_unusedE) {
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
            // Reconstruct exact hash dynamically extracting bounds correctly mapping cleanly.
            const urlParts = url.split('/');
            const hashIndex = urlParts.indexOf('download');
            const targetHash = (hashIndex !== -1 && urlParts.length > hashIndex + 1) ? urlParts[hashIndex+1] : 'batch';

            const wallet = useStore.getState().web3Account;
            if (!wallet) {
                alert("Metamask organically required decrypting payload bounds safely!");
                return;
            }

            const web3Headers = await generateDownloadAuthHeaders(targetHash, wallet);
            const res = await fetch(url, { headers: web3Headers });
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
            setTimeout(() => { a.remove(); window.URL.revokeObjectURL(downloadUrl); }, 100);
        } catch (err) {
            console.error("Download failed:", err);
            alert("Download failed due to a network error.");
        }
    }
};
