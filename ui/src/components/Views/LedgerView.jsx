import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { ApiService } from '../../services/api';
import EpochTelemetryWidget from './Ledger/EpochTelemetryWidget';
import LedgerGrid from './LedgerGrid';

import ConsensusView from './ConsensusView';
import ContractsView from './ContractsView';

const LedgerView = () => {
    const dispatch = useStore(s => s.dispatch);
    const blocks = useStore(s => s.blocks);
    const selectedIndex = useStore(s => s.selectedIndex);
    const isModalOpen = useStore(s => s.isModalOpen);
    const nodeConfig = useStore(s => s.nodeConfig);
    const [showCallout, setShowCallout] = useState(false);
    const activeTab = useStore(s => s.activeLedgerTab);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('upload') === 'success') {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setShowCallout(true);
            window.history.replaceState({}, '', '/ledger');
        }

        ApiService.fetchBlocks(useStore.getState(), dispatch);
        const poll = setInterval(() => ApiService.fetchBlocks(useStore.getState(), dispatch), 5000);
        return () => clearInterval(poll);
    }, [dispatch]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            const max = blocks.length - 1;

            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                if (max < 0) return;
                if (selectedIndex < max) dispatch({ type: 'SET_SELECTED_INDEX', payload: selectedIndex + 1 });
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                if (max < 0) return;
                if (selectedIndex > 0) dispatch({ type: 'SET_SELECTED_INDEX', payload: selectedIndex - 1 });
            } else if (e.key === 'Enter') {
                if (!isModalOpen && selectedIndex >= 0 && selectedIndex <= max) {
                    e.preventDefault();
                    const block = blocks[selectedIndex];
                    if (block.status !== 'pending') {
                        dispatch({ type: 'SET_MODAL_OPEN', payload: { isOpen: true, hash: block.hash } });
                    }
                }
            } else if (e.key === 'Escape') {
                if (isModalOpen) {
                    e.preventDefault();
                    dispatch({ type: 'SET_MODAL_OPEN', payload: { isOpen: false, hash: null } });
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [blocks, selectedIndex, isModalOpen, dispatch]);

    return (
        <>
            {showCallout && (
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--success)', borderRadius: 'var(--radius-md)', padding: '1rem 1.5rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <svg style={{ color: 'var(--success)', width: '24px', height: '24px' }} fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                        </svg>
                        <div>
                            <h4 style={{ color: 'var(--success)', margin: 0, fontSize: '0.95rem' }}>Upload Successful</h4>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Your file bundle was uploaded. It is now pending network consensus and will be finalized shortly.</p>
                        </div>
                    </div>
                    <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', transition: 'background 0.2s' }} onClick={() => setShowCallout(false)}>
                        <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            )}
            
            <section className="ledger-section" style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-end', borderBottom: 'none', paddingBottom: '0' }}>
                    <div className="flat-tab-bar" style={{ display: 'flex' }}>
                        <button className={`flat-tab-btn ${activeTab === 'global' ? 'active' : ''}`} onClick={() => dispatch({ type: 'SET_LEDGER_TAB', payload: 'global' })}>Blocks</button>
                        {nodeConfig?.roles?.includes('VALIDATOR') && (
                            <button className={`flat-tab-btn ${activeTab === 'consensus' ? 'active' : ''}`} onClick={() => dispatch({ type: 'SET_LEDGER_TAB', payload: 'consensus' })}>Consensus</button>
                        )}
                        {nodeConfig?.roles?.includes('STORAGE') && (
                            <button className={`flat-tab-btn ${activeTab === 'contracts' ? 'active' : ''}`} onClick={() => dispatch({ type: 'SET_LEDGER_TAB', payload: 'contracts' })}>Contracts</button>
                        )}
                    </div>
                </div>
                <div className="glass-panel" style={{ padding: '2rem', borderRadius: '0 16px 16px 16px', minHeight: '600px', width: '100%' }}>
                    {activeTab === 'global' && (
                        <div className="stagger-1">
                            <EpochTelemetryWidget />
                            <LedgerGrid />
                        </div>
                    )}

                    {activeTab === 'consensus' && nodeConfig?.roles?.includes('VALIDATOR') && (
                        <div style={{ width: '100%' }} className="stagger-1">
                            <ConsensusView />
                        </div>
                    )}

                    {activeTab === 'contracts' && nodeConfig?.roles?.includes('STORAGE') && (
                        <div style={{ width: '100%' }} className="stagger-1">
                            <ContractsView />
                        </div>
                    )}
                </div>
            </section>
        </>
    );
};

export default LedgerView;
