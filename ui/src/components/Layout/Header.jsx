import React, { useState } from 'react';
import { useStore } from '../../store';

const Header = () => {
    const dispatch = useStore(s => s.dispatch);
    const currentRoute = useStore(s => s.currentRoute);
    const nodeConfig = useStore(s => s.nodeConfig);
    const error = useStore(s => s.error);
    const [isNavOpen, setIsNavOpen] = useState(false);

    const activeRoute = currentRoute || 'files';
    const sig = nodeConfig?.signature;
    const title = sig ? `0x${sig.substring(0, 2)}...${sig.substring(sig.length - 8)}` : 'Verimus Secure Storage';

    const routeTo = (e, route) => {
        e.preventDefault();
        window.history.pushState({}, '', `/${route}`);
        dispatch({ type: 'SET_ROUTE', payload: route });
        setIsNavOpen(false);
    };

    return (
        <header>
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
                    <div className="logo-titles">
                        <h1>{title}</h1>
                        <div className="node-status">
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
                <a href="#" className={`nav-link ${activeRoute === 'files' ? 'active' : ''}`} onClick={(e) => routeTo(e, 'files')}>Files</a>
                <a href="#" className={`nav-link ${activeRoute === 'ledger' ? 'active' : ''}`} onClick={(e) => routeTo(e, 'ledger')}>Ledger</a>
                
                {(!nodeConfig?.roles || nodeConfig?.roles?.includes('ORIGINATOR')) && (
                    <a href="#" className={`nav-link ${activeRoute === 'upload' ? 'active' : ''}`} onClick={(e) => routeTo(e, 'upload')}>Upload</a>
                )}
                
                {nodeConfig?.roles?.includes('VALIDATOR') && (
                    <a href="#" className={`nav-link ${activeRoute === 'consensus' ? 'active' : ''}`} onClick={(e) => routeTo(e, 'consensus')}>Consensus</a>
                )}
                
                {nodeConfig?.roles?.includes('STORAGE') && (
                    <a href="#" className={`nav-link ${activeRoute === 'contracts' ? 'active' : ''}`} onClick={(e) => routeTo(e, 'contracts')}>Contracts</a>
                )}
                
                <a href="#" className={`nav-link ${activeRoute === 'peers' ? 'active' : ''}`} onClick={(e) => routeTo(e, 'peers')}>Network</a>
                <a href="#" className={`nav-link ${activeRoute === 'logs' ? 'active' : ''}`} onClick={(e) => routeTo(e, 'logs')}>Logs</a>
            </nav>
        </header>
    );
};

export default Header;
