'use client';

export function LoadingScreen() {
  return (
    <div
      style={{
        position:       'fixed',
        inset:          0,
        background:     '#0F1117',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            '16px',
        zIndex:         9999,
      }}
    >
      {/* Flame box */}
      <div
        style={{
          width:          64,
          height:         64,
          background:     '#E8521A',
          borderRadius:   16,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          fontSize:       32,
          boxShadow:      '0 8px 32px rgba(232,82,26,0.35)',
          animation:      'giz-pulse 2s ease-in-out infinite',
        }}
      >
        🔥
      </div>

      <p style={{ color: '#8B8B9E', fontSize: 14, margin: 0, letterSpacing: '0.02em' }}>
        Loading GizOps…
      </p>

      <style>{`
        @keyframes giz-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.8; transform: scale(0.96); }
        }
      `}</style>
    </div>
  );
}
