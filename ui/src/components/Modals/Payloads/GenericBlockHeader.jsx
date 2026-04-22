import React from 'react';
import PropertyValue from './PropertyValue';

const GenericBlockHeader = ({ block, date, hideSignatures }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, max-content) 1fr', gap: '0.75rem 1rem' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Index:</span>
        <PropertyValue className="highlight" value={block.metadata?.index ?? block.index ?? -1} copyable={false} />

        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Hash:</span>
        <PropertyValue value={block.hash} />

        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Prev Hash:</span>
        <PropertyValue value={block.previousHash || 'None'} />

        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Timestamp:</span>
        <PropertyValue value={date} copyable={false} />

        {!hideSignatures && (
            <>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', alignSelf: 'center' }}>Signer Address:</span>
                <PropertyValue value={block.signerAddress} />

                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Signature:</span>
                <div style={{ minWidth: 0, overflow: 'hidden', width: '100%' }}>
                    <PropertyValue value={block.signature} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', width: '100%', boxSizing: 'border-box' }} />
                </div>
            </>
        )}
    </div>
);

export default GenericBlockHeader;
