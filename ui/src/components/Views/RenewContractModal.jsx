import React from 'react';

const RenewContractModal = ({ contract, onClose, onRenewSuccess }) => {
    return (
        <div className="modal" style={{ display: 'flex', position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
            <div className="modal-content glass-panel" style={{ width: '100%', maxWidth: '500px', margin: '0 1rem', padding: '2rem' }} onClick={e => e.stopPropagation()}>
                <h3 style={{ color: 'var(--text-main)', marginBottom: '1rem' }}>Renew Storage Contract</h3>
                <p style={{ color: 'var(--text-secondary)' }}>Escrow Top-Up mechanics are actively being modernized.</p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
                    <button onClick={onClose} className="primary-btn">Close</button>
                </div>
            </div>
        </div>
    );
};

export default RenewContractModal;
