import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { VeriIcon } from '../Icons';

const NodeConfigModal = () => {
    const dispatch = useStore(s => s.dispatch);
    const isNodeConfigModalOpen = useStore(s => s.isNodeConfigModalOpen);
    const nodeConfig = useStore(s => s.nodeConfig);
    
    const [roles, setRoles] = useState([]);
    const [costPerGB, setCostPerGB] = useState(1.5);
    const [egressCostPerGB, setEgressCostPerGB] = useState(0.0);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);

    // Initialize state from global store whenever the modal opens
    useEffect(() => {
        if (isNodeConfigModalOpen && nodeConfig) {
            setRoles(nodeConfig.roles || []);
            if (nodeConfig.storageConfig) {
                setCostPerGB(nodeConfig.storageConfig.costPerGB ?? 1.5);
                setEgressCostPerGB(nodeConfig.storageConfig.egressCostPerGB ?? 0.0);
            }
            setErrorMsg(null);
        }
    }, [isNodeConfigModalOpen, nodeConfig]);

    const closeModal = () => {
        dispatch({ type: 'SET_NODE_CONFIG_MODAL_OPEN', payload: false });
    };

    if (!isNodeConfigModalOpen) return null;

    const toggleRole = (role) => {
        setRoles(prev => 
            prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
        );
    };

    const hasStorageRole = roles.includes('STORAGE');

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        setErrorMsg(null);

        try {
            const payload = {
                roles,
                costPerGB: parseFloat(costPerGB),
                egressCostPerGB: parseFloat(egressCostPerGB)
            };

            const response = await fetch('/api/node/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Failed to update configuration.');
            }

            // Successfully updated! Wait for next generic poll to catch the state, or manually overwrite
            // But let's close the modal directly
            closeModal();
            dispatch({ type: 'ADD_TOAST', payload: { id: Date.now(), message: 'Node configuration applied globally!', type: 'success' } });

        } catch (err) {
            setErrorMsg(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="modal" style={{ display: 'flex', position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', alignItems: 'center', justifyContent: 'center' }} onClick={closeModal}>
            <div className="modal-content glass-panel" style={{ width: '100%', maxWidth: '500px', margin: '0 1rem', padding: '0', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0', padding: '1.5rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>Node configuration</h3>
                    <button onClick={closeModal} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer', transition: 'color 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.25rem', borderRadius: '4px' }} className="hover-text-main">&times;</button>
                </div>

                <div className="modal-body" style={{ padding: '2rem', overflowY: 'auto' }}>
                    
                    {errorMsg && (
                        <div style={{ marginBottom: '1.5rem', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', fontSize: '0.85rem' }}>
                            {errorMsg}
                        </div>
                    )}

                    <div style={{ marginBottom: '2rem' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '1rem' }}>Active Execution Roles</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {[
                                { id: 'ORIGINATOR', label: 'Originator', desc: 'Allows uploading and managing your own local files.' },
                                { id: 'VALIDATOR', label: 'Validator', desc: 'Participates in proof-of-replication consensus validations.' },
                                { id: 'STORAGE', label: 'Storage', desc: 'Provides active marketplace storage SLAs dynamically.' },
                            ].map(role => (
                                <label key={role.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '1rem', background: 'rgba(15, 23, 42, 0.4)', border: roles.includes(role.id) ? '1px solid rgba(192, 132, 252, 0.5)' : '1px solid rgba(255,255,255,0.05)', borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all 0.2s' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={roles.includes(role.id)} 
                                        onChange={() => toggleRole(role.id)}
                                        style={{ marginTop: '0.2rem', accentColor: '#c084fc', width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
                                    />
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                        <span style={{ color: roles.includes(role.id) ? '#fff' : 'var(--text-main)', fontWeight: 500, fontSize: '0.95rem' }}>{role.label}</span>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.4 }}>{role.desc}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {hasStorageRole && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '0.5rem' }}>Marketplace Tokenomics</span>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>Storage Cost (<VeriIcon size={12} /> / GB / Month)</label>
                                <input 
                                    type="number" 
                                    step="0.01" 
                                    min="0"
                                    value={costPerGB}
                                    onChange={(e) => setCostPerGB(e.target.value)}
                                    style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', fontSize: '1rem', width: '100%', boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.2s' }}
                                    onFocus={(e) => e.target.style.borderColor = 'rgba(192, 132, 252, 0.5)'}
                                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                                />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>Egress Bandwidth Cost (<VeriIcon size={12} /> / GB)</label>
                                <input 
                                    type="number" 
                                    step="0.01" 
                                    min="0"
                                    value={egressCostPerGB}
                                    onChange={(e) => setEgressCostPerGB(e.target.value)}
                                    style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', fontSize: '1rem', width: '100%', boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.2s' }}
                                    onFocus={(e) => e.target.style.borderColor = 'rgba(192, 132, 252, 0.5)'}
                                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                                />
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2.5rem', gap: '1rem' }}>
                        <button onClick={closeModal} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-main)', padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 500, transition: 'all 0.2s' }} onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>Cancel</button>

                        <button onClick={handleSave} disabled={isSaving || roles.length === 0} className="primary-btn" style={{ padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-md)', fontWeight: 600, opacity: (isSaving || roles.length === 0) ? 0.7 : 1 }}>
                            {isSaving ? 'Applying...' : 'Apply Configurations'}
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default NodeConfigModal;
