import React from 'react';

// Primary Token (VERI) - The Bounded Volume
export const VeriIcon = ({ size = 24, className = '', style = {} }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={`icon-veri ${className}`} style={{ display: 'inline-block', verticalAlign: 'middle', marginTop: '-0.15em', ...style }}>
        {/* Soft Outer Halo */}
        <circle cx="12" cy="12" r="10" strokeWidth="1.5" strokeOpacity="0.3" />
        {/* Upper Isometric Plane (The Cube Lid) */}
        <polygon points="12,7 17.5,10.2 12,13.4 6.5,10.2" strokeWidth="1" strokeOpacity="0.5" />
        {/* Bold 'V' intersecting as the lower cube hull */}
        <polyline points="6.5,10.2 12,17.5 17.5,10.2" strokeWidth="2" />
    </svg>
);

// Fractional Unit (WEI) - The Structural Plane
export const WeiIcon = ({ size = 24, className = '', style = {} }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={`icon-wei ${className}`} style={{ display: 'inline-block', verticalAlign: 'middle', marginTop: '-0.15em', ...style }}>
        {/* Condensed Soft Ring */}
        <circle cx="12" cy="12" r="7" strokeWidth="1" strokeOpacity="0.3" />
        {/* Inherited Single Structural Plane */}
        <polygon points="12,8 16.5,11.5 12,15 7.5,11.5" strokeWidth="1.5" />
        {/* Core atomic center node */}
        <circle cx="12" cy="11.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
);
