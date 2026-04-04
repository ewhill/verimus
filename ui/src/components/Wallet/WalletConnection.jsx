import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { hasWeb3Provider, requestAccounts, getEncryptionPublicKey } from '../../utils/web3';

const WalletConnection = ({ isMobileDrawer }) => {
    const dispatch = useStore(s => s.dispatch);
    const web3Account = useStore(s => s.web3Account);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    useEffect(() => {
        if (!hasWeb3Provider()) return;

        const handleAccountsChanged = (accounts) => {
            if (accounts.length > 0) {
                dispatch({ type: 'SET_WEB3_ACCOUNT', payload: accounts[0] });
            } else {
                dispatch({ type: 'SET_WEB3_ACCOUNT', payload: null });
            }
        };

        const handleChainChanged = () => {
            // Recommendation from Metamask: reload page on chain change implicitly.
            window.location.reload();
        };

        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);

        return () => {
            window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
            window.ethereum.removeListener('chainChanged', handleChainChanged);
        };
    }, [dispatch]);

    const handleConnectClick = async () => {
        if (!hasWeb3Provider()) {
            return dispatch({
                type: 'ADD_TOAST',
                payload: { id: Date.now(), title: 'Metamask Missing', message: 'No Ethereum provider detected physically. Please install Metamask.', type: 'error' }
            });
        }

        try {
            setIsConnecting(true);
            const account = await requestAccounts();
            if (account) {
                dispatch({ type: 'SET_WEB3_ACCOUNT', payload: account });
                
                try {
                    const pubKey = await getEncryptionPublicKey(account);
                    dispatch({ type: 'SET_WEB3_ENCRYPTION_KEY', payload: pubKey });
                } catch (encErr) {
                    console.warn("Encryption constraints deferred locally:", encErr);
                }

                dispatch({
                    type: 'ADD_TOAST',
                    payload: { id: Date.now(), title: 'Wallet Connected', message: `Mapped ${account.substring(0, 6)}... structurally`, type: 'success' }
                });
            }
        } catch (err) {
            console.error(err);
            dispatch({
                type: 'ADD_TOAST',
                payload: { id: Date.now(), title: 'Connection Deferred', message: err.message || 'Verification halted organically.', type: 'error' }
            });
        } finally {
            setIsConnecting(false);
        }
    };

    if (web3Account) {
        if (isMobileDrawer) {
            return (
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)',
                    padding: '0.8rem 1rem', borderRadius: 'var(--radius-md)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: 0 }}>
                        <div style={{ width: '8px', height: '8px', background: '#4ade80', borderRadius: '50%', boxShadow: '0 0 8px rgba(74,222,128,0.6)', flexShrink: 0 }}></div>
                        <span style={{ color: '#818cf8', fontWeight: 600, fontFamily: 'monospace', fontSize: '1rem', flex: 1, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {web3Account}
                        </span>
                    </div>
                    <button onClick={() => {
                        dispatch({ type: 'SET_WEB3_ACCOUNT', payload: null });
                        const currentPath = window.location.pathname;
                        if (currentPath === '/wallet' || currentPath === '/files') {
                            window.history.pushState({}, '', '/ledger');
                            dispatch({ type: 'SET_ROUTE', payload: 'ledger' });
                        }
                        dispatch({ type: 'ADD_TOAST', payload: { id: Date.now(), title: 'Wallet Disconnected', message: 'You have been unmapped successfully', type: 'success' } });
                    }} style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0', transition: 'opacity 0.2s' }} onMouseOver={(e) => e.currentTarget.style.opacity = '0.7'} onMouseOut={(e) => e.currentTarget.style.opacity = '1'} title="Disconnect Wallet">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    </button>
                </div>
            );
        }

        return (
            <div style={{ position: 'relative' }}>
                <div className="wallet-pill" onClick={() => setIsDropdownOpen(!isDropdownOpen)} style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    background: 'rgba(129, 140, 248, 0.1)', border: '1px solid rgba(129, 140, 248, 0.3)',
                    padding: '0.3rem 0.8rem', borderRadius: '100px', cursor: 'pointer', transition: 'background 0.2s'
                }} onMouseOver={(e) => e.currentTarget.style.background = 'rgba(129, 140, 248, 0.2)'} onMouseOut={(e) => e.currentTarget.style.background = 'rgba(129, 140, 248, 0.1)'} title={web3Account}>
                    <div style={{ width: '8px', height: '8px', background: '#4ade80', borderRadius: '50%', boxShadow: '0 0 8px rgba(74,222,128,0.6)' }}></div>
                    <span style={{ color: '#818cf8', fontWeight: 600, fontFamily: 'monospace', fontSize: '0.9rem' }}>
                        {web3Account.substring(0, 6)}...{web3Account.substring(web3Account.length - 4)}
                    </span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
                
                {isDropdownOpen && (
                    <div style={{
                        position: 'absolute', top: 'calc(100% + 0.5rem)', right: '0', background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '0.5rem', zIndex: 100, boxShadow: '0 4px 20px rgba(0,0,0,0.5)', minWidth: '180px'
                    }}>
                        <button onClick={() => {
                            dispatch({ type: 'SET_WEB3_ACCOUNT', payload: null });
                            setIsDropdownOpen(false);
                            // If user is inside a protected route, we route them back to ledger
                            const currentPath = window.location.pathname;
                            if (currentPath === '/wallet' || currentPath === '/files') {
                                window.history.pushState({}, '', '/ledger');
                                dispatch({ type: 'SET_ROUTE', payload: 'ledger' });
                            }
                            dispatch({ type: 'ADD_TOAST', payload: { id: Date.now(), title: 'Wallet Disconnected', message: 'You have been unmapped successfully', type: 'success' } });
                        }} style={{ width: '100%', padding: '0.6rem 0.5rem', background: 'transparent', border: 'none', color: '#f87171', textAlign: 'left', cursor: 'pointer', borderRadius: '4px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'background 0.2s' }} onMouseOver={(e) => e.currentTarget.style.background = 'rgba(248, 113, 113, 0.1)'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                            Disconnect Wallet
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <button
            onClick={handleConnectClick}
            disabled={isConnecting}
            style={{
                marginLeft: isMobileDrawer ? '0' : '0.5rem', padding: '0.6rem 1rem', background: 'transparent',
                color: '#818cf8', border: '1px solid #818cf8', borderRadius: '100px', fontWeight: '600',
                cursor: isConnecting ? 'not-allowed' : 'pointer', transition: 'background 0.2s',
                opacity: isConnecting ? 0.7 : 1, width: isMobileDrawer ? '100%' : 'auto'
            }}
            onMouseOver={(e) => !isConnecting && (e.currentTarget.style.background = 'rgba(129, 140, 248, 0.1)')}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
        >
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
    );
};

export default WalletConnection;
