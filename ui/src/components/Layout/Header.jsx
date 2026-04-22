import React, { useState } from 'react';
import { useStore } from '../../store';
import WalletConnection from '../Wallet/WalletConnection';
import GlobalStatsBanner from './GlobalStatsBanner';

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
    const title = sig ? `0x${sig.substring(0, 2)}...${sig.substring(sig.length - 8)}` : 'Verimus';

    const routeTo = (e, route) => {
        if (e) e.preventDefault();

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

    const handleOmnibarSearch = (e) => {
        e.preventDefault();
        const query = e.target.omnibar.value.trim();
        if (!query) return;

        if (query.startsWith('0x') && query.length === 42) {
            // Ethers Address -> Navigate to Wallet lookup implicitly or Ledger
            dispatch({ type: 'SET_ROUTE', payload: 'ledger' });
            dispatch({ type: 'SET_LEDGER_TAB', payload: 'global' });
        } else if (query.length === 64) {
            // Hash -> Open Block Modal
            dispatch({ type: 'SET_MODAL_OPEN', payload: { isOpen: true, hash: query } });
        } else {
            // Generic fallback searches against Contracts
            dispatch({ type: 'SET_ROUTE', payload: 'ledger' });
            dispatch({ type: 'SET_LEDGER_TAB', payload: 'contracts' });
        }
        e.target.omnibar.value = '';
    };

    const pagesList = (
        <>
            {web3Account && (
                <>
                    <a href="#" className={`nav-link ${activeRoute === 'wallet' ? 'active' : ''}`} onClick={(e) => routeTo(e, 'wallet')}>Wallet</a>
                    <a href="#" className={`nav-link ${activeRoute === 'files' ? 'active' : ''}`} onClick={(e) => routeTo(e, 'files')}>Storage</a>
                </>
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



    const mobileDrawerLinks = (
        <div className="mobile-accordion-wrapper">
            {web3Account && (
                <div className="mobile-accordion-group">
                    <a href="#" style={{ paddingTop: '0' }} className={`mobile-accordion-header ${activeRoute === 'wallet' ? 'active' : ''}`} onClick={(e) => routeTo(e, 'wallet')}>
                        Wallet
                    </a>
                </div>
            )}
            {web3Account && (
                <div className="mobile-accordion-group">
                    <a href="#" className={`mobile-accordion-header ${activeRoute === 'files' ? 'active' : ''}`} onClick={(e) => routeTo(e, 'files')}>
                        Data Storage
                    </a>
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

                        {nodeConfig?.roles?.includes('VALIDATOR') && (
                            <button className={`mobile-nested-item ${activeLedgerTab === 'consensus' ? 'active' : ''}`} onClick={(e) => { dispatch({ type: 'SET_LEDGER_TAB', payload: 'consensus' }); routeTo(e, 'ledger'); }}>Consensus</button>
                        )}
                        {nodeConfig?.roles?.includes('STORAGE') && (
                            <button className={`mobile-nested-item ${activeLedgerTab === 'contracts' ? 'active' : ''}`} onClick={(e) => { dispatch({ type: 'SET_LEDGER_TAB', payload: 'contracts' }); routeTo(e, 'ledger'); }}>Contracts</button>
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
            <GlobalStatsBanner />
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
                        <div className={`logo-titles ${nodeConfig?.isAdmin ? 'node-identity-trigger' : 'node-identity-trigger'}`} onClick={() => {
                            if (nodeConfig?.isAdmin) {
                                dispatch({ type: 'SET_NODE_CONFIG_MODAL_OPEN', payload: true });
                            } else {
                                const pass = window.prompt("Enter Node Admin Password:");
                                if (pass) {
                                    const b64 = window.btoa(`admin:${pass}`);
                                    localStorage.setItem('verimus_admin_auth', b64);
                                    window.location.reload();
                                }
                            }
                        }} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-sm)', transition: 'background 0.2s', margin: '-0.2rem -0.5rem' }} onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'} title="Configure Node Settings">
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

                <form className="omnibar desktop-only" onSubmit={handleOmnibarSearch} style={{ display: 'flex', flex: 1, margin: '0 2rem', position: 'relative', maxWidth: '600px' }}>
                    <input
                        name="omnibar"
                        type="text"
                        placeholder="Search blocks, txns, or wallet addresses..."
                        style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.8rem', borderRadius: '20px', border: '1px solid var(--border-soft)', background: 'rgba(15, 23, 42, 0.4)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }}
                    />
                    <svg style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                </form>

                <nav className="main-nav desktop-only">
                    {pagesList}
                    {navActions}
                </nav>
            </div>



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
