import React from 'react';

// Primary Token ($VERI)
export const VeriIcon = ({ size = 24, className = '', style = {} }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`icon-veri ${className}`} style={{ display: 'inline-block', verticalAlign: 'middle', marginTop: '-0.15em', ...style }}>
        <polyline points="4 4 12 20 20 4" />
        <line x1="7" y1="10" x2="17" y2="10" />
        <line x1="9" y1="14" x2="15" y2="14" />
    </svg>
);

// Fractional Unit (WEI)
export const WeiIcon = ({ size = 24, className = '', style = {} }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`icon-wei ${className}`} style={{ display: 'inline-block', verticalAlign: 'middle', marginTop: '-0.15em', ...style }}>
        <path d="M12 2 L15 10 L22 12 L15 14 L12 22 L9 14 L2 12 L9 10 Z" />
        <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
    </svg>
);
