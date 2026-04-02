import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { hasWeb3Provider, requestAccounts } from '../../utils/web3';

const WalletConnection = () => {
    const dispatch = useStore(s => s.dispatch);
    const web3Account = useStore(s => s.web3Account);
    const [isConnecting, setIsConnecting] = useState(false);

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
        return (
            <div className="wallet-pill" style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                background: 'rgba(129, 140, 248, 0.1)', border: '1px solid rgba(129, 140, 248, 0.3)',
                padding: '0.3rem 0.8rem', borderRadius: '100px', cursor: 'pointer', transition: 'background 0.2s'
            }} onMouseOver={(e) => e.currentTarget.style.background = 'rgba(129, 140, 248, 0.2)'} onMouseOut={(e) => e.currentTarget.style.background = 'rgba(129, 140, 248, 0.1)'} title={web3Account}>
                <div style={{ width: '8px', height: '8px', background: '#4ade80', borderRadius: '50%', boxShadow: '0 0 8px rgba(74,222,128,0.6)' }}></div>
                <span style={{ color: '#818cf8', fontWeight: 600, fontFamily: 'monospace', fontSize: '0.9rem' }}>
                    {web3Account.substring(0, 6)}...{web3Account.substring(web3Account.length - 4)}
                </span>
            </div>
        );
    }

    return (
        <button
            onClick={handleConnectClick}
            disabled={isConnecting}
            style={{
                marginLeft: '0.5rem', padding: '0.4rem 1rem', background: 'transparent',
                color: '#818cf8', border: '1px solid #818cf8', borderRadius: '100px', fontWeight: '600',
                cursor: isConnecting ? 'not-allowed' : 'pointer', transition: 'background 0.2s',
                opacity: isConnecting ? 0.7 : 1
            }}
            onMouseOver={(e) => !isConnecting && (e.currentTarget.style.background = 'rgba(129, 140, 248, 0.1)')}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
        >
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
    );
};

export default WalletConnection;
