import React, { useState } from 'react';
import { useStore } from '../../store';
import WalletConnection from '../Wallet/WalletConnection';

const Header = () => {
    const dispatch = useStore(s => s.dispatch);
    const currentRoute = useStore(s => s.currentRoute);
    const activeWalletTab = useStore(s => s.activeWalletTab);
    const activeLedgerTab = useStore(s => s.activeLedgerTab);
    const activePeersTab = useStore(s => s.activePeersTab);
    const nodeConfig = useStore(s => s.nodeConfig);
    const error = useStore(s => s.error);
    const web3Account = useStore(s => s.web3Account);
    const [isNavOpen, setIsNavOpen] = useState(false);

    const activeRoute = currentRoute || 'files';
    const sig = nodeConfig?.signature;
    const title = sig ? `0x${sig.substring(0, 2)}...${sig.substring(sig.length - 8)}` : 'Verimus Secure Storage';

    const routeTo = (e, route) => {
        e.preventDefault();
        
        let tabSegment = '';
        if (route === 'wallet') tabSegment = activeWalletTab;
        else if (route === 'ledger') tabSegment = activeLedgerTab;
        else if (route === 'network') tabSegment = activePeersTab;

        const targetUri = `/${route}${tabSegment ? `/${tabSegment}` : ''}`;
        if (window.location.pathname !== targetUri) {
            window.history.pushState({}, '', targetUri);
        }

        dispatch({ type: 'SET_ROUTE', payload: route });
        setIsNavOpen(false);
    };

    return (
        <header>
            <div className="header-primary">
                <div className="header-top">
                    <div className="logo">
                        <div className="logo-icon-svg" style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '38px',
                            height: '38px',
                            borderRadius: '12px',
                            background: '#020617',
                            border: '1px solid rgba(192, 132, 252, 0.4)',
                            boxShadow: '0 0 20px rgba(129, 140, 248, 0.5), inset 0 0 10px rgba(129, 140, 248, 0.2)'
                        }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <defs>
                                    <linearGradient id="neonGradient" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                                        <stop stopColor="#c084fc" />
                                        <stop offset="0.5" stopColor="#818cf8" />
                                        <stop offset="1" stopColor="#38bdf8" />
                                    </linearGradient>
                                </defs>
                                <circle cx="12" cy="12" r="8.5" stroke="url(#neonGradient)" strokeWidth="3.5" />
                                <path d="M12 6L18 12L12 18L6 12L12 6Z" fill="#ffffff" />
                            </svg>
                        </div>
                        <div className="logo-titles node-identity-trigger" onClick={() => dispatch({ type: 'SET_NODE_CONFIG_MODAL_OPEN', payload: true })} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-sm)', transition: 'background 0.2s', margin: '-0.2rem -0.5rem' }} onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'} title="Configure Node Settings">
                            <h1 style={{ cursor: 'pointer' }}>{title}</h1>
                            <div className="node-status" style={{ cursor: 'pointer' }}>
                                <span className={`status-indicator ${error ? 'offline' : 'active'}`}></span> {error ? 'Node Offline' : 'Node Online'}
                            </div>
                        </div>
                    </div>
                    <button
                        className="hamburger-menu"
                        aria-label="Toggle Navigation"
                        onClick={() => setIsNavOpen(!isNavOpen)}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="3" y1="12" x2="21" y2="12"></line>
                            <line x1="3" y1="6" x2="21" y2="6"></line>
                            <line x1="3" y1="18" x2="21" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <nav className={`main-nav ${isNavOpen ? 'active' : ''}`}>
                    {web3Account && (
                        <a href="#" className={`nav-link ${activeRoute === 'wallet' ? 'active' : ''}`} onClick={(e) => routeTo(e, 'wallet')}>Wallet</a>
                    )}
                    <a href="#" className={`nav-link ${activeRoute === 'ledger' ? 'active' : ''}`} onClick={(e) => routeTo(e, 'ledger')}>Ledger</a>
                    <a href="#" className={`nav-link ${activeRoute === 'network' ? 'active' : ''}`} onClick={(e) => routeTo(e, 'network')}>Network</a>

                    <div style={{ marginLeft: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <WalletConnection />

                        {(nodeConfig?.roles?.includes('ORIGINATOR')) && (
                            <button 
                                onClick={() => dispatch({ type: 'SET_UPLOAD_MODAL_OPEN', payload: true })}
                            style={{ marginLeft: '1rem', padding: '0.4rem 1rem', background: '#4ade80', color: '#000000', border: 'none', borderRadius: '100px', fontWeight: '600', cursor: 'pointer', transition: 'transform 0.2s, background 0.2s', boxShadow: '0 4px 10px rgba(74, 222, 128, 0.3)' }}
                            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                                Upload File
                            </button>
                        )}
                    </div>
                </nav>
            </div>

            {['wallet', 'ledger', 'network'].includes(activeRoute) && (
                <div className="header-sub-tier">
                    <div className="segmented-control" style={{ display: 'flex', gap: '0.5rem', width: '100%', maxWidth: '1400px' }}>
                        {activeRoute === 'wallet' && (
                            <>
                                <button className={`segmented-btn ${activeWalletTab === 'dashboard' ? 'active' : ''}`} onClick={() => dispatch({ type: 'SET_WALLET_TAB', payload: 'dashboard' })} style={{ flex: 1 }}>Wallet Dashboard</button>
                                <button className={`segmented-btn ${activeWalletTab === 'assets' ? 'active' : ''}`} onClick={() => dispatch({ type: 'SET_WALLET_TAB', payload: 'assets' })} style={{ flex: 1 }}>Asset Files</button>
                            </>
                        )}
                        {activeRoute === 'ledger' && (
                            <>
                                <button className={`segmented-btn ${activeLedgerTab === 'global' ? 'active' : ''}`} onClick={() => dispatch({ type: 'SET_LEDGER_TAB', payload: 'global' })} style={{ flex: 1 }}>Global Ledger</button>
                                <button className={`segmented-btn ${activeLedgerTab === 'audit' ? 'active' : ''}`} onClick={() => dispatch({ type: 'SET_LEDGER_TAB', payload: 'audit' })} style={{ flex: 1 }}>Sortition Audits</button>
                                {nodeConfig?.roles?.includes('VALIDATOR') && (
                                    <button className={`segmented-btn ${activeLedgerTab === 'consensus' ? 'active' : ''}`} onClick={() => dispatch({ type: 'SET_LEDGER_TAB', payload: 'consensus' })} style={{ flex: 1 }}>Mempool Monitor</button>
                                )}
                                {nodeConfig?.roles?.includes('STORAGE') && (
                                    <button className={`segmented-btn ${activeLedgerTab === 'contracts' ? 'active' : ''}`} onClick={() => dispatch({ type: 'SET_LEDGER_TAB', payload: 'contracts' })} style={{ flex: 1 }}>Active Contracts</button>
                                )}
                            </>
                        )}
                        {activeRoute === 'network' && (
                            <>
                                <button className={`segmented-btn ${activePeersTab === 'mesh' ? 'active' : ''}`} onClick={() => dispatch({ type: 'SET_PEERS_TAB', payload: 'mesh' })} style={{ flex: 1 }}>Network Mesh</button>
                                <button className={`segmented-btn ${activePeersTab === 'reputation' ? 'active' : ''}`} onClick={() => dispatch({ type: 'SET_PEERS_TAB', payload: 'reputation' })} style={{ flex: 1 }}>Global Reputation</button>
                                <button className={`segmented-btn ${activePeersTab === 'logs' ? 'active' : ''}`} onClick={() => dispatch({ type: 'SET_PEERS_TAB', payload: 'logs' })} style={{ flex: 1 }}>System Logs</button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </header>
    );
};

export default Header;
