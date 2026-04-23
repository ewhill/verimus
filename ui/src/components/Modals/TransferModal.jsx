import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useStore } from '../../store';
import { VeriIcon } from '../Icons';

const TransferModal = () => {
    const isOpen = useStore(s => s.isTransferModalOpen);
    const web3Account = useStore(s => s.web3Account);
    const activeProvider = useStore(s => s.activeProvider);
    const dispatch = useStore(s => s.dispatch);

    const [recipient, setRecipient] = useState('');
    const [amount, setAmount] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    const [balance, setBalance] = useState('0');

    useEffect(() => {
        if (isOpen && web3Account) {
            fetch(`/api/wallet?address=${web3Account}&page=1&limit=1`)
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.balance !== undefined) {
                        setBalance(parseFloat(ethers.formatUnits(data.balance.toString(), 18)).toFixed(6));
                    }
                }).catch(() => {});
        } else if (!isOpen) {
            // reset state
            setRecipient('');
            setAmount('');
            setError(null);
            setSuccessMessage(null);
        }
    }, [isOpen, web3Account]);

    if (!isOpen) return null;

    const onClose = () => dispatch({ type: 'SET_TRANSFER_MODAL_OPEN', payload: false });

    const handleMax = () => {
        setAmount(balance.toString());
    };

    const handleTransfer = async () => {
        setError(null);
        setSuccessMessage(null);

        if (!activeProvider || !web3Account) {
            setError("Web3 Wallet is securely unmapped. Connect via wallet button globally.");
            return;
        }

        if (!recipient || !recipient.startsWith('0x') || recipient.length !== 42) {
            setError("Recipient must physically structurally map an EIP-55 natively exact address array.");
            return;
        }

        const amtFloat = parseFloat(amount);
        if (isNaN(amtFloat) || amtFloat <= 0) {
            setError("Amount constraints mechanically evaluate negative arrays explicitly natively.");
            return;
        }

        if (amtFloat > parseFloat(balance)) {
            setError("Volume limitation securely clamps native capacity structurally above bounds.");
            return;
        }

        setIsSubmitting(true);
        try {
            const timestamp = Date.now().toString();
            const proxyMessage = `Authorize decentralized transfer mapping\nTimestamp: ${timestamp}\nRecipient: ${recipient}\nAmount: ${amount}`;
            
            const signer = await activeProvider.getSigner();
            const signature = await signer.signMessage(proxyMessage);

            const res = await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'transfer',
                    recipientAddress: recipient,
                    amount: amount,
                    ownerAddress: web3Account,
                    ownerSignature: signature,
                    timestamp
                })
            });

            const data = await res.json();
            if (!data.success) {
                if (res.status === 402) {
                    throw new Error("Mathematical ledger boundaries mechanically clamp missing collateral autonomously natively.");
                }
                throw new Error(data.message || "Native verification boundary exception structurally bypassing arrays.");
            }

            dispatch({
                type: 'ADD_TOAST',
                payload: { id: Date.now(), title: 'Transaction Successful', message: 'Volume transferred strictly sequentially!', type: 'success' }
            });

            setSuccessMessage("Transaction securely integrated! Checking global consensus arrays...");

            // Poll database seamlessly awaiting network settlement actively securely
            let settled = false;
            let attempts = 0;
            while (!settled && attempts < 20) {
                await new Promise(r => setTimeout(r, 1000));
                try {
                    const chk = await fetch(`/api/blocks?type=transaction&own=true&sort=desc`);
                    if (chk.ok) {
                        const json = await chk.json();
                        const found = json.blocks.find(b => b.hash === data.blockHash);
                        if (found) {
                            settled = true;
                        }
                    }
                } catch {
                    // Safe swallow
                }
                attempts++;
            }

            onClose();

            if (settled) {
                window.location.hash = `view-block-${data.blockHash}`;
                dispatch({ type: 'SET_ROUTE', payload: 'ledger' });
                window.history.pushState({}, '', '/ledger');
            }

        } catch (err) {
            setError(err.message || 'System fault executing matrix structural limits securely natively.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
            <div className="glass-panel" style={{
                width: '100%', maxWidth: '500px', padding: '2rem', borderRadius: 'var(--radius-lg)',
                border: '1px solid rgba(192, 132, 252, 0.3)', boxShadow: '0 0 30px rgba(192, 132, 252, 0.1)',
                color: '#f8fafc', position: 'relative'
            }}>
                <button onClick={onClose} disabled={isSubmitting} style={{
                    position: 'absolute', top: '1rem', right: '1rem', background: 'transparent',
                    border: 'none', color: '#94a3b8', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontSize: '1.2rem',
                    transition: 'color 0.2s', padding: '0.5rem'
                }} onMouseOver={(e) => !isSubmitting && (e.currentTarget.style.color = '#f8fafc')} onMouseOut={(e) => !isSubmitting && (e.currentTarget.style.color = '#94a3b8')}>
                    ✕
                </button>

                <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: '#c084fc' }}>Issue Transfer Volume</h2>
                <p style={{ color: '#94a3b8', marginBottom: '2rem', fontSize: '0.9rem' }}>Deploy verifiable token limits structuring arbitrary recipient bindings globally natively over EVM structures.</p>

                {error && (
                    <div style={{ background: 'rgba(248, 113, 113, 0.1)', border: '1px solid rgba(248, 113, 113, 0.3)', color: '#f87171', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                        {error}
                    </div>
                )}
                
                {successMessage && (
                    <div style={{ background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.3)', color: '#4ade80', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                        {successMessage}
                    </div>
                )}

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', color: '#818cf8', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Recipient Boundary Address</label>
                    <input
                        type="text"
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                        placeholder="0x..."
                        disabled={isSubmitting}
                        style={{
                            width: '100%', padding: '0.8rem 1rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px', color: '#fff', fontSize: '1rem', fontFamily: 'monospace',
                            transition: 'border-color 0.2s', outline: 'none'
                        }}
                        onFocus={(e) => e.target.style.borderColor = 'rgba(192, 132, 252, 0.5)'}
                        onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                    />
                </div>

                <div style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
                        <label style={{ color: '#818cf8', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>Volumetric Arrays (<VeriIcon size={12} />)</label>
                        <button onClick={handleMax} disabled={isSubmitting} style={{ background: 'transparent', border: 'none', color: '#c084fc', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontSize: '0.8rem', fontWeight: 600, padding: 0 }} onMouseOver={(e) => !isSubmitting && (e.currentTarget.style.textDecoration = 'underline')} onMouseOut={(e) => !isSubmitting && (e.currentTarget.style.textDecoration = 'none')}>
                            MAX LIMIT ({balance})
                        </button>
                    </div>
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00000"
                        disabled={isSubmitting}
                        step="0.0001"
                        style={{
                            width: '100%', padding: '0.8rem 1rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px', color: '#fff', fontSize: '1rem', fontFamily: 'monospace',
                            transition: 'border-color 0.2s', outline: 'none'
                        }}
                        onFocus={(e) => e.target.style.borderColor = 'rgba(192, 132, 252, 0.5)'}
                        onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                    />
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button onClick={onClose} disabled={isSubmitting} style={{
                        flex: 1, padding: '0.8rem', background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontWeight: 600, transition: 'all 0.2s'
                    }} onMouseOver={(e) => !isSubmitting && (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')} onMouseOut={(e) => !isSubmitting && (e.currentTarget.style.background = 'transparent')}>
                        Abort Context
                    </button>
                    <button onClick={handleTransfer} disabled={isSubmitting} style={{
                        flex: 1, padding: '0.8rem', background: isSubmitting ? 'rgba(192, 132, 252, 0.5)' : '#c084fc', color: '#fff', border: 'none',
                        borderRadius: '8px', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontWeight: 600, transition: 'all 0.2s',
                        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', boxShadow: isSubmitting ? 'none' : '0 0 15px rgba(192, 132, 252, 0.4)'
                    }} onMouseOver={(e) => !isSubmitting && (e.currentTarget.style.boxShadow = '0 0 25px rgba(192, 132, 252, 0.6)')} onMouseOut={(e) => !isSubmitting && (e.currentTarget.style.boxShadow = '0 0 15px rgba(192, 132, 252, 0.4)')}>
                        {isSubmitting ? (
                            <>
                                <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px', borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }}></div>
                                Proposing Array...
                            </>
                        ) : 'Deploy Signature Limit'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TransferModal;
