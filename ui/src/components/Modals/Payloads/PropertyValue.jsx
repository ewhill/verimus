import React, { useState } from 'react';

const PropertyValue = ({ value, className = '', copyable = true, style = {} }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = (e) => {
        e.preventDefault();
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div style={{ position: 'relative', width: '100%', boxSizing: 'border-box' }}>
            <pre className={`property-value ${className}`} style={{ ...style, ...(copyable ? { paddingRight: '2.5rem' } : {}) }}>
                {value}
            </pre>
            {copyable && (
                <button
                    onClick={handleCopy}
                    title="Copy to clipboard"
                    style={{
                        position: 'absolute', top: '0.35rem', right: '0.35rem',
                        background: copied ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                        border: 'none', color: copied ? 'var(--success)' : 'var(--text-muted)',
                        cursor: 'pointer', padding: '0.3rem', borderRadius: '4px',
                        display: 'flex', alignItems: 'center', transition: 'color 0.2s',
                        zIndex: 2
                    }}
                >
                    {copied ? (
                        <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: '16px', height: '16px' }}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                    ) : (
                        <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: '16px', height: '16px' }}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" /></svg>
                    )}
                </button>
            )}
        </div>
    );
};

export default PropertyValue;
