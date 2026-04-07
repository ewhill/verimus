import React from 'react';
import PropertyValue from './PropertyValue';

export const TransactionPayload = ({ block }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, max-content) 1fr', gap: '0.5rem 1rem', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Sender:</span>
                <PropertyValue value={block.payload.senderAddress} />
                <span style={{ color: 'var(--text-muted)' }}>Recipient:</span>
                <PropertyValue value={block.payload.recipientAddress} />
                <span style={{ color: 'var(--text-muted)' }}>Amount:</span>
                <PropertyValue className="success" value={`${block.payload.amount} VERI`} copyable={false} />
                <span style={{ color: 'var(--text-muted)' }}>Signature:</span>
                <PropertyValue value={block.payload.senderSignature} />
            </div>
        </div>
    </div>
);

export const CheckpointPayload = ({ block }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, max-content) 1fr', gap: '0.5rem 1rem', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Epoch Bound:</span>
                <PropertyValue className="highlight" value={`Epoch #${block.payload.epochIndex}`} copyable={false} />
                <span style={{ color: 'var(--text-muted)' }}>Start Hash:</span>
                <PropertyValue value={block.payload.startHash} />
                <span style={{ color: 'var(--text-muted)' }}>End Hash:</span>
                <PropertyValue value={block.payload.endHash} />
                <span style={{ color: 'var(--text-muted)' }}>State Root:</span>
                <PropertyValue value={block.payload.stateMerkleRoot} />
                <span style={{ color: 'var(--text-muted)' }}>Contracts Root:</span>
                <PropertyValue value={block.payload.activeContractsMerkleRoot} />
            </div>
        </div>
    </div>
);

export const StakingContractPayload = ({ block }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, max-content) 1fr', gap: '0.5rem 1rem', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Collateral:</span>
                <PropertyValue className="highlight" value={`${block.payload.collateralAmount} VERI`} copyable={false} />
                <span style={{ color: 'var(--text-muted)' }}>Operator Address:</span>
                <PropertyValue value={block.payload.operatorAddress} />
                <span style={{ color: 'var(--text-muted)' }}>Timeline Bound:</span>
                <PropertyValue value={`${block.payload.minEpochTimelineDays} Days`} copyable={false} />
            </div>
        </div>
    </div>
);

export const SlashingTransactionPayload = ({ block }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, max-content) 1fr', gap: '0.5rem 1rem', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Penalized Entity:</span>
                <PropertyValue value={block.payload.penalizedAddress} />
                <span style={{ color: 'var(--text-muted)' }}>Burnt Ledger:</span>
                <PropertyValue value={`-${block.payload.burntAmount} VERI`} copyable={false} style={{ color: '#ef4444' }} />
                <span style={{ color: 'var(--text-muted)' }}>Evidence Sign:</span>
                <PropertyValue value={block.payload.evidenceSignature} />
            </div>
        </div>
    </div>
);
