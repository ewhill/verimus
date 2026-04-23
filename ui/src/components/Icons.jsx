import React from 'react';

// Primary Token (VERI) - Inset Bisected 'V'
export const VeriIcon = ({ size = 24, className = '', style = {} }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={`icon-veri ${className}`} style={{ display: 'inline-block', verticalAlign: 'middle', marginTop: '-0.15em', ...style }}>
        {/* Bounding Outer Ring */}
        <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
        {/* Crisp Inset V */}
        <polyline points="7 7 12 17 17 7" strokeWidth="2" />
        {/* Edge-to-Edge Bisecting Strike */}
        <line x1="2" y1="12" x2="22" y2="12" strokeWidth="1.5" />
    </svg>
);

// Fractional Unit (WEI) - Inset Bisected 'W'
export const WeiIcon = ({ size = 24, className = '', style = {} }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={`icon-wei ${className}`} style={{ display: 'inline-block', verticalAlign: 'middle', marginTop: '-0.15em', ...style }}>
        {/* Bounding Outer Ring */}
        <circle cx="12" cy="12" r="10" strokeWidth="1.5" strokeOpacity="0.7" />
        {/* Crisp Inset W */}
        <polyline points="5.5 8 9 16 12 11 15 16 18.5 8" strokeWidth="1.5" />
        {/* Edge-to-Edge Bisecting Strike */}
        <line x1="2" y1="12" x2="22" y2="12" strokeWidth="1" />
    </svg>
);
