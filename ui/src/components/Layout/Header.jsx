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
    const web3EncryptionKey = useStore(s => s.web3EncryptionKey);
    const [isNavOpen, setIsNavOpen] = useState(false);

    const activeRoute = currentRoute || 'files';
    const [expandedAccordion, setExpandedAccordion] = useState(activeRoute);

    const handleAccordionToggle = (e, route) => {
        if (e) e.preventDefault();
        setExpandedAccordion(prev => prev === route ? null : route);
    };
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

    const pagesList = (
        <>
            {web3Account && (
                <a href="#" className={`nav-link ${activeRoute === 'wallet' ? 'active' : ''}`} onClick={(e) => routeTo(e, 'wallet')}>Wallet</a>
            )}
            <a href="#" className={`nav-link ${activeRoute === 'ledger' ? 'active' : ''}`} onClick={(e) => routeTo(e, 'ledger')}>Ledger</a>
            {nodeConfig?.isAdmin && (
                <a href="#" className={`nav-link ${activeRoute === 'network' ? 'active' : ''}`} onClick={(e) => routeTo(e, 'network')}>Network</a>
            )}
        </>
    );

    const navActions = (
        <div className="nav-actions">
            {(nodeConfig?.roles?.includes('ORIGINATOR') && web3EncryptionKey) && (
                <button 
                    className="nav-upload-btn"
                    onClick={() => dispatch({ type: 'SET_UPLOAD_MODAL_OPEN', payload: true })}
                >
                    Upload File
                </button>
            )}

            <WalletConnection />
        </div>
    );

    const tabsList = ['wallet', 'ledger', 'network'].includes(activeRoute) ? (
        <div className="segmented-control" style={{ display: 'flex', gap: '0.5rem', width: '100%', maxWidth: '1400px' }}>
            {activeRoute === 'wallet' && (
                <>
                    <button className={`segmented-btn ${activeWalletTab === 'dashboard' ? 'active' : ''}`} onClick={() => { dispatch({ type: 'SET_WALLET_TAB', payload: 'dashboard' }); setIsNavOpen(false); }} style={{ flex: 1 }}>Wallet Dashboard</button>
                    <button className={`segmented-btn ${activeWalletTab === 'assets' ? 'active' : ''}`} onClick={() => { dispatch({ type: 'SET_WALLET_TAB', payload: 'assets' }); setIsNavOpen(false); }} style={{ flex: 1 }}>Asset Files</button>
                </>
            )}
            {activeRoute === 'ledger' && (
                <>
                    <button className={`segmented-btn ${activeLedgerTab === 'global' ? 'active' : ''}`} onClick={() => { dispatch({ type: 'SET_LEDGER_TAB', payload: 'global' }); setIsNavOpen(false); }} style={{ flex: 1 }}>Global Ledger</button>
                    <button className={`segmented-btn ${activeLedgerTab === 'audit' ? 'active' : ''}`} onClick={() => { dispatch({ type: 'SET_LEDGER_TAB', payload: 'audit' }); setIsNavOpen(false); }} style={{ flex: 1 }}>Sortition Audits</button>
                    {nodeConfig?.roles?.includes('VALIDATOR') && (
                        <button className={`segmented-btn ${activeLedgerTab === 'consensus' ? 'active' : ''}`} onClick={() => { dispatch({ type: 'SET_LEDGER_TAB', payload: 'consensus' }); setIsNavOpen(false); }} style={{ flex: 1 }}>Mempool Monitor</button>
                    )}
                    {nodeConfig?.roles?.includes('STORAGE') && (
                        <button className={`segmented-btn ${activeLedgerTab === 'contracts' ? 'active' : ''}`} onClick={() => { dispatch({ type: 'SET_LEDGER_TAB', payload: 'contracts' }); setIsNavOpen(false); }} style={{ flex: 1 }}>Active Contracts</button>
                    )}
                </>
            )}
            {(nodeConfig?.isAdmin && activeRoute === 'network') && (
                <>
                    <button className={`segmented-btn ${activePeersTab === 'mesh' ? 'active' : ''}`} onClick={() => { dispatch({ type: 'SET_PEERS_TAB', payload: 'mesh' }); setIsNavOpen(false); }} style={{ flex: 1 }}>Network Mesh</button>
                    <button className={`segmented-btn ${activePeersTab === 'reputation' ? 'active' : ''}`} onClick={() => { dispatch({ type: 'SET_PEERS_TAB', payload: 'reputation' }); setIsNavOpen(false); }} style={{ flex: 1 }}>Global Reputation</button>
                    <button className={`segmented-btn ${activePeersTab === 'logs' ? 'active' : ''}`} onClick={() => { dispatch({ type: 'SET_PEERS_TAB', payload: 'logs' }); setIsNavOpen(false); }} style={{ flex: 1 }}>System Logs</button>
                </>
            )}
        </div>
    ) : null;

    const mobileDrawerLinks = (
        <div className="mobile-accordion-wrapper">
            {web3Account && (
                <div className="mobile-accordion-group">
                    <a href="#" className={`mobile-accordion-header ${expandedAccordion === 'wallet' ? 'active' : ''}`} onClick={(e) => handleAccordionToggle(e, 'wallet')}>
                        Wallet
                        <div className="mobile-accordion-cta">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: expandedAccordion === 'wallet' ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                    </a>
                    {expandedAccordion === 'wallet' && (
                        <div className="mobile-nested-group" style={{ animation: 'fadeInDown 0.2s ease-out' }}>
                            <button className={`mobile-nested-item ${activeWalletTab === 'dashboard' ? 'active' : ''}`} onClick={(e) => { dispatch({ type: 'SET_WALLET_TAB', payload: 'dashboard' }); routeTo(e, 'wallet'); }}>Wallet Dashboard</button>
                            <button className={`mobile-nested-item ${activeWalletTab === 'assets' ? 'active' : ''}`} onClick={(e) => { dispatch({ type: 'SET_WALLET_TAB', payload: 'assets' }); routeTo(e, 'wallet'); }}>Asset Files</button>
                        </div>
                    )}
                </div>
            )}

            <div className="mobile-accordion-group">
                <a href="#" className={`mobile-accordion-header ${expandedAccordion === 'ledger' ? 'active' : ''}`} onClick={(e) => handleAccordionToggle(e, 'ledger')}>
                    Ledger
                    <div className="mobile-accordion-cta">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: expandedAccordion === 'ledger' ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </div>
                </a>
                {expandedAccordion === 'ledger' && (
                    <div className="mobile-nested-group" style={{ animation: 'fadeInDown 0.2s ease-out' }}>
                        <button className={`mobile-nested-item ${activeLedgerTab === 'global' ? 'active' : ''}`} onClick={(e) => { dispatch({ type: 'SET_LEDGER_TAB', payload: 'global' }); routeTo(e, 'ledger'); }}>Global Ledger</button>
                        <button className={`mobile-nested-item ${activeLedgerTab === 'audit' ? 'active' : ''}`} onClick={(e) => { dispatch({ type: 'SET_LEDGER_TAB', payload: 'audit' }); routeTo(e, 'ledger'); }}>Sortition Audits</button>
                        {nodeConfig?.roles?.includes('VALIDATOR') && (
                            <button className={`mobile-nested-item ${activeLedgerTab === 'consensus' ? 'active' : ''}`} onClick={(e) => { dispatch({ type: 'SET_LEDGER_TAB', payload: 'consensus' }); routeTo(e, 'ledger'); }}>Mempool Monitor</button>
                        )}
                        {nodeConfig?.roles?.includes('STORAGE') && (
                            <button className={`mobile-nested-item ${activeLedgerTab === 'contracts' ? 'active' : ''}`} onClick={(e) => { dispatch({ type: 'SET_LEDGER_TAB', payload: 'contracts' }); routeTo(e, 'ledger'); }}>Active Contracts</button>
                        )}
                    </div>
                )}
            </div>

            {nodeConfig?.isAdmin && (
                <div className="mobile-accordion-group">
                    <a href="#" className={`mobile-accordion-header ${expandedAccordion === 'network' ? 'active' : ''}`} onClick={(e) => handleAccordionToggle(e, 'network')}>
                        Network
                        <div className="mobile-accordion-cta">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: expandedAccordion === 'network' ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                    </a>
                    {expandedAccordion === 'network' && (
                        <div className="mobile-nested-group" style={{ animation: 'fadeInDown 0.2s ease-out' }}>
                            <button className={`mobile-nested-item ${activePeersTab === 'mesh' ? 'active' : ''}`} onClick={(e) => { dispatch({ type: 'SET_PEERS_TAB', payload: 'mesh' }); routeTo(e, 'network'); }}>Network Mesh</button>
                            <button className={`mobile-nested-item ${activePeersTab === 'reputation' ? 'active' : ''}`} onClick={(e) => { dispatch({ type: 'SET_PEERS_TAB', payload: 'reputation' }); routeTo(e, 'network'); }}>Global Reputation</button>
                            <button className={`mobile-nested-item ${activePeersTab === 'logs' ? 'active' : ''}`} onClick={(e) => { dispatch({ type: 'SET_PEERS_TAB', payload: 'logs' }); routeTo(e, 'network'); }}>System Logs</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );

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
                        <div className={`logo-titles ${nodeConfig?.isAdmin ? 'node-identity-trigger' : ''}`} onClick={() => nodeConfig?.isAdmin && dispatch({ type: 'SET_NODE_CONFIG_MODAL_OPEN', payload: true })} style={{ cursor: nodeConfig?.isAdmin ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-sm)', transition: 'background 0.2s', margin: '-0.2rem -0.5rem' }} onMouseOver={(e) => nodeConfig?.isAdmin && (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'} title={nodeConfig?.isAdmin ? "Configure Node Settings" : ""}>
                            <h1 style={{ cursor: nodeConfig?.isAdmin ? 'pointer' : 'default' }}>{title}</h1>
                            <div className="node-status" style={{ cursor: nodeConfig?.isAdmin ? 'pointer' : 'default' }}>
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
                <nav className="main-nav desktop-only">
                    {pagesList}
                    {navActions}
                </nav>
            </div>

            {tabsList && (
                <div className="header-sub-tier desktop-only">
                    {tabsList}
                </div>
            )}

            <div className={`mobile-drawer ${isNavOpen ? 'active' : ''}`}>
                <div className="mobile-drawer-header">
                    <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#f8fafc' }}>Menu</h2>
                    <button className="hamburger-menu" onClick={() => setIsNavOpen(false)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                
                <div className="mobile-drawer-scroll">
                    <div style={{ paddingBottom: '2rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', marginBottom: '1.5rem', width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <WalletConnection isMobileDrawer={true} />
                        {(nodeConfig?.roles?.includes('ORIGINATOR') && web3EncryptionKey) && (
                            <button 
                                className="nav-upload-btn" style={{ width: '100%', padding: '0.8rem' }}
                                onClick={() => { setIsNavOpen(false); dispatch({ type: 'SET_UPLOAD_MODAL_OPEN', payload: true }); }}
                            >
                                Upload File
                            </button>
                        )}
                    </div>
                    {mobileDrawerLinks}
                </div>
            </div>
        </header>
    );
};

export default Header;
