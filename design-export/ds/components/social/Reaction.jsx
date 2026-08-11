import React from 'react';
export function Reaction({icon='♡', count, active=false, onClick}) {
  return (
    <button onClick={onClick} style={{display:'flex', alignItems:'center', gap:5, background:'none', border:'none',
      color: active?'var(--brand-primary)':'var(--text-tertiary)', cursor:'pointer', fontSize:13, fontFamily:'var(--font-body)'}}>
      <span>{icon}</span>{count!=null && <span>{count}</span>}
    </button>
  );
}
