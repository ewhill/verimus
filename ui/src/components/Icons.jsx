import React from 'react';

// Primary Token (VERI) - Inset Bisected 'V'
export const VeriIcon = ({ size = 24, className = '', style = {} }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={`icon-veri ${className}`} style={{ display: 'inline-block', verticalAlign: 'middle', marginTop: '-0.15em', ...style }}>
        {/* Bounding Outer Ring */}
        <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
        {/* Crisp Inset V touching exact outer circle limits perfectly */}
        <polyline points="6 4 12 22 18 4" strokeWidth="2" />
        {/* Edge-to-Edge Bisecting Strike */}
        <line x1="2" y1="12" x2="22" y2="12" strokeWidth="1.5" />
    </svg>
);

// Fractional Unit (WEI) - Inset Bisected 'W'
export const WeiIcon = ({ size = 24, className = '', style = {} }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={`icon-wei ${className}`} style={{ display: 'inline-block', verticalAlign: 'middle', marginTop: '-0.15em', ...style }}>
        {/* Bounding Outer Ring */}
        <circle cx="12" cy="12" r="10" strokeWidth="1.5" strokeOpacity="0.7" />
        {/* Crisp Inset W touching exact outer circle limits perfectly */}
        <polyline points="6 4 9 21.5 12 12 15 21.5 18 4" strokeWidth="1.5" />
        {/* Edge-to-Edge Bisecting Strike */}
        <line x1="2" y1="12" x2="22" y2="12" strokeWidth="1" />
    </svg>
);
