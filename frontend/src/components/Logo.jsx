import React from 'react';

const CauldronIcon = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
    <path d="M14,37 L12,45 L15.5,45 L16.5,37 Z" fill="#7A4E06"/>
    <path d="M31.5,37 L33.5,37 L36,45 L32.5,45 Z" fill="#7A4E06"/>
    <path d="M20,39 L19,45 L29,45 L28,39 Z" fill="#8B5E08"/>
    <path d="M11,19 Q7.5,29 9.5,36 Q15,43 24,43 Q33,43 38.5,36 Q40.5,29 37,19" fill="#5A3604" opacity="0.22"/>
    <path d="M10,18 Q6,28 8,35 Q14,42 24,42 Q34,42 40,35 Q42,28 38,18 Q32,14 24,14 Q16,14 10,18 Z" fill="#C87808"/>
    <path d="M10,19 Q7,28 9,34 Q12,39 16,41 Q12,36 10,29 Q8,22 11,20 Z" fill="#D48C10" opacity="0.75"/>
    <path d="M12,17 Q9,24 11,30 Q13,36 17,39 Q13,32 12,25 Q10,19 13,18 Z" fill="#F0A820" opacity="0.5"/>
    <ellipse cx="15" cy="20" rx="4" ry="2" fill="#F8C038" opacity="0.38" transform="rotate(-22,15,20)"/>
    <path d="M38,19 Q41,28 39,34 Q36,39 32,41 Q36,36 37,29 Q39,22 37,20 Z" fill="#5A3604" opacity="0.52"/>
    <ellipse cx="24" cy="16.5" rx="15.5" ry="4.5" fill="#9A6208"/>
    <ellipse cx="24" cy="15.5" rx="14.5" ry="3.8" fill="#C88010"/>
    <ellipse cx="22" cy="14.5" rx="8" ry="2" fill="#F0A820" opacity="0.62"/>
    <ellipse cx="24" cy="17.8" rx="13" ry="3.2" fill="#6A4008"/>
    <ellipse cx="24" cy="17.8" rx="12" ry="2.8" fill="#0B4A28"/>
    <ellipse cx="24" cy="17" rx="11" ry="2.2" fill="#1D9E75"/>
    <ellipse cx="24" cy="16.2" rx="10" ry="1.8" fill="#2dd4bf"/>
    <circle cx="19.5" cy="15.2" r="1.8" fill="#5DCAA5" opacity="0.88"/>
    <circle cx="27" cy="15.6" r="1.3" fill="#2dd4bf" opacity="0.75"/>
    <circle cx="24" cy="13.8" r="2" fill="#2dd4bf" opacity="0.7"/>
  </svg>
);

export const Logo = ({ size = 'md', theme = 'dark', showTagline = false }) => {
  const sizes = {
    xs: { icon: 20, text: '14px' },
    sm: { icon: 28, text: '18px' },
    md: { icon: 36, text: '22px' },
    lg: { icon: 48, text: '30px' },
    xl: { icon: 64, text: '40px' },
  };
  const { icon, text } = sizes[size] || sizes.md;
  const textColor = theme === 'dark' ? '#f8fafc' : '#0a0f1e';
  const subColor = theme === 'dark'
    ? 'rgba(248,250,252,0.4)'
    : 'rgba(10,15,30,0.4)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: icon * 0.25 + 'px' }}>
      <CauldronIcon size={icon} />
      <div style={{ lineHeight: 1 }}>
        <div style={{
          fontFamily: 'inherit',
          fontWeight: 500,
          fontSize: text,
          letterSpacing: '-0.025em',
          color: textColor,
          lineHeight: 1,
        }}>
          Geta<span style={{ color: '#2dd4bf' }}>fix</span>
        </div>
        {showTagline && (
          <div style={{
            fontSize: '11px',
            color: subColor,
            marginTop: '3px',
            letterSpacing: '0.01em',
          }}>
            AI Destekli Borsa Forecast
          </div>
        )}
      </div>
    </div>
  );
};

export { CauldronIcon };
export default Logo;
