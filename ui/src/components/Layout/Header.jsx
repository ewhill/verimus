import React, { useState, useRef } from 'react';
import { useStore } from '../../store';
import WalletConnection from '../Wallet/WalletConnection';
const Header = () => {
    const dispatch = useStore(s => s.dispatch);
    const isWalletConnecting = useStore(s => s.isWalletConnecting);
    const currentRoute = useStore(s => s.currentRoute);
    const activeWalletTab = useStore(s => s.activeWalletTab);
    const activeLedgerTab = useStore(s => s.activeLedgerTab);
    const activePeersTab = useStore(s => s.activePeersTab);
    const nodeConfig = useStore(s => s.nodeConfig);
    const error = useStore(s => s.error);
    const web3Account = useStore(s => s.web3Account);
    const web3EncryptionKey = useStore(s => s.web3EncryptionKey);
    const [isNavOpen, setIsNavOpen] = useState(false);

    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const searchQuery = useStore(s => s.searchQuery);
    const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery || '');
    const [suggestions, setSuggestions] = useState([]);
    const searchInputRef = useRef(null);
    const debounceTimeoutRef = useRef(null);
    const abortControllerRef = useRef(null);
    const suggestionCache = useRef({});

    React.useEffect(() => {
        setLocalSearchQuery(searchQuery || '');
        if (searchQuery) {
            setIsSearchExpanded(true);
        }
    }, [searchQuery]);

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
        const query = localSearchQuery.trim();
        if (!query) return;

        if (query.startsWith('0x') && query.length === 42) {
            // Ethers Address -> Navigate to Wallet lookup implicitly or Ledger
            dispatch({ type: 'SET_ROUTE', payload: 'ledger' });
            dispatch({ type: 'SET_LEDGER_TAB', payload: 'blocks' });
        } else if (query.length === 64) {
            // Hash -> Open Block Modal
            dispatch({ type: 'SET_MODAL_OPEN', payload: { isOpen: true, hash: query } });
        } else {
            // Generic fallback searches against Blocks
            dispatch({ type: 'SET_ROUTE', payload: 'ledger' });
            dispatch({ type: 'SET_LEDGER_TAB', payload: 'blocks' });
        }
        dispatch({ type: 'SET_SEARCH', payload: query });
        searchInputRef.current?.blur();
    };

    const handleSearchClick = () => {
        setIsSearchExpanded(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
    };

    const handleSearchBlur = () => {
        setTimeout(() => {
            if (!localSearchQuery.trim() && !searchQuery) setIsSearchExpanded(false);
            setSuggestions([]);
        }, 150); // delay to allow suggestion clicks
    };

    const handleSearchClear = (e) => {
        e.stopPropagation();
        setLocalSearchQuery('');
        setSuggestions([]);
        setIsSearchExpanded(false);
        dispatch({ type: 'SET_SEARCH', payload: '' });
        searchInputRef.current?.blur();
    };

    const handleQueryChange = (e) => {
        const val = e.target.value;
        setLocalSearchQuery(val);

        if (!val.trim()) {
            setSuggestions([]);
            return;
        }

        const staticSuggestions = ['type:TRANSACTION', 'type:STORAGE_CONTRACT', 'type:STAKING_CONTRACT', 'type:VALIDATOR_REGISTRATION', 'from:', 'to:', 'owner:'];
        const matches = staticSuggestions.filter(s => s.toLowerCase().startsWith(val.toLowerCase()) && s.toLowerCase() !== val.toLowerCase());
        
        if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
        
        debounceTimeoutRef.current = setTimeout(async () => {
            let dyn = suggestionCache.current[val];
            if (!dyn) {
                if (abortControllerRef.current) abortControllerRef.current.abort();
                abortControllerRef.current = new AbortController();
                try {
                    const res = await fetch(`/api/suggest?q=${encodeURIComponent(val)}`, { signal: abortControllerRef.current.signal });
                    const data = await res.json();
                    if (data.success) {
                        dyn = data.suggestions;
                        suggestionCache.current[val] = dyn;
                    }
                } catch {
                    return; // Aborted
                }
            }
            if (dyn) setSuggestions([...matches, ...dyn].slice(0, 7));
            else setSuggestions(matches.slice(0, 7));
        }, 300);
    };

    const pagesList = (
        <>
            <a href="#" className={`nav-link ${activeRoute === 'ledger' ? 'active' : ''}`} onClick={(e) => routeTo(e, 'ledger')}>Ledger</a>
            {(web3Account && !isWalletConnecting) && (
                <>
                    <a href="#" className={`nav-link ${activeRoute === 'wallet' ? 'active' : ''}`} onClick={(e) => routeTo(e, 'wallet')}>Wallet</a>
                    <a href="#" className={`nav-link ${activeRoute === 'files' ? 'active' : ''}`} onClick={(e) => routeTo(e, 'files')}>Storage</a>
                </>
            )}
            {nodeConfig?.isAdmin && (
                <a href="#" className={`nav-link ${activeRoute === 'network' ? 'active' : ''}`} onClick={(e) => routeTo(e, 'network')}>Network</a>
            )}
        </>
    );

    const omnibarComponent = (
        <form className="omnibar" onSubmit={handleOmnibarSearch} style={{
            display: 'flex',
            alignItems: 'center',
            position: 'relative',
            width: (isSearchExpanded || localSearchQuery.trim()) ? '400px' : '44px',
            maxWidth: '100%',
            height: '44px',
            borderRadius: (isSearchExpanded || localSearchQuery.trim()) ? '100px' : '50%',
            background: (isSearchExpanded || localSearchQuery.trim()) ? 'rgba(30, 41, 59, 0.6)' : '#fbbf24',
            border: (isSearchExpanded || localSearchQuery.trim()) ? '1px solid rgba(255,255,255,0.1)' : 'none',
            backdropFilter: (isSearchExpanded || localSearchQuery.trim()) ? 'blur(10px)' : 'none',
            marginRight: '8px',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                overflow: 'visible',
                cursor: (isSearchExpanded || localSearchQuery.trim()) ? 'text' : 'pointer'
            }}
                onClick={() => { if (!isSearchExpanded && !localSearchQuery.trim()) handleSearchClick() }}
                onMouseOver={(e) => { if (!isSearchExpanded && !localSearchQuery.trim()) { e.currentTarget.style.transform = 'scale(1.1)'; } }}
                onMouseOut={(e) => { if (!isSearchExpanded && !localSearchQuery.trim()) { e.currentTarget.style.transform = 'scale(1)'; } }}
            >
                <div style={{ position: 'absolute', left: (isSearchExpanded || localSearchQuery.trim()) ? '12px' : '50%', top: '50%', transform: `translate(${(isSearchExpanded || localSearchQuery.trim()) ? '0' : '-50%'}, -50%)`, display: 'flex', alignItems: 'center', transition: 'all 0.3s ease', color: (isSearchExpanded || localSearchQuery.trim()) ? 'var(--text-muted)' : '#020617' }}>
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                </div>

                <input
                    ref={searchInputRef}
                    name="omnibar"
                    type="text"
                    placeholder="Search blocks, txns, or wallet addresses..."
                    value={localSearchQuery}
                    onChange={handleQueryChange}
                    onBlur={handleSearchBlur}
                    autoComplete="off"
                    style={{
                        width: '100%',
                        height: '100%',
                        padding: '0 32px 0 36px',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-main)',
                        fontSize: '0.85rem',
                        outline: 'none',
                        opacity: (isSearchExpanded || localSearchQuery.trim()) ? 1 : 0,
                        pointerEvents: (isSearchExpanded || localSearchQuery.trim()) ? 'auto' : 'none',
                        transition: 'opacity 0.2s 0.1s'
                    }}
                />

                {(isSearchExpanded || localSearchQuery) && (
                    <button type="button" onClick={handleSearchClear} style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: '18px', height: '18px', color: '#94a3b8', cursor: 'pointer', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onMouseOver={(e) => { e.currentTarget.style.color = '#f8fafc'; e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }} onMouseOut={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                )}
                
                {isSearchExpanded && suggestions.length > 0 && (
                    <div className="search-suggestions" style={{
                        position: 'absolute',
                        top: '110%',
                        left: 0,
                        right: 0,
                        background: 'rgba(15, 23, 42, 0.95)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                        overflow: 'hidden',
                        zIndex: 100
                    }}>
                        {suggestions.map((s, idx) => (
                            <div key={idx} style={{ padding: '0.6rem 1rem', cursor: 'pointer', color: '#e2e8f0', fontSize: '0.85rem', borderBottom: idx < suggestions.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
                                onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(56, 189, 248, 0.1)'; }}
                                onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                onClick={(e) => {
                                    e.preventDefault();
                                    setLocalSearchQuery(s);
                                    if (s.endsWith(':')) {
                                        searchInputRef.current?.focus();
                                    } else {
                                        setSuggestions([]);
                                        dispatch({ type: 'SET_SEARCH', payload: s });
                                        if (s.length === 64) {
                                            dispatch({ type: 'SET_MODAL_OPEN', payload: { isOpen: true, hash: s } });
                                        } else {
                                            dispatch({ type: 'SET_ROUTE', payload: 'ledger' });
                                            dispatch({ type: 'SET_LEDGER_TAB', payload: 'blocks' });
                                        }
                                        searchInputRef.current?.blur();
                                    }
                                }}
                            >
                                {s}
                            </div>
                        ))}
                    </div>
                )}
            </form>
    );

    const navActions = (
        <div className="nav-actions" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginLeft: 0,
        }}>
            {(web3Account && !isWalletConnecting) && (
                <button
                    onClick={() => dispatch({ type: 'SET_TRANSFER_MODAL_OPEN', payload: true })}
                    title="Transfer VERI"
                    style={{ background: '#38bdf8', border: 'none', width: '44px', height: '44px', borderRadius: '50%', cursor: 'pointer', color: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease' }}
                    onMouseOver={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 0 12px rgba(56, 189, 248, 0.6)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
            )}
            {(web3Account && !isWalletConnecting) && (
                <button
                    onClick={() => dispatch({ type: 'SET_UPLOAD_MODAL_OPEN', payload: true })}
                    title="Upload File"
                    style={{ background: '#4ade80', border: 'none', width: '44px', height: '44px', borderRadius: '50%', cursor: 'pointer', color: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease' }}
                    onMouseOver={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 0 12px rgba(74, 222, 128, 0.6)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                </button>
            )}
            {(web3Account && !isWalletConnecting) && (
                <div style={{ width: '1px', height: '44px', background: 'rgba(255, 255, 255, 0.1)' }} />
            )}
            <WalletConnection />
        </div>
    );



    const mobileDrawerLinks = (
        <div className="mobile-accordion-wrapper">
            <div className="mobile-accordion-group">
                <a href="#" style={{ paddingTop: '0' }} className={`mobile-accordion-header ${expandedAccordion === 'ledger' ? 'active' : ''}`} onClick={(e) => handleAccordionToggle(e, 'ledger')}>
                    Ledger
                    <div className="mobile-accordion-cta">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: expandedAccordion === 'ledger' ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </div>
                </a>
                {expandedAccordion === 'ledger' && (
                    <div className="mobile-nested-group" style={{ animation: 'fadeInDown 0.2s ease-out' }}>
                        <button className={`mobile-nested-item ${activeLedgerTab === 'blocks' ? 'active' : ''}`} onClick={(e) => { dispatch({ type: 'SET_LEDGER_TAB', payload: 'blocks' }); routeTo(e, 'ledger'); }}>Blocks</button>

                        {(nodeConfig?.roles?.includes('VALIDATOR') || nodeConfig?.roles?.includes('STORAGE')) && (
                            <button className={`mobile-nested-item ${activeLedgerTab === 'statistics' ? 'active' : ''}`} onClick={(e) => { dispatch({ type: 'SET_LEDGER_TAB', payload: 'statistics' }); routeTo(e, 'ledger'); }}>Statistics</button>
                        )}
                    </div>
                )}
            </div>

            {(web3Account && !isWalletConnecting) && (
                <div className="mobile-accordion-group">
                    <a href="#" className={`mobile-accordion-header ${activeRoute === 'wallet' ? 'active' : ''}`} onClick={(e) => routeTo(e, 'wallet')}>
                        Wallet
                    </a>
                </div>
            )}
            {(web3Account && !isWalletConnecting) && (
                <div className="mobile-accordion-group">
                    <a href="#" className={`mobile-accordion-header ${activeRoute === 'files' ? 'active' : ''}`} onClick={(e) => routeTo(e, 'files')}>
                        Data Storage
                    </a>
                </div>
            )}

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
            <div className="header-primary" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center' }}>
                <div className="header-top" style={{ justifySelf: 'start', display: 'flex', alignItems: 'center' }}>
                    <div className="logo">
                        <div className={`logo-icon ${error ? 'logo-glow-offline' : 'logo-glow-online'}`} onClick={() => {
                            if (nodeConfig?.isAdmin) {
                                dispatch({ type: 'SET_NODE_CONFIG_MODAL_OPEN', payload: true });
                            } else {
                                const pass = window.prompt("Enter Node Admin Password Override:");
                                if (pass) {
                                    const b64 = window.btoa(`admin:${pass}`);
                                    localStorage.setItem('verimus_admin_auth', b64);
                                    window.location.reload();
                                }
                            }
                        }} title="Double-click for DevOps Override">
                            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <defs>
                                    <linearGradient id="neonGradient" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                                        <stop stopColor="#c084fc" />
                                        <stop offset="0.5" stopColor="#818cf8" />
                                        <stop offset="1" stopColor="#38bdf8" />
                                    </linearGradient>
                                    
                                    {/* Face Gradients mapping node colors directly */}
                                    <linearGradient id="topFaceGrad" x1="12" y1="12" x2="12" y2="6" gradientUnits="userSpaceOnUse">
                                        <stop offset="0%" stopColor="#ffffff" /><stop offset="100%" stopColor="#c084fc" />
                                    </linearGradient>
                                    <linearGradient id="rightFaceGrad" x1="12" y1="12" x2="17.2" y2="15" gradientUnits="userSpaceOnUse">
                                        <stop offset="0%" stopColor="#ffffff" /><stop offset="100%" stopColor="#4ade80" />
                                    </linearGradient>
                                    <linearGradient id="leftFaceGrad" x1="12" y1="12" x2="6.8" y2="15" gradientUnits="userSpaceOnUse">
                                        <stop offset="0%" stopColor="#ffffff" /><stop offset="100%" stopColor="#38bdf8" />
                                    </linearGradient>
                                </defs>
                                <circle cx="12" cy="12" r="8.5" stroke="url(#neonGradient)" strokeWidth="1.5" />
                                
                                {/* Crisp 3D Isometric Cube Faces */}
                                <polygon points="12,12 6.8,9 12,6 17.2,9" fill="url(#topFaceGrad)" />
                                <polygon points="12,12 17.2,9 17.2,15 12,18" fill="url(#rightFaceGrad)" />
                                <polygon points="12,12 12,18 6.8,15 6.8,9" fill="url(#leftFaceGrad)" />
                            </svg>
                        </div>
                        <div className="logo-titles" style={{ display: 'flex', alignItems: 'center' }}>
                            <h1>{title}</h1>
                            <div className="desktop-only" style={{ width: '1px', height: '44px', background: 'rgba(255, 255, 255, 0.1)', marginLeft: '1.2rem', marginRight: '1.2rem' }} />
                            <nav className="main-nav desktop-only" style={{ margin: 0, gap: '0.8rem' }}>
                                {pagesList}
                            </nav>
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

                {/* Center column to house the expanding omnibox gracefully */}
                <div className="header-center desktop-only" style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', minWidth: 0 }}>
                    {omnibarComponent}
                </div>

                <div className="header-right desktop-only" style={{ display: 'flex', justifySelf: 'end', alignItems: 'center', gap: '1rem' }}>
                    {navActions}
                </div>
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
