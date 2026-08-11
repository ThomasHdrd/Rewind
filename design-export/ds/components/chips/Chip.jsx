import React from 'react';
export function Chip({label, selected=false, disabled=false, onClick}) {
  return (
    <button onClick={disabled?undefined:onClick} disabled={disabled} style={{
      fontFamily:'var(--font-body)', fontWeight:600, fontSize:14, padding:'8px 16px',
      borderRadius:'var(--radius-full)', cursor:disabled?'not-allowed':'pointer',
      background: selected? 'var(--brand-primary)':'var(--surface-secondary)',
      color: selected? 'var(--text-inverse)':'var(--text-secondary)',
      border: selected? 'none':'1px solid var(--border-default)',
      opacity: disabled?0.4:1, whiteSpace:'nowrap'
    }}>{label}</button>
  );
}
